from fastapi import APIRouter, HTTPException, Path
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
        
        # Get budget summary - sum all budget items
        budget_result = supabase.table("budget_items")\
            .select("total_cost")\
            .eq("project_id", project_id)\
            .execute()
        
        total_budget = sum(item.get("total_cost", 0) for item in budget_result.data) if budget_result.data else 0
        
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

@router.get("/{project_id}/divisions")
async def get_project_divisions(project_id: str = Path(...)):
    """Get divisions and budget items for a project"""
    try:
        supabase = get_supabase_client()
        
        # Get budget items for this project, grouped by division
        budget_items = supabase.table("budget_items")\
            .select("*")\
            .eq("project_id", project_id)\
            .order("division")\
            .execute()
        
        if not budget_items.data:
            return {
                "project_id": project_id,
                "divisions": [],
                "message": "No budget data found for this project"
            }
        
        # Group items by division
        divisions_map = {}
        for item in budget_items.data:
            division_code = item["division"]
            if division_code not in divisions_map:
                # Extract division name from notes field (format: "Division: General Conditions | ...")
                division_name = get_division_name(division_code)  # Default fallback
                if item.get("notes") and "Division: " in item["notes"]:
                    try:
                        division_name = item["notes"].split("Division: ")[1].split(" |")[0].strip()
                    except (IndexError, AttributeError):
                        pass  # Use fallback if parsing fails
                
                divisions_map[division_code] = {
                    "divisionCode": division_code,
                    "divisionName": division_name,
                    "items": [],
                    "divisionTotal": 0
                }
            
            # Add item to division
            budget_line = {
                "lineId": f"{division_code}-{item['description'].lower().replace(' ', '-')[:20]}-{item['id']}",
                "description": item["description"],  # Use description field for compatibility 
                "tradeDescription": item["description"],  # Keep for backward compatibility
                "quantity": item.get("quantity"),
                "unit": item.get("unit"), 
                "totalCost": item["total_cost"] or 0,
                "total_cost": item["total_cost"] or 0,  # Add for compatibility with new format
                "subcategory_code": item.get("subcategory_code"),
                "subcategory_name": item.get("subcategory_name")
            }
            divisions_map[division_code]["items"].append(budget_line)
            divisions_map[division_code]["divisionTotal"] += budget_line["totalCost"]
        
        # Convert to list and sort by division code
        divisions = list(divisions_map.values())
        divisions.sort(key=lambda d: d["divisionCode"])
        
        return {
            "project_id": project_id,
            "divisions": divisions,
            "total_divisions": len(divisions),
            "total_items": len(budget_items.data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get project divisions: {str(e)}")

def get_division_name(division_code: str) -> str:
    """Get division name - use actual names from Notine project for now"""
    # Use the actual division names from the parsed Excel
    division_names = {
        "01": "General Conditions",
        "02": "Site/Demo", 
        "03": "Excavation/Landscape",
        "04": "Concrete/Masonry",
        "05": "Rough Carpentry",
        "06": "Doors/Windows",
        "07": "Mechanical",
        "08": "Electrical",
        "09": "Plumbing", 
        "10": "Wall/Ceiling Coverings",
        "11": "Finish Carpentry",
        "12": "Cabinets/Vanities/Tops",
        "13": "Flooring/Tile",
        "14": "Specialties",
        "15": "Decking", 
        "16": "Fencing",
        "17": "Exterior Facade",
        "18": "Soffit/Fascia/Gutters",
        "19": "Roofing"
    }
    return division_names.get(division_code.zfill(2), f"Division {division_code}")