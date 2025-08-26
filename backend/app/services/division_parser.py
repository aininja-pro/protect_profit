import pandas as pd
import io
import re
import json
from typing import Dict, List, Any, Optional
from openai import OpenAI
import os

class DivisionByDivisionParser:
    """Parse Excel estimate by processing one division at a time to avoid token limits"""
    
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    def parse_excel_to_base_json(self, file_content: bytes, sheet_name: str) -> Dict[str, Any]:
        """Step 1: Parse Excel with pandas and group by division"""
        try:
            # Read the Excel sheet
            df = pd.read_excel(io.BytesIO(file_content), sheet_name=sheet_name)
            df = df.fillna('')
            
            print(f"Processing {len(df)} rows from sheet '{sheet_name}'")
            
            # Extract meta information from header rows
            meta = self._extract_meta_info(df)
            
            # Group rows by division
            divisions = self._group_by_division(df)
            
            # Calculate project totals from the spreadsheet
            totals = self._extract_totals(df)
            
            return {
                "meta": meta,
                "divisions": divisions,
                "totals": totals,
                "raw_division_count": len(divisions)
            }
            
        except Exception as e:
            raise Exception(f"Error parsing Excel to base JSON: {str(e)}")
    
    def _extract_meta_info(self, df: pd.DataFrame) -> Dict[str, Optional[str]]:
        """Extract client, project, date from header rows"""
        meta = {"client": None, "project": None, "date": None}
        
        # Look in first few rows for meta information
        for i in range(min(10, len(df))):
            row = df.iloc[i]
            for j, cell in enumerate(row):
                cell_str = str(cell).strip().lower()
                
                # Look for client info
                if 'client' in cell_str and j + 1 < len(row):
                    meta["client"] = str(row.iloc[j + 1]).strip()
                
                # Look for project info  
                if 'project' in cell_str and j + 1 < len(row):
                    meta["project"] = str(row.iloc[j + 1]).strip()
                
                # Look for date info
                if 'date' in cell_str and j + 1 < len(row):
                    meta["date"] = str(row.iloc[j + 1]).strip()
        
        return meta
    
    def _group_by_division(self, df: pd.DataFrame) -> Dict[str, List[Dict[str, Any]]]:
        """Group rows by construction division codes"""
        divisions = {}
        current_division = None
        
        for index, row in df.iterrows():
            # Check if this row defines a new division
            division_code = self._extract_division_code(row)
            if division_code:
                current_division = division_code
                divisions[current_division] = []
                continue
            
            # Check if this is a line item (has cost data)
            if self._is_line_item(row) and current_division:
                line_item = {
                    'row_number': index + 1,
                    'division': current_division,
                    'A': str(row.iloc[0]) if len(row) > 0 else '',
                    'C': str(row.iloc[2]) if len(row) > 2 else '',      # Description
                    'D': str(row.iloc[3]) if len(row) > 3 else '',      # Quantity
                    'E': str(row.iloc[4]) if len(row) > 4 else '',      # Unit
                    'F': str(row.iloc[5]) if len(row) > 5 else '',      # Material
                    'I': str(row.iloc[8]) if len(row) > 8 else '',      # Labor
                    'K': str(row.iloc[10]) if len(row) > 10 else '',    # Sub/Equip
                    'L': str(row.iloc[11]) if len(row) > 11 else '',    # Total
                    'M': str(row.iloc[12]) if len(row) > 12 else '',    # Alt Total
                    'N': str(row.iloc[13]) if len(row) > 13 else '',    # Scope Notes
                    'O': str(row.iloc[14]) if len(row) > 14 else ''     # Estimating Notes
                }
                divisions[current_division].append(line_item)
        
        return divisions
    
    def _extract_division_code(self, row) -> Optional[str]:
        """Check if row contains a division header like '01', '02', etc."""
        for cell in row:
            cell_str = str(cell).strip()
            # Look for pattern like "01", "02" or "01 - General Conditions"
            if re.match(r'^\d{2}(\s*-|\s+)', cell_str):
                return cell_str[:2]
        return None
    
    def _is_line_item(self, row) -> bool:
        """Check if row contains actual cost line item data"""
        # Check if any of the cost columns (F, I, K, L) have positive values
        # AND has a description in column C
        try:
            # Must have a description
            desc = str(row.iloc[2]).strip() if len(row) > 2 else ''
            if not desc or desc == 'nan' or desc == '':
                return False
            
            # Check for cost data in the correct columns
            for col_idx in [5, 8, 10, 11]:  # F, I, K, L columns (Material, Labor, Sub/Equip, Total)
                if len(row) > col_idx:
                    val = str(row.iloc[col_idx]).replace('$', '').replace(',', '').strip()
                    if val and val != '0' and val != '0.00' and val != 'nan':
                        try:
                            if float(val) > 0:
                                return True
                        except:
                            pass
            return False
        except:
            return False
    
    def _extract_totals(self, df: pd.DataFrame) -> Dict[str, float]:
        """Extract project subtotal, overhead & profit, job total from summary rows"""
        totals = {
            "projectSubtotal": 0.0,
            "overheadAndProfit": 0.0, 
            "jobTotal": 0.0
        }
        
        for index, row in df.iterrows():
            for cell in row:
                cell_str = str(cell).strip().lower()
                
                # Look for project subtotal
                if 'project subtotal' in cell_str:
                    # Find the total in the same row
                    for val in row:
                        if self._is_currency(str(val)):
                            totals["projectSubtotal"] = self._parse_currency(str(val))
                
                # Look for overhead & profit
                if 'overhead' in cell_str and 'profit' in cell_str:
                    for val in row:
                        if self._is_currency(str(val)):
                            totals["overheadAndProfit"] = self._parse_currency(str(val))
                
                # Look for job total
                if 'job total' in cell_str:
                    for val in row:
                        if self._is_currency(str(val)):
                            totals["jobTotal"] = self._parse_currency(str(val))
        
        return totals
    
    def _is_currency(self, text: str) -> bool:
        """Check if text looks like a currency value"""
        text = text.strip()
        return bool(re.match(r'^\$?[\d,]+\.?\d*$', text)) and len(text) > 3
    
    def _parse_currency(self, text: str) -> float:
        """Convert currency text to float"""
        clean = re.sub(r'[^\d.-]', '', text)
        try:
            return float(clean)
        except:
            return 0.0
    
    def to_division_pack(self, division_code: str, division_items: List[Dict[str, Any]]) -> str:
        """Generate a compact CSV-like text block for a single division (20-80 rows max)"""
        if not division_items:
            return ""
        
        # Create compact CSV-style representation
        pack_lines = [
            f"DIVISION: {division_code}",
            "Row,A_Division,C_Description,D_Qty,E_Unit,F_Material,I_Labor,K_SubEquip,L_Total,N_Scope,O_Notes"
        ]
        
        for item in division_items:
            line = f"{item['row_number']},{item['A']},{item['C']},{item['D']},{item['E']},{item['F']},{item['I']},{item['K']},{item['L']},{item['N']},{item['O']}"
            pack_lines.append(line)
        
        pack_text = "\n".join(pack_lines)
        print(f"Division {division_code} pack: {len(pack_lines)-2} rows, {len(pack_text)} characters")
        
        return pack_text
    
    def normalize_with_chatgpt(self, division_pack: str, division_code: str) -> Optional[Dict[str, Any]]:
        """Send compact division pack to ChatGPT for normalization"""
        try:
            if not division_pack.strip():
                return None
            
            prompt = f"""You are a construction estimator. Parse this division's data into normalized JSON.

{division_pack}

The data format is: Row,A_Division,C_Description,D_Qty,E_Unit,F_Material,I_Labor,K_SubEquip,L_Total,N_Scope,O_Notes

Rules:
1. Extract only real cost line items (skip subtotals, headers, blank rows)
2. For each valid item, create lineId as: divisionCode-slugified-description-rowNumber
3. Parse quantities from D_Qty, units from E_Unit
4. Parse costs: F_Material, I_Labor, K_SubEquip, L_Total
5. Extract scope notes from N_Scope and estimating notes from O_Notes
6. Use the values exactly as provided - DO NOT recalculate

Return JSON format:
{{
  "divisionCode": "{division_code}",
  "divisionName": "...",
  "items": [
    {{
      "lineId": "01-permit-job-14",
      "tradeDescription": "Permit - Job",
      "quantity": 1.0,
      "unit": "EA", 
      "materialCost": 0.0,
      "laborCost": 0.0,
      "subEquipCost": 1020.0,
      "totalCost": 1020.0,
      "scopeNotes": "...",
      "estimatingNotes": "..."
    }}
  ]
}}

Return ONLY the JSON - no explanations."""
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini", 
                messages=[
                    {"role": "system", "content": "You are a construction data normalizer. Return only valid JSON, no explanations."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0,
                max_tokens=4000
            )
            
            result = json.loads(response.choices[0].message.content)
            
            # Calculate division total from code (source of truth for math)
            division_total = sum(item.get('totalCost', 0) for item in result.get('items', []))
            result['divisionTotal'] = round(division_total, 2)
            
            print(f"Division {division_code} normalized: {len(result.get('items', []))} items, calculated total: ${division_total:.2f}")
            
            return result
            
        except Exception as e:
            print(f"Error normalizing division {division_code}: {str(e)}")
            return None
    
    async def parse_full_estimate(self, file_content: bytes, file_name: str, sheet_name: str) -> Dict[str, Any]:
        """Complete workflow: pandas parse → division-by-division AI → merge results"""
        try:
            print(f"Starting division-by-division parsing of {file_name}")
            
            # Step 1: Parse with pandas and group by division
            base_data = self.parse_excel_to_base_json(file_content, sheet_name)
            
            # Step 2: Process each division with AI using compact packs
            processed_divisions = []
            
            for division_code, division_items in base_data["divisions"].items():
                print(f"Processing division {division_code} with {len(division_items)} items")
                
                # Create compact division pack
                division_pack = self.to_division_pack(division_code, division_items)
                
                # Normalize with ChatGPT
                division_result = self.normalize_with_chatgpt(division_pack, division_code)
                if division_result:
                    processed_divisions.append(division_result)
            
            # Step 3: Combine results
            grand_total_from_items = sum(div.get('divisionTotal', 0) for div in processed_divisions)
            
            final_result = {
                "meta": base_data["meta"],
                "divisions": processed_divisions,
                "projectSubtotal": base_data["totals"]["projectSubtotal"],
                "overheadAndProfit": base_data["totals"]["overheadAndProfit"],
                "jobTotal": base_data["totals"]["jobTotal"], 
                "grandTotalFromItems": grand_total_from_items
            }
            
            print(f"Parsing complete: {len(processed_divisions)} divisions, ${grand_total_from_items:,.2f} total")
            
            return final_result
            
        except Exception as e:
            raise Exception(f"Division-by-division parsing failed: {str(e)}")