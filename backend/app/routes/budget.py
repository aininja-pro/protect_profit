from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from typing import List, Dict, Any, Optional
import pandas as pd
import io
import os
import uuid
from datetime import datetime

from ..db import get_supabase_client
from ..services.excel_parser import ExcelBudgetParser

router = APIRouter(prefix="/budget", tags=["budget"])

def parse_budget_csv(file_content: bytes) -> List[Dict[str, Any]]:
    """Parse uploaded CSV/Excel budget file"""
    try:
        # Try to read as Excel first
        try:
            df = pd.read_excel(io.BytesIO(file_content))
        except:
            # Fall back to CSV
            df = pd.read_csv(io.StringIO(file_content.decode('utf-8')))
        
        # Clean and standardize column names
        df.columns = df.columns.str.lower().str.strip()
        
        # Map common column variations to standard names
        column_mapping = {
            'div': 'division',
            'division': 'division',
            'csi': 'division',
            'desc': 'description',
            'description': 'description',
            'item': 'description',
            'qty': 'quantity',
            'quantity': 'quantity',
            'amount': 'quantity',
            'units': 'unit',
            'unit': 'unit',
            'um': 'unit',
            'cost': 'unit_cost',
            'unit_cost': 'unit_cost',
            'price': 'unit_cost',
            'total': 'total_cost',
            'total_cost': 'total_cost',
            'amount': 'total_cost'
        }
        
        # Rename columns based on mapping
        df = df.rename(columns=column_mapping)
        
        # Ensure required columns exist
        required_cols = ['division', 'description', 'quantity', 'unit', 'total_cost']
        missing_cols = [col for col in required_cols if col not in df.columns]
        
        if missing_cols:
            raise ValueError(f"Missing required columns: {missing_cols}")
        
        # Convert to list of dictionaries
        budget_items = []
        for _, row in df.iterrows():
            item = {
                'division': str(row.get('division', '')).strip(),
                'description': str(row.get('description', '')).strip(),
                'quantity': float(row.get('quantity', 0)) if pd.notna(row.get('quantity')) else 0,
                'unit': str(row.get('unit', 'LS')).strip(),
                'unit_cost': float(row.get('unit_cost', 0)) if pd.notna(row.get('unit_cost')) else 0,
                'total_cost': float(row.get('total_cost', 0)) if pd.notna(row.get('total_cost')) else 0,
                'notes': str(row.get('notes', '')).strip() if pd.notna(row.get('notes')) else None
            }
            
            # Calculate unit_cost if missing but total_cost and quantity exist
            if item['unit_cost'] == 0 and item['total_cost'] > 0 and item['quantity'] > 0:
                item['unit_cost'] = item['total_cost'] / item['quantity']
            
            # Skip rows with no description
            if item['description'] and item['description'] != 'nan':
                budget_items.append(item)
        
        return budget_items
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing budget file: {str(e)}")

