from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from pydantic import BaseModel
import os
from openai import OpenAI

router = APIRouter(prefix="/ai", tags=["ai-chat"])

class ChatMessage(BaseModel):
    message: str
    context: Dict[str, Any]

@router.post("/chat")
async def ai_chat(chat_request: ChatMessage):
    """Handle AI chat with context awareness"""
    try:
        openai_api_key = os.getenv('OPENAI_API_KEY')
        if not openai_api_key:
            return {
                "ai_response": f"I understand your question about '{chat_request.message}'. AI chat is ready but OpenAI API key not configured. I can help with context-aware responses once connected.",
                "context_used": chat_request.context
            }
        
        # Build context-aware system prompt
        system_prompt = build_system_prompt(chat_request.context)
        
        # Call OpenAI
        client = OpenAI(api_key=openai_api_key)
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": chat_request.message}
            ],
            max_tokens=500,
            temperature=0.3
        )
        
        return {
            "ai_response": response.choices[0].message.content,
            "context_used": chat_request.context,
            "openai_used": True
        }
        
    except Exception as e:
        # Fallback response
        return {
            "ai_response": f"I understand your question about '{chat_request.message}'. Based on your {chat_request.context.get('type', 'project')} context, I can help analyze that. (AI temporarily unavailable: {str(e)})",
            "context_used": chat_request.context,
            "error": str(e)
        }

def build_system_prompt(context: Dict[str, Any]) -> str:
    """Build context-aware system prompt for AI assistant"""
    
    base_prompt = """You are an expert construction procurement assistant with 20+ years of experience. You help project managers make informed decisions about quotes, vendors, awards, and procurement strategy.

Always provide:
- Specific, actionable recommendations
- Risk analysis and considerations  
- Cost/value trade-offs
- Timeline implications
- Vendor performance insights

Be concise, professional, and focus on helping make the best procurement decisions."""

    context_type = context.get('type', 'project')
    
    if context_type == 'division':
        division_context = f"""
CURRENT CONTEXT: Division {context.get('divisionId')} - {context.get('divisionName', 'Unknown')}
Budget: ${context.get('budget', 0):,}
Division Quotes: {len(context.get('quotes', []))} received
Project ID: {context.get('projectId')}

You have access to all division-level quotes, budget data, and can provide award strategy recommendations for this specific division.
"""
        return base_prompt + division_context
        
    elif context_type == 'subcategory':
        subcategory_context = f"""
CURRENT CONTEXT: {context.get('subcategoryName', 'Unknown Subcategory')}
Parent Division: {context.get('divisionId')}
Subcategory Quotes: {len(context.get('quotes', []))} received
Project ID: {context.get('projectId')}

You have access to all subcategory-level quotes and can provide specific recommendations for this work scope.
"""
        return base_prompt + subcategory_context
        
    else:
        project_context = f"""
CURRENT CONTEXT: Project Overview
Project ID: {context.get('projectId')}

You have access to all project data including divisions, quotes, and overall procurement strategy. Help with high-level procurement planning and decision-making.
"""
        return base_prompt + project_context