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

@router.post("/division-analysis")
async def ai_division_analysis(chat_request: ChatMessage):
    """Generate quick division-specific insights for quote comparison"""
    try:
        # Debug what context we're actually receiving
        context = chat_request.context
        print(f"🔍 DIVISION_ANALYSIS_DEBUG: Received context keys: {list(context.keys())}")
        print(f"🔍 DIVISION_ANALYSIS_DEBUG: lineItems: {context.get('lineItems', 'NOT_FOUND')}")
        print(f"🔍 DIVISION_ANALYSIS_DEBUG: totalBudget: {context.get('totalBudget', 'NOT_FOUND')}")
        print(f"🔍 DIVISION_ANALYSIS_DEBUG: quotes count: {len(context.get('quotes', []))}")
        
        openai_api_key = os.getenv('OPENAI_API_KEY')
        if not openai_api_key:
            return {
                "ai_response": generate_division_fallback(chat_request.context),
                "context_used": chat_request.context
            }
        
        # Build division-specific analysis prompt
        system_prompt = build_division_analysis_prompt(chat_request.context)
        print(f"🔍 DIVISION_ANALYSIS_DEBUG: System prompt length: {len(system_prompt)}")
        print(f"🔍 DIVISION_ANALYSIS_DEBUG: System prompt preview: {system_prompt[:500]}...")
        
        # Call OpenAI for quick insights
        client = OpenAI(api_key=openai_api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Use mini for faster, cheaper responses
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Analyze these division quotes and provide strategic insights"}
            ],
            max_tokens=200,  # Keep it concise for the box
            temperature=0.2
        )
        
        return {
            "ai_response": response.choices[0].message.content,
            "context_used": chat_request.context,
            "openai_used": True
        }
        
    except Exception as e:
        return {
            "ai_response": generate_division_fallback(chat_request.context),
            "context_used": chat_request.context,
            "error": str(e)
        }

@router.post("/project-analysis")
async def ai_project_analysis(chat_request: ChatMessage):
    """Handle comprehensive project analysis with full context"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        openai_api_key = os.getenv('OPENAI_API_KEY')
        logger.info(f"OpenAI API key present: {bool(openai_api_key)}")
        
        if not openai_api_key:
            logger.warning("OpenAI API key not found")
            return {
                "ai_response": generate_intelligent_fallback(chat_request.message, chat_request.context),
                "context_used": chat_request.context,
                "debug": "OpenAI API key not found"
            }
        
        # Build comprehensive project analysis prompt
        try:
            system_prompt = build_project_analysis_prompt(chat_request.context)
            logger.info(f"Built system prompt, length: {len(system_prompt)}")
        except Exception as prompt_error:
            logger.error(f"Error building system prompt: {prompt_error}")
            logger.error(f"Context type: {type(chat_request.context)}")
            logger.error(f"Context content: {chat_request.context}")
            raise prompt_error
        
        # Call OpenAI with enhanced context
        logger.info("Calling OpenAI API...")
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
        
        logger.info("OpenAI API call successful")
        return {
            "ai_response": response.choices[0].message.content,
            "context_used": chat_request.context,
            "openai_used": True
        }
        
    except Exception as e:
        logger.error(f"OpenAI API error: {str(e)}")
        # Enhanced fallback with project data analysis
        return {
            "ai_response": generate_intelligent_fallback(chat_request.message, chat_request.context),
            "context_used": chat_request.context,
            "error": str(e),
            "debug": f"Exception in OpenAI call: {type(e).__name__}"
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
        # Build dynamic line item budget breakdown
        line_items = context.get('lineItems', [])
        print(f"🔍 AI_CONTEXT_DEBUG: Division {context.get('divisionId')} lineItems: {line_items}")
        line_items_text = ""
        if line_items:
            line_items_text = "\n\nBUDGET LINE ITEMS BREAKDOWN:"
            for item in line_items:
                item_name = item.get('name', 'Unknown')
                item_budget = item.get('budget', 0)
                line_items_text += f"\n- {item_name}: ${item_budget:,}"
        
        # Analyze quote coverage and scope
        quotes = context.get('quotes', [])
        print(f"🔍 AI_CONTEXT_DEBUG: Division {context.get('divisionId')} quotes: {len(quotes)} quotes")
        for i, q in enumerate(quotes[:2]):  # Debug first 2 quotes
            print(f"🔍 AI_CONTEXT_DEBUG: Quote {i+1}: vendor={q.get('vendor_name')}, scopeBudget={q.get('scopeBudget')}, coverageType={q.get('coverageType')}")
        quote_analysis = ""
        if quotes:
            quote_analysis = "\n\nQUOTE SCOPE ANALYSIS:"
            for quote in quotes:
                vendor = quote.get('vendor_name', 'Unknown')
                total = quote.get('total_price', 0)
                coverage_type = quote.get('coverageType', 'unknown')
                scope_budget = quote.get('scopeBudget', 0)
                scope_items = quote.get('scopeItems', 'Unknown scope')
                matched_items = quote.get('matchedLineItems', [])
                
                if coverage_type == 'specific_items' and matched_items:
                    # Show specific line item budget mapping
                    variance_pct = ((total - scope_budget) / scope_budget * 100) if scope_budget > 0 else 0
                    matched_budget_text = ", ".join([f"{item.get('name')}: ${item.get('budget', 0):,}" for item in matched_items])
                    quote_analysis += f"\n- {vendor}: ${total:,} covers {scope_items} → Mapped to: {matched_budget_text} (Total scope budget: ${scope_budget:,}) = {variance_pct:+.1f}% variance"
                elif coverage_type == 'specific_items':
                    variance_pct = ((total - scope_budget) / scope_budget * 100) if scope_budget > 0 else 0
                    quote_analysis += f"\n- {vendor}: ${total:,} covers '{scope_items}' (${scope_budget:,} scope budget) = {variance_pct:+.1f}% variance"
                else:
                    variance_pct = ((total - context.get('totalBudget', 0)) / context.get('totalBudget', 1) * 100)
                    quote_analysis += f"\n- {vendor}: ${total:,} covers complete division (${context.get('totalBudget', 0):,} total budget) = {variance_pct:+.1f}% variance"

        division_context = f"""
