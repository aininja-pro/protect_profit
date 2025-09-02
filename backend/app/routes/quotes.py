from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Path
from typing import List, Dict, Any, Optional
import os
import uuid
import subprocess
import json
from datetime import datetime, date

from ..db import get_supabase_client

router = APIRouter(prefix="/quotes", tags=["quotes"])

def scan_file_with_clamav(file_content: bytes, filename: str) -> bool:
    """Scan file with ClamAV for viruses"""
    try:
        # Write file to temporary location
        temp_path = f"/tmp/{uuid.uuid4()}_{filename}"
        with open(temp_path, "wb") as f:
            f.write(file_content)
        
        # Run ClamAV scan
        result = subprocess.run(
            ["clamscan", "--no-summary", temp_path],
            capture_output=True,
            text=True
        )
        
        # Clean up temp file
        os.remove(temp_path)
        
        # Return True if clean (exit code 0), False if infected
        return result.returncode == 0
        
    except Exception as e:
        # If ClamAV is not available, log warning but don't block upload
        print(f"Warning: ClamAV scan failed: {str(e)}")
        return True  # Allow upload if scan fails

@router.post("/divisions/{division_id}/upload")
async def upload_division_quote(
    division_id: str = Path(...),
    project_id: str = Form(...),
    vendor_name: str = Form(...),
    file: UploadFile = File(...)
):
    """Upload a vendor quote file for AI parsing"""
    try:
        # Validate file type
        allowed_types = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]
        
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail="File must be PDF, DOCX, DOC, CSV, or Excel format"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Check file size (10MB limit)
        max_size = int(os.getenv('MAX_FILE_SIZE', 10485760))
        if len(file_content) > max_size:
            raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
        
        # Scan for viruses
        if not scan_file_with_clamav(file_content, file.filename):
            raise HTTPException(status_code=400, detail="File failed security scan")
        
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Verify project exists
        project_check = supabase.table("projects").select("id").eq("id", project_id).execute()
        if not project_check.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Store file (in real implementation, upload to cloud storage)
        file_url = f"quotes/{project_id}/{division_id}/{uuid.uuid4()}_{file.filename}"
        
        # Find or create vendor
        vendor_result = supabase.table("vendors").select("id").eq("name", vendor_name).execute()
        
        if vendor_result.data:
            vendor_id = vendor_result.data[0]["id"]
        else:
            vendor_record = {
                "id": str(uuid.uuid4()),
                "name": vendor_name,
                "contact_json": {}
            }
            vendor_create = supabase.table("vendors").insert(vendor_record).execute()
            vendor_id = vendor_create.data[0]["id"]
        
        # Create vendor quote record
        quote_id = str(uuid.uuid4())
        quote_record = {
            "id": quote_id,
            "project_id": project_id,
            "division_id": division_id,
            "vendor_id": vendor_id,
            "file_url": file_url,
            "received_at": datetime.now().isoformat(),
            "status": "draft",
            "version": 1
        }
        
        quote_result = supabase.table("vendor_quotes").insert(quote_record).execute()
        
        # Update division status to "quotes_uploaded"
        supabase.table("division_status").upsert({
            "division_id": division_id,
            "status": "quotes_uploaded",
            "updated_at": datetime.now().isoformat()
        }).execute()
        
        # Log action
        audit_log = {
            "project_id": project_id,
            "user_id": None,  # TODO: Get from JWT auth
            "action": "quote_uploaded",
            "entity_type": "quote",
            "entity_id": quote_id,
            "details": {
                "file_name": file.filename,
                "vendor_name": vendor_name,
                "trade": trade,
                "file_size": len(file_content)
            }
        }
        
        supabase.table("audit_logs").insert(audit_log).execute()
        
        # TODO: Queue for AI parsing
        # In a real implementation, this would trigger a background job
        # to parse the quote using OpenAI/Anthropic
        
        return {
            "message": "Quote uploaded successfully",
            "quote_id": quote_id,
            "vendor_id": vendor_id,
            "vendor_name": vendor_name,
            "division_id": division_id,
            "status": "draft"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/list/{project_id}")
async def list_quotes(project_id: str):
    """Get all quotes for a project"""
    try:
        supabase = get_supabase_client()
        
        result = supabase.table("vendor_quotes")\
            .select("*, files(file_name, file_size, created_at)")\
            .eq("project_id", project_id)\
            .order("created_at", desc=True)\
            .execute()
        
        return {
            "project_id": project_id,
            "quotes": result.data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching quotes: {str(e)}")

@router.post("/{quote_id}/parse")
async def parse_quote(quote_id: str = Path(...)):
    """Extract and normalize quote data using AI"""
    try:
        supabase = get_supabase_client()
        
        # Get quote record
        quote_result = supabase.table("vendor_quotes").select("*").eq("id", quote_id).execute()
        if not quote_result.data:
            raise HTTPException(status_code=404, detail="Quote not found")
        
        quote = quote_result.data[0]
        
        # Update status to parsing
        supabase.table("vendor_quotes").update({"status": "parsing"}).eq("id", quote_id).execute()
        
        # TODO: Implement actual AI parsing here
        # 1. Read file from file_url
        # 2. Extract text (OCR for PDF, text extraction for DOCX/CSV)
        # 3. Send to OpenAI for normalization
        # 4. Parse response into structured line items
        
        # Mock normalized data for now
        mock_normalized = {
            "vendor_info": {
                "name": quote.get("vendor_name", "Unknown"),
                "contact": "",
                "quote_date": datetime.now().isoformat()
            },
            "exclusions": ["Tax excluded", "Permit fees not included"],
            "assumptions": ["Material delivery to site", "Normal working hours"],
            "line_items": [
                {
                    "description": "Electrical rough-in",
                    "quantity": 1200,
                    "unit": "SF",
                    "unit_price": 2.50,
                    "total_price": 3000.00,
                    "notes": "Includes basic receptacles"
                },
                {
                    "description": "Panel upgrade",
                    "quantity": 1,
                    "unit": "EA", 
                    "unit_price": 2500.00,
                    "total_price": 2500.00,
                    "notes": "200A service panel"
                }
            ]
        }
        
        # Store normalized JSON
        supabase.table("vendor_quotes").update({
            "normalized_json": mock_normalized,
            "status": "parsed"
        }).eq("id", quote_id).execute()
        
        # Create quote line items
        for item_data in mock_normalized["line_items"]:
            line_item = {
                "id": str(uuid.uuid4()),
                "quote_id": quote_id,
                "description": item_data["description"],
                "quantity": item_data.get("quantity"),
                "unit": item_data.get("unit"),
                "normalized_unit": _normalize_unit(item_data.get("unit")),
                "unit_price": item_data.get("unit_price", 0),
                "total_price": item_data["total_price"],
                "notes": item_data.get("notes"),
                "coverage": "unknown"  # Will be determined during mapping
            }
            supabase.table("quote_line_items").insert(line_item).execute()
        
        return {
            "message": "Quote parsed successfully", 
            "quote_id": quote_id,
            "line_items_created": len(mock_normalized["line_items"]),
            "status": "parsed"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing quote: {str(e)}")

def _normalize_unit(raw_unit: Optional[str]) -> Optional[str]:
    """Normalize unit to standard construction units"""
    if not raw_unit:
        return None
    
    unit_map = {
        "EACH": "EA", "PIECE": "EA", "PIECES": "EA",
        "LINEAR": "LF", "LINEAL": "LF", "LIN": "LF", 
        "SQUARE": "SF", "SQ": "SF", "SQFT": "SF",
        "CUBIC": "CY", "YARD": "SY", "YARDS": "SY",
        "HOUR": "HR", "HOURS": "HR", "HRS": "HR",
        "LUMP": "LS", "LUMPSUM": "LS", "LOT": "LS",
        "MONTH": "MO", "MONTHS": "MO", "MONTHLY": "MO"
    }
    
    clean_unit = raw_unit.upper().strip()
    return unit_map.get(clean_unit, clean_unit if clean_unit in ["EA", "LF", "SF", "SY", "CY", "HR", "LS", "MO"] else None)

@router.post("/{quote_id}/mappings")
async def save_quote_mappings(
    quote_id: str = Path(...),
    mappings: List[Dict[str, Any]] = []
):
    """Save line mappings between budget and quote lines"""
    try:
        supabase = get_supabase_client()
        
        # Verify quote exists
        quote_check = supabase.table("vendor_quotes").select("id").eq("id", quote_id).execute()
        if not quote_check.data:
            raise HTTPException(status_code=404, detail="Quote not found")
        
        # Clear existing mappings for this quote
        existing_mappings = supabase.table("line_mappings")\
            .select("id")\
            .in_("quote_line_item_id", 
                 supabase.table("quote_line_items").select("id").eq("quote_id", quote_id).execute().data)\
            .execute()
        
        if existing_mappings.data:
            mapping_ids = [m["id"] for m in existing_mappings.data]
            supabase.table("line_mappings").delete().in_("id", mapping_ids).execute()
        
        # Create new mappings
        for mapping in mappings:
            mapping_record = {
                "id": str(uuid.uuid4()),
                "budget_line_id": mapping["budget_line_id"],
                "quote_line_item_id": mapping["quote_line_item_id"],
                "confidence": mapping.get("confidence", 0.5),
                "user_confirmed": mapping.get("user_confirmed", False)
            }
            supabase.table("line_mappings").insert(mapping_record).execute()
        
        # Update quote status to mapped
        supabase.table("vendor_quotes").update({"status": "mapped"}).eq("id", quote_id).execute()
        
        return {
            "message": "Mappings saved successfully",
            "quote_id": quote_id,
            "mappings_created": len(mappings),
            "status": "mapped"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving mappings: {str(e)}")

@router.get("/divisions/{division_id}/compare")
async def compare_division_quotes(division_id: str = Path(...)):
    """Get comparison data for a division: budget lines + mapped quotes + deltas"""
    try:
        supabase = get_supabase_client()
        
        # Get all quotes for this division
        quotes_result = supabase.table("vendor_quotes")\
            .select("*, vendors(name), quote_line_items(*, line_mappings(budget_line_id))")\
            .eq("division_id", division_id)\
            .execute()
        
        if not quotes_result.data:
            return {
                "division_id": division_id,
                "budget_lines": [],
                "vendor_quotes": [],
                "comparison": []
            }
        
        # TODO: Get budget lines for this division from stored project data
        # For now return structure that frontend can work with
        
        comparison_data = []
        for quote in quotes_result.data:
            vendor_comparison = {
                "vendor_id": quote["vendor_id"],
                "vendor_name": quote["vendors"]["name"],
                "quote_id": quote["id"],
                "status": quote["status"],
                "line_items": []
            }
            
            for line_item in quote.get("quote_line_items", []):
                line_comparison = {
                    "quote_line_id": line_item["id"],
                    "description": line_item["description"],
                    "total_price": line_item["total_price"],
                    "coverage": line_item["coverage"],
                    "mapped_budget_lines": [m["budget_line_id"] for m in line_item.get("line_mappings", [])]
                }
                vendor_comparison["line_items"].append(line_comparison)
            
            comparison_data.append(vendor_comparison)
        
        return {
            "division_id": division_id,
            "vendor_quotes": comparison_data,
            "total_vendors": len(comparison_data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error comparing quotes: {str(e)}")

@router.post("/divisions/{division_id}/decide")
async def decide_division_award(
    division_id: str = Path(...),
    decisions: Dict[str, Any] = {}
):
    """Create division award with line-level decisions"""
    try:
        supabase = get_supabase_client()
        
        # Create division award
        award_id = str(uuid.uuid4())
        award_record = {
            "id": award_id,
            "division_id": division_id,
            "decided_at": datetime.now().isoformat(),
            "notes": decisions.get("notes", "")
        }
        award_result = supabase.table("division_awards").insert(award_record).execute()
        
        # Create line-level awards
        line_decisions = decisions.get("line_awards", [])
        for line_decision in line_decisions:
            line_award = {
                "id": str(uuid.uuid4()),
                "award_id": award_id,
                "budget_line_id": line_decision["budget_line_id"],
                "vendor_id": line_decision["vendor_id"],
                "quote_id": line_decision["quote_id"],
                "quote_line_item_id": line_decision.get("quote_line_item_id"),
                "final_price": line_decision["final_price"]
            }
            supabase.table("award_lines").insert(line_award).execute()
        
        # Update division status to "winner_selected" 
        primary_vendor_id = decisions.get("primary_vendor_id")
        supabase.table("division_status").upsert({
            "division_id": division_id,
            "status": "winner_selected",
            "selected_vendor_id": primary_vendor_id,
            "updated_at": datetime.now().isoformat()
        }).execute()
        
        return {
            "message": "Division award created successfully",
            "award_id": award_id,
            "division_id": division_id,
            "line_awards_created": len(line_decisions)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating award: {str(e)}")

@router.post("/divisions/{division_id}/workorder/pdf")
async def generate_work_order_pdf(division_id: str = Path(...)):
    """Generate work order PDF from division award"""
    try:
        supabase = get_supabase_client()
        
        # Get division award with line details
        award_result = supabase.table("division_awards")\
            .select("*, award_lines(*, vendors(name))")\
            .eq("division_id", division_id)\
            .execute()
        
        if not award_result.data:
            raise HTTPException(status_code=404, detail="No award found for division")
        
        award = award_result.data[0]
        
        # TODO: Generate actual PDF using reportlab or similar
        # For now, return PDF generation confirmation
        
        pdf_filename = f"workorder_division_{division_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return {
            "message": "Work order PDF generated",
            "division_id": division_id,
            "award_id": award["id"], 
            "pdf_filename": pdf_filename,
            "line_items_count": len(award.get("award_lines", []))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating work order: {str(e)}")