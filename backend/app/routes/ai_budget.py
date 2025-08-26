from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import List, Dict, Any
import os
import uuid
from datetime import datetime

from ..db import get_supabase_client
from ..services.deterministic_parser import parse_estimate_xlsx
from ..services.excel_parser import ExcelBudgetParser

router = APIRouter(prefix="/ai-budget", tags=["ai-budget"])

@router.post("/smart-upload")
async def smart_budget_upload(
    project_id: str = Form(...),
    file: UploadFile = File(...)
):
    """AI-powered budget upload - automatically analyzes Excel and extracts data"""
    try:
        # Validate file
        file_ext = file.filename.lower().split('.')[-1] if file.filename else ''
        allowed_extensions = ['csv', 'xlsx', 'xls']
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"File must be Excel or CSV format. Got: {file_ext}"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Check file size
        max_size = int(os.getenv('MAX_FILE_SIZE', 10485760))
        if len(file_content) > max_size:
            raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
        
        # Step 1: Analyze sheets and find the best one
        excel_analyzer = ExcelBudgetParser()
        analysis = excel_analyzer.analyze_workbook(file_content)
        
        # Get the recommended sheet
        recommended_sheet = analysis.get('recommended_sheet')
        if not recommended_sheet:
            raise HTTPException(status_code=400, detail="No suitable worksheet found for budget data")
        
        print(f"AI Analysis: Using recommended sheet '{recommended_sheet}'")
        
        # Generate file ID
        file_id = str(uuid.uuid4())
        
        # Step 2: Save file temporarily and use deterministic parser
        temp_file_path = f"/tmp/{file_id}_{file.filename}"
        with open(temp_file_path, 'wb') as temp_file:
            temp_file.write(file_content)
        
        try:
            # Parse with deterministic parser
            result = parse_estimate_xlsx(temp_file_path)
        finally:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        
        # Convert division structure to flat budget items for database storage
        budget_items = []
        for division in result.get('divisions', []):
            for item in division.get('items', []):
                budget_item = {
                    'division': division.get('divisionCode', ''),
                    'description': item.get('tradeDescription', ''),
                    'quantity': item.get('quantity'),
                    'unit': item.get('unit', 'LS'),
                    'unit_cost': (item.get('totalCost', 0) / item.get('quantity', 1)) if item.get('quantity') and item.get('quantity') > 0 else 0,
                    'total_cost': item.get('totalCost', 0),
                    'notes': f"Material: ${item.get('materialCost', 0) or 0:.2f}, Labor: ${item.get('laborCost', 0) or 0:.2f}, Sub/Equip: ${item.get('subEquipCost', 0) or 0:.2f}"
                }
                if item.get('scopeNotes'):
                    budget_item['notes'] += f" | Scope: {item.get('scopeNotes')}"
                if item.get('estimatingNotes'):
                    budget_item['notes'] += f" | Notes: {item.get('estimatingNotes')}"
                    
                budget_items.append(budget_item)
        
        if not budget_items:
            raise HTTPException(status_code=400, detail="No valid budget items found after AI analysis")
        
        # Step 3: Store in database
        supabase = get_supabase_client()
        
        # Verify project exists
        project_check = supabase.table("projects").select("id").eq("id", project_id).execute()
        if not project_check.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Store file metadata
        file_record = {
            "id": file_id,
            "project_id": project_id,
            "file_name": file.filename,
            "file_path": f"budgets/{project_id}/{file_id}_{file.filename}",
            "file_size": len(file_content),
            "file_type": file.content_type,
            "file_category": "budget",
            "uploaded_by": None
        }
        
        supabase.table("files").insert(file_record).execute()
        
        # Store budget items
        for item in budget_items:
            item["project_id"] = project_id
            item["id"] = str(uuid.uuid4())
            # Convert cost_breakdown to JSON string for storage
            if 'cost_breakdown' in item:
                item['notes'] = f"Cost breakdown: {item.pop('cost_breakdown')}"
        
        supabase.table("budget_items").insert(budget_items).execute()
        
        # Log action
        audit_log = {
            "project_id": project_id,
            "user_id": None,
            "action": "ai_budget_uploaded",
            "entity_type": "budget",
            "entity_id": file_id,
            "details": {
                "file_name": file.filename,
                "worksheet": recommended_sheet,
                "parsing_method": "deterministic_pandas",
                "items_count": len(budget_items),
                "divisions_found": len(result.get('divisions', [])),
                "grand_total": result.get('jobTotal', result.get('grandTotalFromItems', 0))
            }
        }
        
        supabase.table("audit_logs").insert(audit_log).execute()
        
        return {
            "message": "Deterministic analysis completed successfully",
            "file_id": file_id,
            "worksheet_used": recommended_sheet,
            "items_processed": len(budget_items),
            "divisions_found": len(result.get('divisions', [])),
            "grand_total": result.get('jobTotal', 0),
            "project_subtotal": result.get('projectSubtotal', 0),
            "overhead_profit": result.get('overheadAndProfit', 0),
            "grand_total_from_items": result.get('grandTotalFromItems', 0),
            "analysis_summary": result,
            "preview": budget_items[:10]  # First 10 items
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Smart upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

@router.get("/analysis/{project_id}")
async def get_budget_analysis(project_id: str):
    """Get the AI analysis results for a project"""
    try:
        supabase = get_supabase_client()
        
        # Get budget items grouped by division
        result = supabase.table("budget_items")\
            .select("*")\
            .eq("project_id", project_id)\
            .order("division, description")\
            .execute()
        
        # Group by division
        divisions = {}
        total_cost = 0
        
        for item in result.data:
            div_code = item.get('division', 'Unknown')
            if div_code not in divisions:
                divisions[div_code] = {
                    'division_code': div_code,
                    'items': [],
                    'total': 0
                }
            
            divisions[div_code]['items'].append(item)
            if item.get('total_cost'):
                divisions[div_code]['total'] += item['total_cost']
                total_cost += item['total_cost']
        
        return {
            "project_id": project_id,
            "divisions": list(divisions.values()),
            "total_items": len(result.data),
            "grand_total": total_cost
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching analysis: {str(e)}")