CURRENT CONTEXT: Division {context.get('divisionId')} - {context.get('divisionName', 'Unknown')}
Total Division Budget: ${context.get('totalBudget', 0):,}
Division Quotes: {len(quotes)} received{line_items_text}{quote_analysis}

CRITICAL ANALYSIS INSTRUCTIONS:
- FOR SPECIFIC ITEM QUOTES: Compare quote amount ONLY against the mapped line item budget, NOT the total division budget
- FOR COMPLETE DIVISION QUOTES: Compare against the total division budget
- USE THE SCOPE BUDGET amounts provided in the QUOTE SCOPE ANALYSIS section above
- Example: If DOT quotes $13,075 for "Truss Package" and the Truss Package budget is $14,000, calculate: ($13,075 - $14,000) / $14,000 = -6.6% variance

You have detailed budget breakdowns and must use the specific scope budgets for accurate analysis.
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

    project_data = context.get('detailedContext', {}) or {}
    project_name = context.get('projectName', 'Unknown Project')
    project_totals = context.get('projectTotals', {}) or {}
    
    # Build comprehensive context
    project_context = f"""

**CURRENT PROJECT: {project_name}**
Project ID: {context.get('projectId')}
Total Budget: ${project_totals.get('jobTotal', 0):,}
Project Subtotal: ${project_totals.get('projectSubtotal', 0):,}
Overhead & Profit: ${project_totals.get('overheadAndProfit', 0):,}

**DIVISIONS & QUOTES:**"""

    divisions = context.get('divisions', []) or []
    division_statuses = context.get('divisionStatuses', {}) or {}
    
    for division in divisions:
        division = division or {}
        div_code = division.get('divisionCode', 'Unknown')
        div_name = division.get('divisionName', 'Unknown')
        div_budget = division.get('divisionTotal', 0)
        status_info = division_statuses.get(div_code, {}) or {}
        quote_count = status_info.get('quote_count', 0)
        
        project_context += f"""
- Division {div_code} - {div_name}: ${div_budget:,} budget, {quote_count} quotes received"""

    # Add detailed comparison data if available
    division_comparisons = project_data.get('divisionComparisons', []) or []
    print(f"🔍 PROJECT_ANALYSIS_DEBUG: Found {len(division_comparisons)} division comparisons")
    if division_comparisons:
        project_context += "\n\n**DETAILED QUOTE ANALYSIS:**"
        
        for comp in division_comparisons:
            comp = comp or {}
            div_code = comp.get('divisionCode')
            div_name = comp.get('divisionName')
            budget = comp.get('totalBudget', comp.get('budget', 0))
            line_items = comp.get('lineItems', []) or []
            print(f"🔍 PROJECT_ANALYSIS_DEBUG: Division {div_code} - Budget: ${budget:,}, LineItems: {len(line_items)}")
            quotes = comp.get('quotes', []) or []
            division_quotes = comp.get('divisionQuotes', []) or []
            subcategory_quotes = comp.get('subcategoryQuotes', []) or []
            
            if quotes:
                project_context += f"\n\n{div_code} - {div_name} (${budget:,} budget):"
                
                # Add detailed line item breakdown if available
                if line_items:
                    project_context += f"\n**Line Item Budget Breakdown:**"
                    for item in line_items:
                        if item:
                            item_code = item.get('lineItemCode', 'N/A')
                            item_desc = item.get('description', 'N/A')
                            item_budget = item.get('budget', 0)
                            project_context += f"\n  • {item_code}: ${item_budget:,} - {item_desc}"
                
                # Process division-level quotes - only include quotes with valid totals
                valid_division_quotes = []
                if division_quotes:
                    for quote in division_quotes:
                        # Always prefer quote-level total when available (more reliable than line item math)
                        total_quote = sum((item.get('total_price') or 0) for item in quote.get('line_items', []) if item)
                        if quote.get('quote_level_total', 0) > 0:
                            total_quote = quote.get('quote_level_total', 0)
                        
                        # Only include quotes with valid totals (same filter as UI)
                        if total_quote > 0:
                            valid_division_quotes.append({**quote, 'calculated_total': total_quote})
                
                # Filter subcategory quotes to valid ones too
                valid_subcategory_quotes = []
                if subcategory_quotes:
                    for quote in subcategory_quotes:
                        total_quote = sum((item.get('total_price') or 0) for item in quote.get('line_items', []) if item)
                        if quote.get('quote_level_total', 0) > 0:
                            total_quote = quote.get('quote_level_total', 0)
                        if total_quote > 0:
                            valid_subcategory_quotes.append(quote)
                
                # Update count to reflect only valid quotes
                total_valid_quotes = len(valid_division_quotes) + len(valid_subcategory_quotes)
                project_context += f"\n  Total Quotes: {total_valid_quotes} ({len(valid_division_quotes)} division-level, {len(valid_subcategory_quotes)} subcategory-level)"
                
                if valid_division_quotes:
                    project_context += "\n\n  **Division-Level Quotes:**"
                    for quote in valid_division_quotes:
                        vendor_name = quote.get('vendor_name', 'Unknown')
                        total_quote = quote['calculated_total']
                        variance = total_quote - (budget or 0)
                        variance_pct = (variance / budget * 100) if budget > 0 else 0
                        
                        project_context += f"""
    • {vendor_name}: ${total_quote:,} ({variance_pct:+.1f}% vs budget)"""
                        
                        # Add rich scope details from our enhanced parsing
                        normalized_json = quote.get('normalized_json') or {}
                        scope_summary = normalized_json.get('scope_summary', '') if normalized_json else ''
                        exclusions = normalized_json.get('exclusions', []) if normalized_json else []
                        assumptions = normalized_json.get('assumptions', []) if normalized_json else []
                        
                        if scope_summary:
                            project_context += f"""
      Scope: {scope_summary}"""
                        
                        if exclusions:
                            project_context += f"""
      Excludes: {', '.join(exclusions)}"""
                        
                        if assumptions:
                            project_context += f"""
      Assumes: {', '.join(assumptions)}"""
                        
                        # Show work items (even if prices are $0)
                        work_items = [item.get('description', 'Unknown item') for item in quote.get('line_items', [])]
                        if work_items:
                            project_context += f"""
      Work Items: {len(work_items)} items including {', '.join(work_items[:5])}{'...' if len(work_items) > 5 else ''}"""
                
                # Process subcategory-level quotes
                if valid_subcategory_quotes:
                    project_context += "\n\n  **Subcategory-Level Quotes:**"
                    for quote in valid_subcategory_quotes:
                        vendor_name = quote.get('vendor_name', 'Unknown')
                        subcategory_id = quote.get('subcategory_id', 'Unknown')
                        scope_type = quote.get('scope_type', 'Unknown scope')
                        
                        # Calculate total from normalized_json if available
                        total_quote = 0
                        normalized_json = quote.get('normalized_json') or {}
                        pricing_summary = normalized_json.get('pricing_summary') or {}
                        if normalized_json and pricing_summary:
                            total_quote = pricing_summary.get('total_amount', 0) or 0
                        
                        project_context += f"""
    • {vendor_name} (Subcategory {subcategory_id}): ${total_quote:,} - {scope_type}"""

    project_context += "\n\nProvide specific insights, recommendations, and analysis based on this comprehensive project data."
    
    return base_prompt + project_context

