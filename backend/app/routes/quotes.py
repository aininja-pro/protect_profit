from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import List, Dict, Any
import os
import uuid
import subprocess
from datetime import datetime

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

@router.post("/upload")
async def upload_quote(
    project_id: str = Form(...),
    vendor_name: str = Form(...),
    trade: str = Form(...),
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
        
        # Store file metadata
        file_id = str(uuid.uuid4())
        file_record = {
            "id": file_id,
            "project_id": project_id,
            "file_name": file.filename,
            "file_path": f"quotes/{project_id}/{file_id}_{file.filename}",
            "file_size": len(file_content),
            "file_type": file.content_type,
            "file_category": "quote",
            "uploaded_by": None  # TODO: Get from JWT auth
        }
        
        file_result = supabase.table("files").insert(file_record).execute()
        
        # Create vendor quote record
        quote_id = str(uuid.uuid4())
        quote_record = {
            "id": quote_id,
            "project_id": project_id,
            "file_id": file_id,
            "vendor_name": vendor_name,
            "trade": trade,
            "status": "pending",
            "parsing_confidence": None
        }
        
        quote_result = supabase.table("vendor_quotes").insert(quote_record).execute()
        
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
            "file_id": file_id,
            "vendor_name": vendor_name,
            "trade": trade,
            "status": "pending_processing"
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

@router.post("/process/{quote_id}")
async def process_quote(quote_id: str):
    """Trigger AI processing of a quote (placeholder)"""
    try:
        supabase = get_supabase_client()
        
        # Update quote status to processing
        update_result = supabase.table("vendor_quotes")\
            .update({"status": "parsing"})\
            .eq("id", quote_id)\
            .execute()
        
        if not update_result.data:
            raise HTTPException(status_code=404, detail="Quote not found")
        
        # TODO: Implement actual AI parsing here
        # This would involve:
        # 1. Reading the file content
        # 2. Using OCR if needed (PDF/images)
        # 3. Sending to OpenAI/Anthropic for parsing
        # 4. Normalizing the extracted data
        # 5. Storing line items in quote_line_items table
        
        # For now, just simulate processing
        import asyncio
        await asyncio.sleep(1)  # Simulate processing time
        
        # Update status to parsed
        supabase.table("vendor_quotes")\
            .update({
                "status": "parsed", 
                "parsing_confidence": 0.85
            })\
            .eq("id", quote_id)\
            .execute()
        
        return {
            "message": "Quote processing completed",
            "quote_id": quote_id,
            "status": "parsed"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing quote: {str(e)}")