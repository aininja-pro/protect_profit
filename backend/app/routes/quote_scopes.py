from fastapi import APIRouter, HTTPException, Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import uuid
import os
from datetime import datetime

from ..db import get_supabase_client
from ..services.ai_rfq_generator import ai_rfq_generator

router = APIRouter(prefix="/quote-scopes", tags=["quote-scopes"])

class QuoteScopeCreate(BaseModel):
    project_id: str
    division_code: str
    scope_type: str  # 'division', 'subcategory', 'custom'
    scope_items: List[str]  # List of subcategory names or budget item IDs
    description: str
    specifications: Optional[str] = None
    exclusions: Optional[str] = None

class VendorSelection(BaseModel):
    vendor_ids: List[str]
    bid_deadline: str
    additional_notes: Optional[str] = None

@router.post("/")
async def create_quote_scope(scope: QuoteScopeCreate):
    """Create a new quote scope for RFQ generation"""
    try:
        supabase = get_supabase_client()
        
        # Verify project exists
        project_check = supabase.table("projects").select("id").eq("id", scope.project_id).execute()
        if not project_check.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Create scope record
        scope_id = str(uuid.uuid4())
        scope_record = {
            "id": scope_id,
            "project_id": scope.project_id,
            "scope_type": scope.scope_type,
            "scope_items": scope.scope_items,
            "description": scope.description,
            "specifications": scope.specifications,
            "exclusions": scope.exclusions,
            "created_at": datetime.now().isoformat()
        }
        
        result = supabase.table("quote_scopes").insert(scope_record).execute()
        
        return {
            "message": "Quote scope created successfully",
            "scope_id": scope_id,
            "scope_type": scope.scope_type,
            "items_count": len(scope.scope_items)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating quote scope: {str(e)}")

@router.post("/{scope_id}/rfq")
async def generate_rfq(
    scope_id: str = Path(...),
    vendor_selection: VendorSelection = None
):
    """Generate RFQ document and send to selected vendors"""
    try:
        supabase = get_supabase_client()
        
        # Get scope details
        scope_result = supabase.table("quote_scopes").select("*").eq("id", scope_id).execute()
        if not scope_result.data:
            raise HTTPException(status_code=404, detail="Quote scope not found")
        
        scope = scope_result.data[0]
        
        # Get project details for RFQ header
        project_result = supabase.table("projects").select("*").eq("id", scope["project_id"]).execute()
        project = project_result.data[0] if project_result.data else {}
        
        # Generate RFQ document (in real implementation, create PDF/email template)
        rfq_content = _generate_rfq_content(scope, project)
        
        # Create RFQ records for each vendor (if vendors specified)
        rfq_records = []
        if vendor_selection and vendor_selection.vendor_ids:
            for vendor_id in vendor_selection.vendor_ids:
                rfq_id = str(uuid.uuid4())
                rfq_record = {
                    "id": rfq_id,
                    "scope_id": scope_id,
                    "vendor_id": vendor_id,
                    "bid_deadline": vendor_selection.bid_deadline,
                    "status": "sent",
                    "sent_at": datetime.now().isoformat()
                }
                rfq_records.append(rfq_record)
            
            # Bulk insert RFQ records
            if rfq_records:
                supabase.table("rfq_invitations").insert(rfq_records).execute()
        
        return {
            "message": "RFQ generated successfully",
            "scope_id": scope_id,
            "rfq_content": rfq_content,
            "vendors_invited": len(rfq_records),
            "bid_deadline": vendor_selection.bid_deadline if vendor_selection else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating RFQ: {str(e)}")

def _generate_rfq_content(scope: Dict[str, Any], project: Dict[str, Any]) -> str:
    """Generate RFQ document content"""
    
    rfq_number = f"RFQ-{scope['id'][:8].upper()}"
    
    content = f"""
REQUEST FOR QUOTE
{rfq_number}

PROJECT: {project.get('name', 'Construction Project')}
LOCATION: {project.get('location', 'TBD')}

SCOPE OF WORK:
{scope.get('description', '')}

SPECIFICATIONS:
{scope.get('specifications', 'Per plans and specifications')}

EXCLUSIONS:
{scope.get('exclusions', 'None specified')}

BUDGET ITEMS:
{', '.join(scope.get('scope_items', []))}

Please provide:
□ Lump sum pricing for entire scope
□ Itemized breakdown if preferred
□ Timeline for completion
□ Any clarifications or assumptions

Bid deadline: [TO BE SPECIFIED]
Submit bids to: [PROJECT MANAGER EMAIL]

Thank you for your participation.
    """.strip()
    
    return content

@router.get("/project/{project_id}")
async def list_project_scopes(project_id: str = Path(...)):
    """Get all quote scopes for a project"""
    try:
        supabase = get_supabase_client()
        
        result = supabase.table("quote_scopes")\
            .select("*")\
            .eq("project_id", project_id)\
            .order("created_at", desc=True)\
            .execute()
        
        return {
            "project_id": project_id,
            "scopes": result.data,
            "total_scopes": len(result.data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching scopes: {str(e)}")

@router.post("/ai-enhance")
async def enhance_scope_with_ai(request: Dict[str, Any]):
    """Use OpenAI to enhance a scope description into professional RFQ language"""
    try:
        scope_description = request.get('scope_description', '')
        project_context = request.get('project_context', {})
        
        if not scope_description.strip():
            raise HTTPException(status_code=400, detail="Scope description is required")
        
        enhanced_rfq = ai_rfq_generator.generate_rfq(scope_description, project_context)
        
        return {
            "message": "Scope enhanced successfully",
            "original_scope": scope_description,
            "enhanced_rfq": enhanced_rfq,
            "ai_used": bool(os.getenv('OPENAI_API_KEY'))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enhancing scope: {str(e)}")