def build_division_analysis_prompt(context: Dict[str, Any]) -> str:
    """Build focused prompt for division-specific quote analysis"""
    
    division_id = context.get('divisionId', '')
    division_name = context.get('divisionName', 'Unknown Division')
    total_budget = context.get('totalBudget', 0)  # Use enhanced context
    line_items = context.get('lineItems', [])     # Get line item structure
    quotes = context.get('quotes', [])
    
    # Build line items breakdown with percentages for strategic context
    line_items_text = ""
    if line_items:
        line_items_text = "\n\nBUDGET LINE ITEMS BREAKDOWN:"
        for item in line_items:
            item_name = item.get('name', 'Unknown')
            item_budget = item.get('budget', 0)
            percentage = (item_budget / total_budget * 100) if total_budget > 0 else 0
            line_items_text += f"\n- {item_name}: ${item_budget:,} ({percentage:.1f}% of division budget)"

    base_prompt = f"""You are a construction procurement specialist analyzing quotes for {division_name} work.

DIVISION CONTEXT:
- Total Division Budget: ${total_budget:,}
- Quotes Received: {len(quotes)}{line_items_text}

QUOTES TO ANALYZE:"""
    
    # Add each quote with scope-aware budget analysis
    for quote in quotes:
        vendor_name = quote.get('vendor_name', 'Unknown')
        total_price = quote.get('total_price', 0)
        coverage_type = quote.get('coverageType', 'complete_division')
        scope_budget = quote.get('scopeBudget', total_budget)
        scope_items = quote.get('scopeItems', 'Complete Division')
        matched_items = quote.get('matchedLineItems', [])
        
        # Calculate variance against appropriate budget
        if coverage_type == 'specific_items' and scope_budget > 0:
            variance_pct = round((((total_price or 0) - scope_budget) / scope_budget * 100))
            budget_context = f"${scope_budget:,} scope budget"
        else:
            variance_pct = round((((total_price or 0) - total_budget) / total_budget * 100)) if total_budget > 0 else 0
            budget_context = f"${total_budget:,} division budget"
        
        timeline = quote.get('timeline', '4 weeks')
        notes = quote.get('notes', '')
        
        # Enhanced scope display
        scope_info = ""
        if coverage_type == 'specific_items' and matched_items:
            matched_budget_text = ", ".join([f"{item.get('name')}: ${item.get('budget', 0):,}" for item in matched_items])
            scope_info = f"\n  Covers: {scope_items} (Mapped to: {matched_budget_text})"
        elif coverage_type == 'specific_items':
            scope_info = f"\n  Covers: {scope_items}"
        
        base_prompt += f"""

• {vendor_name}: ${total_price:,} ({variance_pct:+}% vs {budget_context})
  Timeline: {timeline}{scope_info}
  Details: {notes[:100]}{'...' if len(notes) > 100 else ''}"""
    
    base_prompt += """

ANALYSIS REQUIREMENTS:
- CRITICAL: Use the specific scope budget shown in each quote analysis above, NOT the total division budget
- For quotes covering specific items, compare against the line item budget (e.g., Truss Package: $14,000)
- For complete division quotes, compare against the total division budget ($82,500)
- Provide strategic insight focusing on scope coverage and budget performance
- Mention specific vendor names, scope items, and accurate variance percentages
- Give clear recommendations based on scope-specific value

Example: "DOT's Truss Package quote ($13,075) is 7% under the $14,000 Truss budget, saving $925. Still need quotes for Framing Install ($35,000) and Lumber Pack ($33,500)."
"""
    
    return base_prompt

def generate_division_fallback(context: Dict[str, Any]) -> str:
    """Generate fallback analysis when OpenAI unavailable"""
    
    division_name = context.get('divisionName', 'Unknown Division')
    budget = context.get('budget', 0)
    quotes = context.get('quotes', [])
    
    if len(quotes) == 0:
        return f"Upload {division_name.lower()} quotes to get AI analysis and vendor recommendations."
    
    # Quick analysis based on available data
    quote_count = len(quotes)
    avg_price = sum(q.get('total_price', 0) for q in quotes) / quote_count if quote_count > 0 else 0
    budget_variance = round((((avg_price or 0) - (budget or 0)) / (budget or 1) * 100)) if budget and budget > 0 else 0
    
    return f"Received {quote_count} {division_name.lower()} quotes averaging ${avg_price:,.0f} ({budget_variance:+}% vs ${budget:,} budget). AI analysis available once service reconnects."

def generate_intelligent_fallback(message: str, context: Dict[str, Any]) -> str:
    """Generate intelligent fallback responses using available project data"""
    
    message_lower = message.lower()
    project_name = context.get('projectName', 'your project')
    total_budget = (context.get('projectTotals') or {}).get('jobTotal', 0)
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