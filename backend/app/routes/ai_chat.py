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

@router.post("/project-analysis")
async def ai_project_analysis(chat_request: ChatMessage):
    """Handle comprehensive project analysis with full context"""
    try:
        openai_api_key = os.getenv('OPENAI_API_KEY')
        if not openai_api_key:
            return {
                "ai_response": generate_intelligent_fallback(chat_request.message, chat_request.context),
                "context_used": chat_request.context
            }
        
        # Build comprehensive project analysis prompt
        system_prompt = build_project_analysis_prompt(chat_request.context)
        
        # Call OpenAI with enhanced context
        client = OpenAI(api_key=openai_api_key)
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": chat_request.message}
            ],
            max_tokens=800,
            temperature=0.2  # Lower temperature for more consistent analysis
        )
        
        return {
            "ai_response": response.choices[0].message.content,
            "context_used": chat_request.context,
            "openai_used": True
        }
        
    except Exception as e:
        # Enhanced fallback with project data analysis
        return {
            "ai_response": generate_intelligent_fallback(chat_request.message, chat_request.context),
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

def build_project_analysis_prompt(context: Dict[str, Any]) -> str:
    """Build comprehensive project analysis prompt with full context"""
    
    base_prompt = """You are an expert construction procurement analyst with 25+ years of experience. You help project managers make optimal vendor selection and award decisions through comprehensive data analysis.

You have access to complete project data including:
- Project budget breakdown by division
- All vendor quotes with line-item details
- Pricing comparisons and variance analysis
- Vendor performance indicators
- Risk assessment factors

Your responses should be:
- **Data-driven** with specific numbers and percentages
- **Actionable** with clear recommendations
- **Risk-aware** highlighting potential issues
- **Strategic** considering long-term project success
- **Concise** but comprehensive

Use markdown formatting for clarity. Include specific dollar amounts, percentages, and vendor names when relevant."""

    project_data = context.get('detailedContext', {})
    project_name = context.get('projectName', 'Unknown Project')
    project_totals = context.get('projectTotals', {})
    
    # Build comprehensive context
    project_context = f"""

**CURRENT PROJECT: {project_name}**
Project ID: {context.get('projectId')}
Total Budget: ${project_totals.get('jobTotal', 0):,}
Project Subtotal: ${project_totals.get('projectSubtotal', 0):,}
Overhead & Profit: ${project_totals.get('overheadAndProfit', 0):,}

**DIVISIONS & QUOTES:**"""

    divisions = context.get('divisions', [])
    division_statuses = context.get('divisionStatuses', {})
    
    for division in divisions:
        div_code = division.get('divisionCode', 'Unknown')
        div_name = division.get('divisionName', 'Unknown')
        div_budget = division.get('divisionTotal', 0)
        status_info = division_statuses.get(div_code, {})
        quote_count = status_info.get('quote_count', 0)
        
        project_context += f"""
- Division {div_code} - {div_name}: ${div_budget:,} budget, {quote_count} quotes received"""

    # Add detailed comparison data if available
    division_comparisons = project_data.get('divisionComparisons', [])
    if division_comparisons:
        project_context += "\n\n**DETAILED QUOTE ANALYSIS:**"
        
        for comp in division_comparisons:
            div_code = comp.get('divisionCode')
            div_name = comp.get('divisionName')
            budget = comp.get('budget', 0)
            quotes = comp.get('quotes', [])
            division_quotes = comp.get('divisionQuotes', [])
            subcategory_quotes = comp.get('subcategoryQuotes', [])
            
            if quotes:
                project_context += f"\n\n{div_code} - {div_name} (${budget:,} budget):"
                project_context += f"\n  Total Quotes: {len(quotes)} ({len(division_quotes)} division-level, {len(subcategory_quotes)} subcategory-level)"
                
                # Process division-level quotes
                if division_quotes:
                    project_context += "\n\n  **Division-Level Quotes:**"
                    for quote in division_quotes:
                        vendor_name = quote.get('vendor_name', 'Unknown')
                        total_quote = sum(item.get('total_price', 0) for item in quote.get('line_items', []))
                        variance = total_quote - budget
                        variance_pct = (variance / budget * 100) if budget > 0 else 0
                        
                        project_context += f"""
    • {vendor_name}: ${total_quote:,} ({variance_pct:+.1f}% vs budget)"""
                        
                        for item in quote.get('line_items', []):
                            item_desc = item.get('description', 'Unknown item')[:50]
                            item_price = item.get('total_price', 0)
                            coverage = item.get('coverage', 'unknown')
                            project_context += f"""
      - {item_desc}: ${item_price:,} ({coverage})"""
                
                # Process subcategory-level quotes
                if subcategory_quotes:
                    project_context += "\n\n  **Subcategory-Level Quotes:**"
                    for quote in subcategory_quotes:
                        vendor_name = quote.get('vendor_name', 'Unknown')
                        subcategory_id = quote.get('subcategory_id', 'Unknown')
                        scope_type = quote.get('scope_type', 'Unknown scope')
                        
                        # Calculate total from normalized_json if available
                        total_quote = 0
                        if quote.get('normalized_json') and quote['normalized_json'].get('pricing_summary'):
                            total_quote = quote['normalized_json']['pricing_summary'].get('total_amount', 0)
                        
                        project_context += f"""
    • {vendor_name} (Subcategory {subcategory_id}): ${total_quote:,} - {scope_type}"""

    project_context += "\n\nProvide specific insights, recommendations, and analysis based on this comprehensive project data."
    
    return base_prompt + project_context

def generate_intelligent_fallback(message: str, context: Dict[str, Any]) -> str:
    """Generate intelligent fallback responses using available project data"""
    
    message_lower = message.lower()
    project_name = context.get('projectName', 'your project')
    total_budget = context.get('projectTotals', {}).get('jobTotal', 0)
    total_quotes = context.get('totalQuotes', 0)
    divisions = context.get('divisions', [])
    division_statuses = context.get('divisionStatuses', {})
    
    # Vendor/pricing analysis
    if any(word in message_lower for word in ['vendor', 'price', 'cost', 'quote', 'value']):
        divisions_with_quotes = sum(1 for status in division_statuses.values() if status.get('quote_count', 0) > 0)
        
        response = f"""**Vendor & Pricing Analysis for {project_name}**

📊 **Current Status:**
• Total Project Budget: ${total_budget:,}
• Quotes Received: {total_quotes} across {divisions_with_quotes} divisions
• Divisions: {len(divisions)} total

**Division Breakdown:**"""
        
        for division in divisions:
            div_code = division.get('divisionCode')
            div_name = division.get('divisionName')
            div_budget = division.get('divisionTotal', 0)
            status = division_statuses.get(div_code, {})
            quote_count = status.get('quote_count', 0)
            
            response += f"""
• **Division {div_code} - {div_name}**: ${div_budget:,} budget, {quote_count} quotes"""

        response += """\n\n🤖 **AI Analysis Currently Unavailable**
The detailed AI analysis service is temporarily offline, but you have access to all project data. Try your question again in a moment for comprehensive vendor comparisons and recommendations."""
        
        return response
    
    # Budget/variance analysis  
    elif any(word in message_lower for word in ['budget', 'variance', 'over', 'under', 'risk']):
        response = f"""**Budget Analysis for {project_name}**

💰 **Budget Overview:**
• Project Subtotal: ${context.get('projectTotals', {}).get('projectSubtotal', 0):,}
• Overhead & Profit: ${context.get('projectTotals', {}).get('overheadAndProfit', 0):,}
• **Total Budget: ${total_budget:,}**

**Risk Assessment:**"""
        
        divisions_without_quotes = len(divisions) - sum(1 for status in division_statuses.values() if status.get('quote_count', 0) > 0)
        
        if divisions_without_quotes > 0:
            response += f"""
⚠️ **High Risk**: {divisions_without_quotes} divisions still need quotes
"""
        
        for division in divisions:
            div_code = division.get('divisionCode')
            div_name = division.get('divisionName')
            div_budget = division.get('divisionTotal', 0)
            quote_count = division_statuses.get(div_code, {}).get('quote_count', 0)
            
            if quote_count == 0:
                response += f"""
• Division {div_code} ({div_name}): ${div_budget:,} - **NO QUOTES** ❌"""
            else:
                response += f"""
• Division {div_code} ({div_name}): ${div_budget:,} - {quote_count} quotes ✅"""

        response += """\n\n🤖 **Detailed Analysis Pending**
AI service reconnecting... Try again shortly for variance analysis and specific risk recommendations."""
        
        return response
    
    # Award/recommendation strategy
    elif any(word in message_lower for word in ['award', 'recommend', 'strategy', 'decision', 'select']):
        response = f"""**Award Strategy for {project_name}**

🎯 **Procurement Status:**"""
        
        ready_for_award = []
        need_quotes = []
        
        for division in divisions:
            div_code = division.get('divisionCode')
            div_name = division.get('divisionName')
            quote_count = division_statuses.get(div_code, {}).get('quote_count', 0)
            
            if quote_count > 0:
                ready_for_award.append(f"Division {div_code} ({div_name}): {quote_count} quotes")
            else:
                need_quotes.append(f"Division {div_code} ({div_name})")
        
        if ready_for_award:
            response += f"""

✅ **Ready for Award Decision:**
{chr(10).join(f"• {item}" for item in ready_for_award)}"""
        
        if need_quotes:
            response += f"""

⏳ **Still Need Quotes:**
{chr(10).join(f"• {item}" for item in need_quotes)}"""

        response += f"""

📋 **Next Steps:**
1. Complete quote collection for remaining divisions
2. Perform detailed vendor analysis and comparison
3. Execute award strategy based on value optimization

🤖 **AI Recommendations Coming Soon**
The AI service will provide specific award strategies when reconnected."""
        
        return response
    
    # General fallback
    else:
        return f"""I understand you're asking about "{message}" for {project_name}.

**Available Project Data:**
• Budget: ${total_budget:,} across {len(divisions)} divisions  
• Quotes: {total_quotes} total received
• Status: Ready for comprehensive analysis

🤖 **AI Analysis Service Reconnecting**
I have access to all your project data including budgets, quotes, vendor comparisons, and line-item details. Please try your question again in a moment for detailed insights and recommendations.

**Quick Questions I Can Help With:**
• Vendor performance and value analysis
• Budget variance and risk assessment  
• Award strategy and recommendations
• Pricing comparisons and negotiations"""