from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import uuid
from datetime import datetime

from ..db import get_supabase_client

router = APIRouter(prefix="/projects", tags=["projects"])

class ProjectCreate(BaseModel):
    name: str
    location: Optional[str] = None
    project_type: Optional[str] = None
    target_margin: Optional[float] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    location: Optional[str]
    project_type: Optional[str]
    target_margin: Optional[float]
    status: str
    created_at: str

@router.post("/", response_model=Dict[str, Any])
async def create_project(project: ProjectCreate):
    """Create a new project"""
    try:
        supabase = get_supabase_client()
        
        project_data = {
            "id": str(uuid.uuid4()),
            "name": project.name,
            "location": project.location,
            "project_type": project.project_type,
            "target_margin": project.target_margin,
            "status": "active",
            "created_by": None  # TODO: Get from JWT auth
        }
        
        result = supabase.table("projects").insert(project_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create project")
        
        # Log action
        audit_log = {
            "project_id": project_data["id"],
            "user_id": None,  # TODO: Get from JWT auth
            "action": "project_created",
            "entity_type": "project",
            "entity_id": project_data["id"],
            "details": {
                "name": project.name,
                "location": project.location,
                "type": project.project_type
            }
        }
        
        supabase.table("audit_logs").insert(audit_log).execute()
        
        return {
            "message": "Project created successfully",
            "project": result.data[0]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating project: {str(e)}")

@router.get("/", response_model=List[Dict[str, Any]])
async def list_projects():
    """Get all projects for the current user"""
    try:
        supabase = get_supabase_client()
        
        # TODO: Filter by user access when auth is implemented
        result = supabase.table("projects")\
            .select("*")\
            .order("created_at", desc=True)\
            .execute()
        
        return result.data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching projects: {str(e)}")

@router.get("/{project_id}")
async def get_project(project_id: str):
    """Get a specific project with summary data"""
    try:
        supabase = get_supabase_client()
        
        # Get project details
        project_result = supabase.table("projects")\
            .select("*")\
            .eq("id", project_id)\
            .execute()
        
        if not project_result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project = project_result.data[0]
        
        # Get budget summary
        budget_result = supabase.table("budget_items")\
            .select("total_cost")\
            .eq("project_id", project_id)\
            .execute()
        
        total_budget = sum(item.get("total_cost", 0) for item in budget_result.data)
        
        # Get quotes summary
        quotes_result = supabase.table("vendor_quotes")\
            .select("id, vendor_name, trade, status, total_amount")\
            .eq("project_id", project_id)\
            .execute()
        
        return {
            "project": project,
            "budget_summary": {
                "total_budget": total_budget,
                "items_count": len(budget_result.data)
            },
            "quotes_summary": {
                "total_quotes": len(quotes_result.data),
                "quotes": quotes_result.data
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching project: {str(e)}")