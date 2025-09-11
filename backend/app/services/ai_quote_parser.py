import os
from openai import OpenAI
from typing import Dict, Any, Optional
import json
import re

class AIQuoteParser:
    def __init__(self):
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        
    def _detect_trade_type(self, context: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """Detect trade type from division code or context"""
        if not context:
            return None
            
        # First try to get division_code directly from context
        division_code = context.get('division_code', '')
        
        # If not available, try extracting from division_id (fallback)
        if not division_code:
            division_id = context.get('division_id', '')
            if '-' in division_id:
                division_code = division_id.split('-')[0]
            
        # Map your actual 19 division codes to trade types
        trade_mapping = {
            '01': 'general_conditions',
            '02': 'site_demo', 
            '03': 'excavation_landscape',
            '04': 'concrete_masonry',
            '05': 'rough_carpentry',
            '06': 'doors_windows',
            '07': 'mechanical_hvac',
            '08': 'electrical',
            '09': 'plumbing',
            '10': 'wall_ceiling',
            '11': 'finish_carpentry',
            '12': 'cabinets',
            '13': 'flooring_tile',
            '14': 'specialties',
            '15': 'decking',
            '16': 'fencing',
            '17': 'exterior_facade',
            '18': 'soffit_fascia_gutters',
            '19': 'roofing'
        }
        
        print(f"🔍 TRADE_DETECTION: Raw division_code='{division_code}', Padded='{division_code.zfill(2)}'")
        trade_type = trade_mapping.get(division_code.zfill(2))
        print(f"🔍 TRADE_DETECTION: Mapped to trade_type='{trade_type}'")
        return trade_type

    def parse_quote_text(self, quote_text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Parse contractor quote text using OpenAI and return structured data"""
        
        print(f"🔍 AI_QUOTE_PARSER: Starting parse with text length: {len(quote_text) if quote_text else 0}")
        print(f"🔍 AI_QUOTE_PARSER: OpenAI key configured: {bool(self.openai_api_key)}")
        print(f"🔍 AI_QUOTE_PARSER: Context received: {context}")
        
        # Debug trade detection
        detected_trade = self._detect_trade_type(context)
        print(f"🎯 AI_QUOTE_PARSER: Detected trade type: {detected_trade}")
        print(f"🎯 AI_QUOTE_PARSER: Full context for trade detection: {context}")
        
        print(f"🔍 AI_QUOTE_PARSER: Text preview: {quote_text[:100] if quote_text else 'No text'}...")
        
        if not self.openai_api_key:
            print("❌ AI_QUOTE_PARSER: No OpenAI key - using mock data")
            return self._mock_parse_result(quote_text)
        
        try:
            client = OpenAI(api_key=self.openai_api_key)
            
            system_prompt = self._build_quote_parsing_prompt(context)
            user_prompt = self._build_user_prompt(quote_text, context)
            
            print(f"🚀 SENDING TO OPENAI:")
            print(f"📝 System prompt length: {len(system_prompt)}")
            print(f"📝 User prompt length: {len(user_prompt)}")
            print(f"📝 Text contains '27,762.96': {'27,762.96' in user_prompt}")
            print(f"📝 Text contains 'SUBTOTAL': {'SUBTOTAL' in user_prompt}")
            print(f"📝 Last 200 chars: {user_prompt[-200:]}")
            
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
                
                print(f"🔍 JSON_PARSE: Attempting to parse cleaned response length: {len(cleaned_response)}")
                print(f"🔍 JSON_PARSE: First 200 chars: {cleaned_response[:200]}")
                
                parsed_data = json.loads(cleaned_response)
                print(f"✅ JSON_PARSE: Successfully parsed JSON")
                return self._validate_parsed_data(parsed_data)
            except json.JSONDecodeError as e:
                print(f"❌ JSON_PARSE: Failed to parse JSON: {e}")
                print(f"❌ JSON_PARSE: Last 500 chars of AI response: {ai_response[-500:] if ai_response else 'No response'}")
                print(f"❌ JSON_PARSE: Falling back to partial extraction")
                # If still can't parse JSON, extract what we can from partial response
                return self._extract_from_partial_json(ai_response, quote_text)
                
        except Exception as e:
            print(f"OpenAI parsing error: {e}")
            print(f"OpenAI error type: {type(e)}")
            import traceback
            print(f"OpenAI full traceback: {traceback.format_exc()}")
            return self._mock_parse_result(quote_text)
    
    def _get_trade_specific_prompt(self, trade_type: str) -> str:
        """Get trade-specific parsing instructions"""
        
        trade_prompts = {
            'general_conditions': """
GENERAL CONDITIONS BREAKDOWN:
- PROJECT_MANAGEMENT: Supervision, coordination, project meetings
- PERMITS: Building permits, fees, inspections, plan reviews
- TEMPORARY_FACILITIES: Site office, storage, fencing, signage
- UTILITIES: Temporary power, water, internet, phone
- CLEANUP: Daily cleanup, final cleanup, dumpster service
- INSURANCE: Additional coverage, bonds, liability
- MOBILIZATION: Setup, demobilization, equipment moves""",
            
            'site_demo': """
SITE/DEMO BREAKDOWN:
- SITE_PREP: Clearing, grading, access roads
- DEMOLITION: Structure demo, debris removal, hazmat
- EXCAVATION: Site excavation, backfill, compaction
- UTILITIES: Temporary utilities, disconnections
- ENVIRONMENTAL: Soil testing, environmental compliance
- RESTORATION: Site restoration, final grading""",
            
            'excavation_landscape': """
EXCAVATION/LANDSCAPE BREAKDOWN:
- EXCAVATION: Footings, trenches, bulk excavation (cubic yards)
- BACKFILL: Material type, compaction requirements
- GRADING: Rough grading, final grading (square feet)
- LANDSCAPING: Plants, trees, irrigation, sod/seed
- HARDSCAPE: Walkways, retaining walls, drainage
- SOIL_WORK: Import/export soil, soil amendments""",
            
            'concrete_masonry': """
CONCRETE/MASONRY BREAKDOWN:
- FOOTINGS: Size, depth, reinforcement details (linear feet)
- FOUNDATION: Wall thickness, height, waterproofing
- SLABS: Thickness, reinforcement, finish type (square feet)
- BLOCK_WORK: Block size, coursing, reinforcement
- FLATWORK: Sidewalks, driveways, patios (square feet)
- FINISHES: Stucco, paint, sealing, decorative work
- MATERIALS: Concrete strength (PSI), block type, mortar""",
            
            'rough_carpentry': """
ROUGH CARPENTRY BREAKDOWN:
- FRAMING: Wall framing, floor joists, roof trusses/rafters
- LUMBER: Grades, sizes, species (board feet or linear feet)
- SHEATHING: Type, thickness, fastening (square feet)
- STRUCTURAL: Beams, posts, engineered lumber
- HARDWARE: Hangers, brackets, fasteners, connectors
- LABOR: Framing labor, crane time, specialties""",
            
            'doors_windows': """
DOORS/WINDOWS BREAKDOWN:
- WINDOWS: Size, type, energy rating, quantity, brand
- EXTERIOR_DOORS: Style, material, hardware, weatherstripping
- INTERIOR_DOORS: Style, material, hardware (per opening)
- GARAGE_DOORS: Size, type, insulation, openers, remotes
- HARDWARE: Locks, handles, hinges, closers
- INSTALLATION: Flashing, trim, weatherproofing, adjustment
- GLASS: Types, energy ratings, specialty glazing""",
            
            'mechanical_hvac': """
MECHANICAL/HVAC BREAKDOWN:
- EQUIPMENT: Unit sizes (BTU/tons), efficiency ratings, brands
- DUCTWORK: Material, sizes, insulation, layout (linear feet)
- INSTALLATION: Equipment setting, connections, startup
- CONTROLS: Thermostats, zoning systems, smart controls
- VENTING: Flue pipes, exhaust fans, makeup air
- PIPING: Refrigerant lines, condensate, gas lines
- COMMISSIONING: Testing, balancing, warranty startup
- PERMITS: Mechanical permits, inspections""",
            
            'electrical': """
ELECTRICAL BREAKDOWN:
- SERVICE: Main service size (amps), meter, disconnect location
- PANELS: Distribution panels (locations, amp ratings, circuits)
- ROUGH_IN: Branch circuits (count, wire gauge, type)
- FIXTURES: Lighting types, quantities, zones, controls, dimming
- DEVICES: Outlets, switches, GFCIs, USBs, specialty outlets
- APPLIANCES: Dedicated circuits (equipment served, amp ratings)
- LOW_VOLTAGE: Security, data, audio/video, doorbell rough-in
- SPECIALTY: Generator connections, EV charging, smart home
- PERMITS: Electrical permits, inspection fees""",
            
            'plumbing': """
PLUMBING BREAKDOWN:
- ROUGH_IN: Supply lines (material, sizes), waste/vent lines
- FIXTURES: Toilets, sinks, tubs, showers (brands, models, grades)
- WATER_HEATER: Size, type (tank/tankless), venting, location
- APPLIANCES: Connections for dishwasher, ice maker, disposal
- GAS_LINES: Size, material, appliances served (linear feet)
- SPECIALTY: Rough-in for future fixtures, hose bibs
- WATER_TREATMENT: Softeners, filters, treatment systems
- PERMITS: Plumbing permits, inspection fees""",
            
            'wall_ceiling': """
WALL/CEILING COVERINGS BREAKDOWN:
- DRYWALL: Thickness, finish level, texture (square feet)
- INSULATION: R-value, type, thickness (square feet)
- PAINT: Primer, finish coats, quality grade, colors
- WALLPAPER: Type, installation, prep work
- CEILING: Suspended, drywall, specialty finishes
- TRIM_PREP: Caulking, sanding, surface preparation""",
            
            'finish_carpentry': """
FINISH CARPENTRY BREAKDOWN:
- INTERIOR_TRIM: Base, case, crown molding (linear feet)
- MILLWORK: Stairs, railings, built-ins, wainscoting
- DOORS: Hanging, hardware installation, adjustment
- SHELVING: Closet systems, built-in shelving
- SPECIALTY: Custom millwork, architectural details
- HARDWARE: Installation of finish hardware, accessories
- LABOR: Installation, fitting, finishing touches""",
            
            'cabinets': """
CABINETS/VANITIES/TOPS BREAKDOWN:
- KITCHEN_CABINETS: Linear feet, door style, finish, hardware
- BATH_VANITIES: Sizes, styles, tops, faucet cutouts
- COUNTERTOPS: Material, edge details, square footage, cutouts
- INSTALLATION: Mounting, leveling, scribing, trim
- HARDWARE: Handles, knobs, hinges, drawer slides
- SPECIALTY: Islands, pantries, built-in features
- TOPS: Granite, quartz, laminate, edge treatments""",
            
            'flooring_tile': """
FLOORING/TILE BREAKDOWN:
- HARDWOOD: Species, grade, finish, installation method (sq ft)
- TILE: Size, type, layout, grout type and color (sq ft)
- CARPET: Grade, padding, installation (sq ft)
- VINYL/LVP: Type, thickness, installation (sq ft)
- SUBFLOOR: Preparation, underlayment, moisture barriers
- TRANSITIONS: Thresholds, reducers, quarter round
- LABOR: Installation, prep work, cleanup""",
            
            'specialties': """
SPECIALTIES BREAKDOWN:
- APPLIANCES: Built-in appliances, installation, connections
- FIXTURES: Mirrors, medicine cabinets, accessories
- SPECIALTY_ITEMS: Custom work, unique installations
- TECHNOLOGY: Smart home devices, security systems
- BATH_ACCESSORIES: Towel bars, toilet paper holders, etc.
- MISCELLANEOUS: Items that don't fit other categories""",
            
            'decking': """
DECKING BREAKDOWN:
- DECK_STRUCTURE: Joists, beams, posts, footings
- DECKING_MATERIAL: Board type, grade, square footage
- RAILINGS: Style, height, balusters, top rail
- STAIRS: Treads, risers, stringers, handrails
- HARDWARE: Fasteners, joist hangers, post anchors
- FINISHES: Stain, sealers, protective coatings""",
            
            'fencing': """
FENCING BREAKDOWN:
- FENCE_MATERIAL: Type, height, style, grade
- POSTS: Material, spacing, setting method
- HARDWARE: Gates, hinges, latches, fasteners
- INSTALLATION: Linear feet, post holes, assembly
- FINISHES: Stain, paint, protective treatments
- GATES: Sizes, hardware, automation if applicable""",
            
            'exterior_facade': """
EXTERIOR FACADE BREAKDOWN:
- SIDING: Type, grade, square footage, trim
- STONE/BRICK: Veneer, mortar, square footage
- STUCCO: Base coat, finish coat, texture, color
- TRIM: Corner boards, window/door trim, decorative
- HARDWARE: Fasteners, flashing, weather barriers
- FINISHES: Paint, stain, sealers, maintenance coatings""",
            
            'soffit_fascia_gutters': """
SOFFIT/FASCIA/GUTTERS BREAKDOWN:
- SOFFIT: Material, venting, square footage
- FASCIA: Material, linear feet, trim details
- GUTTERS: Size, material, linear feet, style
- DOWNSPOUTS: Size, material, quantity, extensions
- ACCESSORIES: Leaf guards, splash blocks, hangers
- INSTALLATION: Mounting, slope, drainage connections""",
            
            'roofing': """
ROOFING BREAKDOWN:
- ROOFING_MATERIAL: Type, grade, squares, warranty
- UNDERLAYMENT: Type, coverage, ice/water shield
- FLASHING: Step, valley, chimney, vent penetrations
- VENTILATION: Ridge vents, intake vents, fans
- ACCESSORIES: Gutters, downspouts, snow guards
- LABOR: Installation, cleanup, warranty terms
- SPECIALTY: Skylights, chimneys, complex roof lines"""
        }
        
        return trade_prompts.get(trade_type, "")

    def _build_quote_parsing_prompt(self, context: Optional[Dict[str, Any]] = None) -> str:
        """Build the expert quote parsing system prompt with trade-specific intelligence"""
        
        base_prompt = """You are an expert construction estimator and procurement specialist with 20+ years of experience parsing contractor quotes and proposals. Your task is to extract and normalize key information from construction quotes into a standardized format.

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
When processing detailed narrative proposals, break down comprehensive descriptions into logical work phases or categories. Look for:
- Major work phases (rough-in, trim-out, testing, etc.)
- Equipment/material categories (panels, fixtures, appliances, etc.)  
- Distinct work areas (interior, exterior, service, specialty)
- Sequential activities that could be priced separately

Create meaningful line items from narrative text while preserving the rich detail in descriptions. If the proposal shows one lump sum but describes multiple work phases, create separate line items for each major phase with proportional pricing estimates.

SCOPE SUMMARY ENHANCEMENT:
Build comprehensive scope summaries that capture all major work categories mentioned, not just the first section. Include key details about equipment sizes, quantities, and special requirements."""

        # Detect trade type and add specific guidance
        trade_type = self._detect_trade_type(context)
        if trade_type:
            trade_guidance = self._get_trade_specific_prompt(trade_type)
            base_prompt += f"""

TRADE-SPECIFIC PARSING GUIDANCE:
{trade_guidance}

IMPORTANT: Use this trade-specific breakdown to create detailed, granular line items. Instead of generic descriptions, extract specific components, sizes, quantities, and technical details."""

        base_prompt += """

OUTPUT FORMAT: Return valid JSON only, no additional text."""
        
        return base_prompt

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

CRITICAL: EXTRACT ONLY ACTUAL PRICES - NEVER FABRICATE OR ESTIMATE:
- Only extract prices that are explicitly stated in the quote document
- If a line item has no price shown, set total_price to 0.0
- If the quote shows a lump sum, do NOT break it down into estimated individual prices
- If optional add-ons are listed separately, clearly mark them as optional in descriptions
- Preserve the exact pricing structure as presented by the vendor

FLEXIBLE PRICE RECOGNITION:
- Standard format: $27,762.96 or $1,250.00
- No-dollar format: 27,762.96 or 1,250.00 (common in lumber/material quotes)
- Column layout: Numbers in "EXTENDED PRICE" or "TOTAL" columns
- Final totals often show: "SUBTOTAL  TAX  TOTAL" with numbers below
- Look for patterns like: "26,144.30  1,618.66  27,762.96" (subtotal, tax, total)

FOR NARRATIVE PROPOSALS: If the quote describes multiple work phases but shows one lump sum:
- Create line items for work phases but set individual prices to 0.0
- Put the actual lump sum price in pricing_summary.total_amount only
- Use descriptions like "Phase 1: Description (part of $X lump sum)"
- DO NOT estimate or allocate portions of the lump sum to individual items

FOR SCOPE SUMMARY: Build a comprehensive summary that mentions:
- All major work categories covered (e.g., "rough-in", "trim-out", "testing")  
- Key equipment/materials (e.g., "300A electrical service", "LED recessed lighting")
- Special requirements or notable items
- Do not just repeat the first section heading

EXAMPLES:
- Instead of: "Electrical work" 
- Write: "Complete electrical installation including rough-in wiring, 300A service installation, LED lighting systems, appliance circuits, trim-out, and final testing"

FOR OPTIONAL ADD-ONS: When quotes show base price plus optional items:
- Extract base price as one line item with actual price
- Extract each optional add-on as separate line items with actual add-on prices
- Mark optional items clearly: "Sewer connection (optional add-on)" 
- Do NOT add optional prices to base price unless explicitly stated as "total including"

EXAMPLES:
Quote says: "Base plumbing $8,850 + Sewer connection additional $850"
CORRECT parsing:
CRITICAL: Return ONLY valid JSON. Double-check all commas, brackets, and quotation marks.
Example format:
{
  "pricing_summary": {
    "total_amount": 27762.96
  }
}

Return ONLY the JSON object, no additional text."""

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