from fastapi import APIRouter, HTTPException
from ..db import get_supabase_client

router = APIRouter(prefix="/debug", tags=["debug"])

@router.get("/latest-analysis/{project_id}")
async def get_latest_analysis(project_id: str):
    """Get the raw AI analysis JSON from the latest upload"""
    try:
        supabase = get_supabase_client()
        
        # Get the most recent audit log with AI analysis details
        result = supabase.table("audit_logs")\
            .select("*")\
            .eq("project_id", project_id)\
            .eq("action", "ai_budget_uploaded")\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="No AI analysis found")
        
        return {
            "latest_analysis": result.data[0],
            "analysis_details": result.data[0].get("details", {})
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching analysis: {str(e)}")

@router.get("/budget-summary/{project_id}")  
async def get_budget_summary(project_id: str):
    """Get budget summary grouped by division"""
    try:
        supabase = get_supabase_client()
        
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
                    'total': 0,
                    'count': 0
                }
            
            divisions[div_code]['items'].append(item)
            divisions[div_code]['count'] += 1
            if item.get('total_cost'):
                divisions[div_code]['total'] += item['total_cost']
                total_cost += item['total_cost']
        
        return {
            "project_id": project_id,
            "divisions": [
                {
                    "code": code,
                    "name": f"Division {code}",
                    "item_count": div_data['count'],
                    "total": round(div_data['total'], 2),
                    "sample_items": [item['description'] for item in div_data['items'][:3]]
                }
                for code, div_data in sorted(divisions.items())
            ],
            "total_items": len(result.data),
            "grand_total": round(total_cost, 2),
            "raw_data_sample": result.data[:5]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating summary: {str(e)}")