import os
from openai import OpenAI
from typing import Dict, Any, Optional
import json

class AIQuoteParser:
    def __init__(self):
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        
    def parse_quote_text(self, quote_text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Parse contractor quote text using OpenAI and return structured data"""
        
        print(f"🔍 AI_QUOTE_PARSER: Starting parse with text length: {len(quote_text) if quote_text else 0}")
        print(f"🔍 AI_QUOTE_PARSER: OpenAI key configured: {bool(self.openai_api_key)}")
        print(f"🔍 AI_QUOTE_PARSER: Text preview: {quote_text[:100] if quote_text else 'No text'}...")
        
        if not self.openai_api_key:
            print("❌ AI_QUOTE_PARSER: No OpenAI key - using mock data")
            return self._mock_parse_result(quote_text)
        
        try:
            client = OpenAI(api_key=self.openai_api_key)
            
            system_prompt = self._build_quote_parsing_prompt()
            user_prompt = self._build_user_prompt(quote_text, context)
            
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=3000,
                temperature=0.1  # Low temperature for consistent parsing
            )
            
            # Parse JSON response from AI
            ai_response = response.choices[0].message.content
            print(f"✅ AI_QUOTE_PARSER: Got OpenAI response length: {len(ai_response) if ai_response else 0}")
            print(f"✅ AI_QUOTE_PARSER: Response preview: {ai_response[:200] if ai_response else 'No response'}...")
            
            try:
                # Clean up markdown formatting if present
                cleaned_response = ai_response.strip()
                if cleaned_response.startswith('```json'):
                    cleaned_response = cleaned_response.replace('```json', '').replace('```', '').strip()
                elif cleaned_response.startswith('```'):
                    cleaned_response = cleaned_response.replace('```', '').strip()
                
                parsed_data = json.loads(cleaned_response)
                return self._validate_parsed_data(parsed_data)
            except json.JSONDecodeError:
                # If still can't parse JSON, extract what we can from partial response
                return self._extract_from_partial_json(ai_response, quote_text)
                
        except Exception as e:
            print(f"OpenAI parsing error: {e}")
            return self._mock_parse_result(quote_text)
    
    def _build_quote_parsing_prompt(self) -> str:
        """Build the expert quote parsing system prompt"""
        return """You are an expert construction estimator and procurement specialist with 20+ years of experience parsing contractor quotes and proposals. Your task is to extract and normalize key information from construction quotes into a standardized format.

EXPERTISE AREAS:
- Construction cost estimation and pricing analysis
- Contractor proposal formats and industry standards  
- Trade-specific terminology and unit pricing conventions
- Scope interpretation and exclusion identification
- Timeline and scheduling analysis

PARSING OBJECTIVES:
- Extract all quantifiable cost information accurately
- Identify scope boundaries and exclusions clearly
- Normalize units and pricing to industry standards
- Flag ambiguous or unclear information
- Assess completeness and confidence level

ENHANCED NARRATIVE PARSING:
When processing detailed narrative proposals (like electrical, plumbing, HVAC scopes), break down comprehensive descriptions into logical work phases or categories. Look for:
- Major work phases (rough-in, trim-out, testing, etc.)
- Equipment/material categories (panels, fixtures, appliances, etc.)  
- Distinct work areas (interior, exterior, service, specialty)
- Sequential activities that could be priced separately

Create meaningful line items from narrative text while preserving the rich detail in descriptions. If the proposal shows one lump sum but describes multiple work phases, create separate line items for each major phase with proportional pricing estimates.

SCOPE SUMMARY ENHANCEMENT:
Build comprehensive scope summaries that capture all major work categories mentioned, not just the first section. Include key details about equipment sizes, quantities, and special requirements.

OUTPUT FORMAT: Return valid JSON only, no additional text."""

    def _build_user_prompt(self, quote_text: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Build the user prompt with quote text and context"""
        
        context_info = ""
        if context:
            rfq_scope = context.get('rfq_scope', '')
            budget_amount = context.get('budget_amount', 0)
            division_name = context.get('division_name', '')
            
            context_info = f"""
ORIGINAL RFQ CONTEXT:
- Division/Scope: {division_name}
- RFQ Scope: {rfq_scope}
- Budget Target: ${budget_amount:,}
"""

        return f"""Parse this construction contractor quote and extract key information:

{context_info}

QUOTE TEXT TO PARSE:
{quote_text}

Extract and return as valid JSON with this exact structure:

{{
  "vendor_info": {{
    "name": "Company name",
    "contact_person": "Contact name if provided",
    "contact_email": "Email if provided", 
    "contact_phone": "Phone if provided",
    "quote_date": "Date of quote (YYYY-MM-DD format)",
    "quote_number": "Quote/proposal number if provided",
    "validity_period": "How long quote is valid"
  }},
  "scope_summary": "Brief description of work being quoted",
  "line_items": [
    {{
      "description": "Clear description of work item",
      "quantity": 100,
      "unit": "SF",
      "unit_price": 15.50,
      "total_price": 1550.00,
      "notes": "Any specific notes about this item"
    }}
  ],
  "pricing_summary": {{
    "subtotal": 0.00,
    "tax_amount": 0.00,
    "tax_rate": 0.0,
    "total_amount": 0.00,
    "pricing_basis": "lump_sum or unit_pricing"
  }},
  "timeline": {{
    "start_date": "When work can begin",
    "duration": "How long work will take", 
    "completion_date": "Expected completion",
    "milestones": ["Key milestones if specified"]
  }},
  "exclusions": [
    "List items explicitly excluded from scope"
  ],
  "assumptions": [
    "List assumptions contractor is making"
  ],
  "alternates": [
    {{
      "description": "Alternate option description",
      "price_adjustment": 0.00,
      "notes": "Details about alternate"
    }}
  ],
  "payment_terms": "Payment schedule and terms",
  "warranty": "Warranty terms provided",
  "notes": "Any additional important information",
  "confidence_score": 0.85,
  "parsing_flags": [
    "Any concerns or unclear items that need clarification"
  ]
}}

PARSING GUIDELINES:

FOR NARRATIVE PROPOSALS: If the quote describes multiple work phases in detail but shows one lump sum price:
- Create separate line items for each major work phase or category
- Estimate reasonable price breakdown based on industry standards and complexity
- Preserve detailed descriptions from the original proposal
- Use "LS" (lump sum) units for complex work phases

FOR SCOPE SUMMARY: Build a comprehensive summary that mentions:
- All major work categories covered (e.g., "rough-in", "trim-out", "testing")  
- Key equipment/materials (e.g., "300A electrical service", "LED recessed lighting")
- Special requirements or notable items
- Do not just repeat the first section heading

EXAMPLES:
- Instead of: "Electrical work" 
- Write: "Complete electrical installation including rough-in wiring, 300A service installation, LED lighting systems, appliance circuits, trim-out, and final testing"

IMPORTANT: Return ONLY the JSON object, no additional text or explanation."""

    def _validate_parsed_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and clean up the parsed data"""
        
        # Ensure required fields exist
        required_fields = {
            'vendor_info': {},
            'scope_summary': '',
            'line_items': [],
            'pricing_summary': {},
            'timeline': {},
            'exclusions': [],
            'assumptions': [],
            'confidence_score': 0.5
        }
        
        for field, default in required_fields.items():
            if field not in data:
                data[field] = default
        
        # Validate confidence score
        if not isinstance(data.get('confidence_score'), (int, float)):
            data['confidence_score'] = 0.5
        elif data['confidence_score'] > 1.0:
            data['confidence_score'] = data['confidence_score'] / 100  # Convert percentage
            
        return data
    
    def _extract_from_partial_json(self, ai_response: str, original_text: str) -> Dict[str, Any]:
        """Extract what we can from partial or malformed JSON response"""
        
        # Try to extract vendor name from partial response
        vendor_name = "Unknown Vendor"
        if '"name"' in ai_response:
            try:
                import re
                name_match = re.search(r'"name":\s*"([^"]+)"', ai_response)
                if name_match:
                    vendor_name = name_match.group(1)
            except:
                pass
        
        return {
            "vendor_info": {"name": vendor_name},
            "scope_summary": "Partial parsing - review needed",
            "line_items": [],
            "pricing_summary": {"total_amount": 0.00},
            "timeline": {"duration": "TBD"},
            "exclusions": [],
            "assumptions": [],
            "confidence_score": 0.3,
            "parsing_flags": ["Partial JSON response", "Manual review recommended"],
            "raw_ai_response": ai_response[:1000],  # Include more of the response
            "original_text_preview": original_text[:200]
        }

    def _extract_from_text_response(self, ai_response: str, original_text: str) -> Dict[str, Any]:
        """Extract structured data when AI doesn't return valid JSON"""
        
        return {
            "vendor_info": {"name": "Unknown Vendor"},
            "scope_summary": f"Quote parsing incomplete - manual review needed",
            "line_items": [],
            "pricing_summary": {"total_amount": 0.00},
            "timeline": {"duration": "TBD"},
            "exclusions": [],
            "assumptions": [],
            "confidence_score": 0.2,
            "parsing_flags": ["AI response was not valid JSON", "Manual review required"],
            "raw_ai_response": ai_response[:500],  # Include partial AI response
            "original_text_preview": original_text[:200]
        }
    
    def _mock_parse_result(self, quote_text: str) -> Dict[str, Any]:
        """Return mock parsed data when OpenAI is unavailable"""
        
        return {
            "vendor_info": {
                "name": "Mock Vendor (OpenAI not configured)",
                "quote_date": "2024-03-15"
            },
            "scope_summary": "Sample construction work quote",
            "line_items": [
                {
                    "description": "Construction work as specified", 
                    "quantity": 1,
                    "unit": "LS",
                    "unit_price": 25000,
                    "total_price": 25000
                }
            ],
            "pricing_summary": {
                "subtotal": 25000,
                "total_amount": 25000
            },
            "timeline": {
                "duration": "4-6 weeks"
            },
            "exclusions": ["Permits", "Design changes"],
            "confidence_score": 0.95,
            "parsing_flags": ["This is mock data - OpenAI integration needed for real parsing"]
        }

# Global instance
ai_quote_parser = AIQuoteParser()