@router.post("/analyze")
async def analyze_budget_file(
    project_id: str = Form(...),
    file: UploadFile = File(...)
):
    """Analyze Excel file and suggest worksheet and column mappings"""
    try:
        # Debug: Log file details
        print(f"Analyzing file: {file.filename}, MIME type: {file.content_type}")
        # Validate file type - be more permissive with Excel formats
        allowed_types = [
            'text/csv', 
            'application/csv',
            'application/vnd.ms-excel', 
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/x-excel',
            'application/excel',
            'application/x-msexcel'
        ]
        
        # Also check file extension as fallback
        file_ext = file.filename.lower().split('.')[-1] if file.filename else ''
        allowed_extensions = ['csv', 'xlsx', 'xls']
        
        if file.content_type not in allowed_types and file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"File must be CSV or Excel format. Detected: {file.content_type}, Extension: {file_ext}"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Check file size
        max_size = int(os.getenv('MAX_FILE_SIZE', 10485760))
        if len(file_content) > max_size:
            raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
        
        # For CSV files, simple analysis
        if file.content_type == 'text/csv':
            parser = ExcelBudgetParser()
            df = pd.read_csv(io.StringIO(file_content.decode('utf-8')))
            suggestions = parser._suggest_columns(df)
            
            return {
                "file_name": file.filename,
                "file_type": "csv",
                "total_sheets": 1,
                "sheet_analysis": [{
                    "sheet_name": "CSV Data",
                    "score": 50,
                    "row_count": len(df),
                    "column_count": len(df.columns),
                    "suggested_columns": suggestions,
                    "preview": df.head(3).fillna('').to_dict('records')
                }],
                "recommended_sheet": "CSV Data"
            }
        
        # For Excel files, full multi-tab analysis
        parser = ExcelBudgetParser()
        try:
            analysis = parser.analyze_workbook(file_content)
            print(f"Analysis completed successfully: {len(analysis.get('sheet_analysis', []))} sheets found")
            
            return {
                "file_name": file.filename,
                "file_type": "excel",
                **analysis
            }
        except Exception as parse_error:
            print(f"Excel parsing error: {str(parse_error)}")
            raise HTTPException(status_code=500, detail=f"Excel parsing failed: {str(parse_error)}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"General error in analyze_budget_file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error analyzing file: {str(e)}")

@router.post("/upload")
async def upload_budget(
    project_id: str = Form(...),
    sheet_name: str = Form(...),
    column_mapping: Optional[str] = Form(None),  # JSON string of column mappings
    file: UploadFile = File(...)
):
    """Upload and parse budget with specific sheet and column mappings"""
    try:
        print(f"Upload request - Project: {project_id}, Sheet: {sheet_name}")
        print(f"Column mapping: {column_mapping}")
        print(f"File: {file.filename}")
        # Read file content
        file_content = await file.read()
        
        # Parse column mapping if provided
        import json
        mapping = json.loads(column_mapping) if column_mapping else None
        
        # Use intelligent parser
        parser = ExcelBudgetParser()
        
        if file.content_type == 'text/csv':
            # For CSV, parse directly
            budget_items = parse_budget_csv(file_content)
        else:
            # For Excel, use selected sheet and mapping
            try:
                print(f"Parsing sheet '{sheet_name}' with mapping: {mapping}")
                budget_items = parser.parse_selected_sheet(file_content, sheet_name, mapping)
                print(f"Successfully parsed {len(budget_items)} budget items")
            except Exception as parse_error:
                print(f"Parsing error: {str(parse_error)}")
                raise HTTPException(status_code=400, detail=f"Failed to parse sheet: {str(parse_error)}")
        
        if not budget_items:
            raise HTTPException(status_code=400, detail="No valid budget items found in selected sheet")
        
        # Get Supabase client and store data (same as before)
        supabase = get_supabase_client()
        
        # Verify project exists
        project_check = supabase.table("projects").select("id").eq("id", project_id).execute()
        if not project_check.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Store file metadata
        file_id = str(uuid.uuid4())
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
        
        # Insert budget items
        for item in budget_items:
            item["project_id"] = project_id
            item["id"] = str(uuid.uuid4())
        
        supabase.table("budget_items").insert(budget_items).execute()
        
        # Log action
        audit_log = {
            "project_id": project_id,
            "user_id": None,
            "action": "budget_uploaded",
            "entity_type": "budget",
            "entity_id": file_id,
            "details": {
                "file_name": file.filename,
                "sheet_name": sheet_name,
                "items_count": len(budget_items),
                "file_size": len(file_content),
                "column_mapping": mapping
            }
        }
        
        supabase.table("audit_logs").insert(audit_log).execute()
        
        return {
            "message": "Budget uploaded successfully",
            "file_id": file_id,
            "sheet_name": sheet_name,
            "items_processed": len(budget_items),
            "preview": budget_items[:10]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/preview/{project_id}")
async def get_budget_preview(project_id: str):
    """Get budget items preview for a project"""
    try:
        supabase = get_supabase_client()
        
        result = supabase.table("budget_items")\
            .select("*")\
            .eq("project_id", project_id)\
            .order("division", desc=False)\
            .limit(10)\
            .execute()
        
        return {
            "project_id": project_id,
            "items": result.data,
            "total_items": len(result.data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching budget preview: {str(e)}")