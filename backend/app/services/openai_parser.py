import os
import json
from typing import Dict, List, Any, Optional
import pandas as pd
import io
from openai import OpenAI

class OpenAIBudgetParser:
    """OpenAI-powered construction budget parser using structured outputs"""
    
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # Simplified schema to avoid OpenAI validation issues
        self.use_structured_output = False  # For now, use regular JSON parsing
    
    def extract_raw_data(self, file_content: bytes, sheet_name: str) -> List[Dict[str, Any]]:
        """Extract raw data from Excel sheet for AI processing"""
        try:
            # Read the specific sheet
            df = pd.read_excel(io.BytesIO(file_content), sheet_name=sheet_name)
            
            # Convert to clean JSON for AI processing
            # Replace NaN with None for JSON compliance
            df_clean = df.fillna('')
            
            # Convert to list of dictionaries with row numbers for context
            raw_data = []
            for index, row in df_clean.iterrows():
                row_data = {
                    'row_number': index + 1,  # 1-based row numbering
                    'data': {}
                }
                
                # Add all column data
                for col_index, (col_name, value) in enumerate(row.items()):
                    # Convert column index to Excel letter
                    excel_col = chr(65 + col_index) if col_index < 26 else f"A{chr(65 + col_index - 26)}"
                    row_data['data'][f"{excel_col}_{col_name}"] = str(value) if value != '' else None
                
                raw_data.append(row_data)
            
            return raw_data
            
        except Exception as e:
            raise Exception(f"Error extracting data from sheet '{sheet_name}': {str(e)}")
    
    def analyze_with_openai(self, file_name: str, worksheet: str, raw_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Send raw data to OpenAI for intelligent analysis"""
        try:
            system_prompt = """You are a senior construction cost estimator and data normalizer. You convert an Excel Estimate sheet into a clean, structured JSON budget that is safe for downstream automation (quote comparison, variance analysis, work orders). You must follow the schema, rules, and formatting exactly.

Goals:
- Group line items by division (e.g., "01 – General Conditions", "02 – Site/Demo")
- Return only true cost line items (exclude headers, section titles, and subtotals)
- Preserve scope notes and estimating notes when present
- Compute division totals and a grand total
- Output JSON only (no prose), with numbers as plain floats formatted to two decimals

Rules (strict):
1. Division detection: A division is identified by a two-digit code and a name (e.g., 01, 02, 19). Section rows like "03 – Excavation/Landscape Subtotal" define division context but are not items.

2. Item inclusion: Include only rows that represent a real, purchasable/buildable cost line with any positive value in Material, Labor, Sub/Equip, or Total/Budget. Rows with all zeros or blanks across cost columns are excluded.

3. Skip non-items: Exclude rows that are headers, blank separators, subtotals, "Project Subtotal", "Overhead & Profit", "Job Total", or any row that is not a discrete cost line.

4. Numbers & currency: Strip $ and commas; coerce to floats with two decimals. If totalCost is blank, compute it as materialCost + laborCost + subEquipCost.

5. Units: Normalize common units to: EA, LF, SF, SY, CY, HR, LS. If unclear, use null.

6. Line IDs: Build a stable lineId using division code and slugified description (e.g., "01-1100-Permit-Job").

Output JSON schema:
{
  "meta": {
    "client": "string|null",
    "project": "string|null", 
    "date": "string|null"
  },
  "divisions": [
    {
      "divisionCode": "string",
      "divisionName": "string", 
      "items": [
        {
          "lineId": "string",
          "tradeDescription": "string",
          "quantity": 123.45,
          "unit": "string|null",
          "materialCost": 0.00,
          "laborCost": 0.00, 
          "subEquipCost": 0.00,
          "totalCost": 1234.56,
          "scopeNotes": "string|null",
          "estimatingNotes": "string|null"
        }
      ],
      "divisionTotal": 99999.99
    }
  ],
  "grandTotal": 999999.99
}

Examples of rows to exclude: "* General Conditions Subtotal", "Project Subtotal", "Overhead & Profit (20%)", "Job Total"""

            input_data = {
                "fileName": file_name,
                "worksheet": worksheet,
                "rawData": raw_data  # Process ALL 800+ rows - no arbitrary limits
            }
            
            if self.use_structured_output:
                response = self.client.chat.completions.create(
                    model="gpt-4o-2024-08-06",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": json.dumps(input_data)}
                    ],
                    response_format=self.schema,
                    temperature=0
                )
            else:
                # Use regular JSON mode for simplicity
                enhanced_prompt = system_prompt + "\n\nReturn ONLY valid JSON in this exact format:\n" + json.dumps({
                    "fileName": "example.xlsx",
                    "worksheet": "Estimate",
                    "divisions": [
                        {
                            "divisionCode": "01", 
                            "divisionName": "General Conditions",
                            "total": 25000,
                            "items": [
                                {
                                    "costCode": "1200 - Project Oversight",
                                    "tradeDescription": "Supervision, Coordination, Procurement", 
                                    "total": 22800
                                }
                            ]
                        }
                    ],
                    "grandTotal": 294895
                }, indent=2)
                
                response = self.client.chat.completions.create(
                    model="gpt-4o-mini",  # Use mini for faster, cheaper processing
                    messages=[
                        {"role": "system", "content": enhanced_prompt},
                        {"role": "user", "content": json.dumps(input_data)}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0
                )
            
            # Parse the structured response
            result = json.loads(response.choices[0].message.content)
            
            print(f"OpenAI analysis complete: {len(result.get('divisions', []))} divisions found")
            
            return result
            
        except Exception as e:
            raise Exception(f"OpenAI analysis failed: {str(e)}")
    
    async def parse_budget_with_ai(self, file_content: bytes, file_name: str, sheet_name: str) -> Dict[str, Any]:
        """Complete workflow: extract data + AI analysis"""
        try:
            print(f"Starting AI-powered analysis of {file_name}, sheet: {sheet_name}")
            
            # Step 1: Extract raw data from Excel
            raw_data = self.extract_raw_data(file_content, sheet_name)
            print(f"Extracted {len(raw_data)} rows of raw data")
            
            # Step 2: Send to OpenAI for intelligent analysis  
            analysis = self.analyze_with_openai(file_name, sheet_name, raw_data)
            
            # Step 3: Convert to our database format using the improved schema
            budget_items = []
            total_project_value = 0
            
            for division in analysis.get('divisions', []):
                division_total = division.get('divisionTotal', 0)
                if division_total:
                    total_project_value += division_total
                    
                for item in division.get('items', []):
                    # Use the improved schema format
                    budget_item = {
                        'division': division.get('divisionCode', ''),
                        'description': item.get('tradeDescription', ''),
                        'quantity': item.get('quantity'),
                        'unit': item.get('unit', 'LS'), 
                        'unit_cost': (item.get('totalCost', 0) / item.get('quantity', 1)) if item.get('quantity') and item.get('quantity') > 0 else 0,
                        'total_cost': item.get('totalCost', 0),
                        'notes': f"Material: ${item.get('materialCost', 0):.2f}, Labor: ${item.get('laborCost', 0):.2f}, Sub/Equip: ${item.get('subEquipCost', 0):.2f}",
                        # Store additional details
                        'cost_breakdown': {
                            'lineId': item.get('lineId'),
                            'material': item.get('materialCost', 0),
                            'labor': item.get('laborCost', 0), 
                            'subEquip': item.get('subEquipCost', 0),
                            'scopeNotes': item.get('scopeNotes'),
                            'estimatingNotes': item.get('estimatingNotes')
                        }
                    }
                    budget_items.append(budget_item)
            
            return {
                'budget_items': budget_items,
                'analysis': analysis,
                'summary': {
                    'total_divisions': len(analysis.get('divisions', [])),
                    'total_items': len(budget_items),
                    'grand_total': analysis.get('grandTotal', total_project_value)  # Use calculated value as fallback
                }
            }
            
        except Exception as e:
            raise Exception(f"AI-powered parsing failed: {str(e)}")