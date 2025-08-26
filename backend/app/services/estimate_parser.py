import pandas as pd
import io
import re
import json
import string
from typing import Dict, List, Any, Optional, Tuple
from openai import OpenAI
import os


class EstimateParser:
    """
    Deterministic Excel estimate parser that follows exact specifications:
    - Maps columns by meaning (header resolver), not position
    - Robust division detection
    - Excludes summary/terms rows
    - Outputs exact JSON contract with 2-decimal floats
    """
    
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # Header mapping patterns (case-insensitive, fuzzy match)
        self.header_mappings = {
            'division': ['division', 'div', 'section'],
            'tradeDescription': ['trade description', 'description', 'item', 'desc'],
            'quantity': ['qty', 'quantity'],
            'unit': ['unit', 'units', 'um', 'uom'],
            'materialCost': ['material subtotal', 'materials', 'material'],
            'laborCost': ['labor subtotal', 'labor'],
            'subEquipCost': ['sub/equip subtotal', 'subcontractor', 'equipment', 's/equip', 'sub equip'],
            'totalCost': ['budget total', 'total', 'line total'],
            'scopeNotes': ['scope notes', 'scope'],
            'estimatingNotes': ['estimating notes', 'notes']
        }
        
        # Skip patterns for summary rows (case-insensitive)
        self.skip_patterns = [
            r'subtotal',
            r'project subtotal', 
            r'overhead',
            r'profit',
            r'job total',
            r'payment terms',
            r'accepted by',
            r'terms',
            r'warranty',
            r'contingency',
            r'fee'
        ]
        
        # Valid unit normalizations
        self.valid_units = ['EA', 'LF', 'SF', 'SY', 'CY', 'HR', 'LS']
    
    def parse_estimate_xlsx(self, file_content: bytes, sheet_name: str) -> Dict[str, Any]:
        """
        Main entry point: Parse Excel estimate into exact JSON contract
        """
        try:
            # Read Excel sheet
            df = pd.read_excel(io.BytesIO(file_content), sheet_name=sheet_name)
            print(f"Loaded sheet '{sheet_name}' with {len(df)} rows, {len(df.columns)} columns")
            
            # Step 1: Resolve column headers
            column_map = self._resolve_headers(df)
            print(f"Resolved columns: {column_map}")
            
            # Step 2: Extract meta information
            meta = self._extract_meta(df)
            
            # Step 3: Parse line items with division detection
            divisions = self._parse_divisions_and_items(df, column_map)
            
            # Step 4: Extract Excel totals
            excel_totals = self._extract_excel_totals(df)
            
            # Step 5: Calculate totals from parsed items
            grand_total_from_items = sum(
                div['divisionTotal'] for div in divisions
            )
            
            # Step 6: Build final JSON contract
            result = {
                "meta": meta,
                "divisions": divisions,
                "projectSubtotal": excel_totals['projectSubtotal'],
                "overheadAndProfit": excel_totals['overheadAndProfit'],
                "jobTotal": excel_totals['jobTotal'],
                "grandTotalFromItems": round(grand_total_from_items, 2)
            }
            
            print(f"Parse complete: {len(divisions)} divisions, ${grand_total_from_items:.2f} total")
            
            # Validation
            self._validate_contract(result)
            
            return result
            
        except Exception as e:
            raise Exception(f"Parse failed: {str(e)}")
    
    def _resolve_headers(self, df: pd.DataFrame) -> Dict[str, Optional[str]]:
        """
        Scan header rows 2-6 and map columns by meaning, not position
        """
        column_map = {}
        
        # Look in rows 1-5 for headers (0-indexed)
        for row_idx in range(min(6, len(df))):
            row = df.iloc[row_idx]
            
            for field, patterns in self.header_mappings.items():
                if field in column_map:
                    continue  # Already found
                
                for col_idx, cell_value in enumerate(row):
                    if pd.isna(cell_value):
                        continue
                    
                    # Normalize cell value
                    normalized = self._normalize_header(str(cell_value))
                    
                    # Check if it matches any pattern for this field
                    for pattern in patterns:
                        if pattern in normalized:
                            column_map[field] = df.columns[col_idx]
                            print(f"Mapped {field} -> {df.columns[col_idx]} (found '{cell_value}')")
                            break
                    
                    if field in column_map:
                        break
        
        return column_map
    
    def _normalize_header(self, header: str) -> str:
        """
        Normalize header string for fuzzy matching
        """
        # Strip, lower, remove punctuation
        normalized = header.strip().lower()
        normalized = ''.join(c for c in normalized if c.isalnum() or c.isspace())
        normalized = ' '.join(normalized.split())  # Collapse whitespace
        return normalized
    
    def _extract_meta(self, df: pd.DataFrame) -> Dict[str, Optional[str]]:
        """
        Extract client, project, date from header rows
        """
        meta = {"client": None, "project": None, "date": None}
        
        # Look in first 10 rows
        for row_idx in range(min(10, len(df))):
            row = df.iloc[row_idx]
            
            for col_idx, cell_value in enumerate(row):
                if pd.isna(cell_value):
                    continue
                
                cell_str = str(cell_value).strip().lower()
                
                # Look for meta keywords and extract adjacent value
                if 'client' in cell_str and col_idx + 1 < len(row):
                    next_val = row.iloc[col_idx + 1]
                    if not pd.isna(next_val):
                        meta["client"] = str(next_val).strip()
                
                if 'project' in cell_str and col_idx + 1 < len(row):
                    next_val = row.iloc[col_idx + 1]
                    if not pd.isna(next_val):
                        meta["project"] = str(next_val).strip()
                
                if 'date' in cell_str and col_idx + 1 < len(row):
                    next_val = row.iloc[col_idx + 1]
                    if not pd.isna(next_val):
                        meta["date"] = str(next_val).strip()
        
        return meta
    
    def _parse_divisions_and_items(self, df: pd.DataFrame, column_map: Dict[str, str]) -> List[Dict[str, Any]]:
        """
        Parse divisions and line items with robust division detection
        """
        divisions = []
        current_division_code = None
        current_division_name = None
        current_items = []
        
        for row_idx, row in df.iterrows():
            # Check for division header
            division_info = self._detect_division(row, column_map)
            if division_info:
                # Save previous division if it has items
                if current_division_code and current_items:
                    division_total = sum(item['totalCost'] for item in current_items)
                    divisions.append({
                        "divisionCode": current_division_code,
                        "divisionName": current_division_name or f"Division {current_division_code}",
                        "items": current_items,
                        "divisionTotal": round(division_total, 2)
                    })
                
                # Start new division
                current_division_code = division_info['code']
                current_division_name = division_info['name']
                current_items = []
                continue
            
            # Check for line item
            if current_division_code:
                line_item = self._parse_line_item(row, row_idx, column_map, current_division_code)
                if line_item:
                    current_items.append(line_item)
        
        # Don't forget the last division
        if current_division_code and current_items:
            division_total = sum(item['totalCost'] for item in current_items)
            divisions.append({
                "divisionCode": current_division_code,
                "divisionName": current_division_name or f"Division {current_division_code}",
                "items": current_items,
                "divisionTotal": round(division_total, 2)
            })
        
        return divisions
    
    def _detect_division(self, row, column_map: Dict[str, str]) -> Optional[Dict[str, str]]:
        """
        Detect division header row based on patterns:
        - First column is 1-2 digits (^\d{1,2}$) or
        - Description starts with ^\s*(\d{2})\s*[-–]\s*(.+)
        """
        # Check first column for simple digit pattern
        if len(row) > 0 and not pd.isna(row.iloc[0]):
            first_cell = str(row.iloc[0]).strip()
            if re.match(r'^\d{1,2}$', first_cell):
                # Look for name in description column or next cell
                name = ""
                if 'tradeDescription' in column_map:
                    desc_col = column_map['tradeDescription']
                    if desc_col in df.columns:
                        desc_val = row[desc_col]
                        if not pd.isna(desc_val):
                            name = str(desc_val).strip()
                
                return {
                    'code': first_cell.zfill(2),  # Pad to 2 digits
                    'name': name
                }
        
        # Check description column for pattern like "02 - Site Work"
        if 'tradeDescription' in column_map:
            desc_col = column_map['tradeDescription']
            if desc_col in df.columns and not pd.isna(row[desc_col]):
                desc_value = str(row[desc_col]).strip()
                match = re.match(r'^\s*(\d{2})\s*[-–]\s*(.+)', desc_value)
                if match:
                    return {
                        'code': match.group(1),
                        'name': match.group(2).strip()
                    }
        
        return None
    
    def _parse_line_item(self, row, row_idx: int, column_map: Dict[str, str], division_code: str) -> Optional[Dict[str, Any]]:
        """
        Parse a single line item if it's valid
        """
        # Get description
        description = ""
        if 'tradeDescription' in column_map and column_map['tradeDescription']:
            desc_val = row[column_map['tradeDescription']]
            if not pd.isna(desc_val):
                description = str(desc_val).strip()
        
        if not description:
            return None
        
        # Skip summary rows
        if self._should_skip_row(description):
            return None
        
        # Extract costs
        material_cost = self._extract_cost(row, column_map.get('materialCost'))
        labor_cost = self._extract_cost(row, column_map.get('laborCost'))
        subequip_cost = self._extract_cost(row, column_map.get('subEquipCost'))
        total_cost = self._extract_cost(row, column_map.get('totalCost'))
        
        # Skip if all costs are zero
        if material_cost == 0 and labor_cost == 0 and subequip_cost == 0 and total_cost == 0:
            return None
        
        # Calculate total if missing
        if total_cost == 0:
            total_cost = material_cost + labor_cost + subequip_cost
        
        # Extract other fields
        quantity = self._extract_quantity(row, column_map.get('quantity'))
        unit = self._extract_unit(row, column_map.get('unit'))
        scope_notes = self._extract_notes(row, column_map.get('scopeNotes'))
        estimating_notes = self._extract_notes(row, column_map.get('estimatingNotes'))
        
        # Generate stable lineId
        line_id = self._generate_line_id(division_code, description, row_idx)
        
        return {
            "lineId": line_id,
            "tradeDescription": description,
            "quantity": round(quantity, 2),
            "unit": unit,
            "materialCost": round(material_cost, 2),
            "laborCost": round(labor_cost, 2),
            "subEquipCost": round(subequip_cost, 2),
            "totalCost": round(total_cost, 2),
            "scopeNotes": scope_notes,
            "estimatingNotes": estimating_notes
        }
    
    def _should_skip_row(self, description: str) -> bool:
        """
        Check if row should be skipped based on skip patterns
        """
        desc_lower = description.lower()
        for pattern in self.skip_patterns:
            if re.search(pattern, desc_lower):
                return True
        return False
    
    def _extract_cost(self, row, column_name: Optional[str]) -> float:
        """
        Extract and clean cost value
        """
        if not column_name or column_name not in row.index:
            return 0.0
        
        value = row[column_name]
        if pd.isna(value):
            return 0.0
        
        # Clean currency format
        clean_value = re.sub(r'[^\d.-]', '', str(value))
        try:
            return float(clean_value) if clean_value else 0.0
        except:
            return 0.0
    
    def _extract_quantity(self, row, column_name: Optional[str]) -> float:
        """
        Extract quantity value
        """
        if not column_name or column_name not in row.index:
            return 1.0
        
        value = row[column_name]
        if pd.isna(value):
            return 1.0
        
        try:
            return float(value)
        except:
            return 1.0
    
    def _extract_unit(self, row, column_name: Optional[str]) -> Optional[str]:
        """
        Extract and normalize unit
        """
        if not column_name or column_name not in row.index:
            return None
        
        value = row[column_name]
        if pd.isna(value):
            return None
        
        unit_str = str(value).strip().upper()
        
        # Normalize to valid units
        for valid_unit in self.valid_units:
            if valid_unit in unit_str:
                return valid_unit
        
        return None
    
    def _extract_notes(self, row, column_name: Optional[str]) -> Optional[str]:
        """
        Extract notes field
        """
        if not column_name or column_name not in row.index:
            return None
        
        value = row[column_name]
        if pd.isna(value):
            return None
        
        notes = str(value).strip()
        return notes if notes else None
    
    def _generate_line_id(self, division_code: str, description: str, row_idx: int) -> str:
        """
        Generate stable lineId: {divisionCode}-{optionalCSI-}{slug(desc)[:24]}-{rowIndex}
        """
        # Extract optional CSI code from description
        csi_match = re.search(r'\b(\d{3,4})\b', description)
        csi_part = f"{csi_match.group(1)}-" if csi_match else ""
        
        # Create slug from description
        slug = re.sub(r'[^\w\s-]', '', description.lower())
        slug = re.sub(r'[-\s]+', '-', slug)
        slug = slug[:24].rstrip('-')
        
        return f"{division_code}-{csi_part}{slug}-{row_idx}"
    
    def _extract_excel_totals(self, df: pd.DataFrame) -> Dict[str, float]:
        """
        Extract Excel totals (Project Subtotal, Overhead & Profit, Job Total)
        """
        totals = {
            "projectSubtotal": 0.0,
            "overheadAndProfit": 0.0,
            "jobTotal": 0.0
        }
        
        for row_idx, row in df.iterrows():
            for cell_value in row:
                if pd.isna(cell_value):
                    continue
                
                cell_str = str(cell_value).strip().lower()
                
                # Look for project subtotal
                if 'project subtotal' in cell_str:
                    total_val = self._find_currency_in_row(row)
                    if total_val:
                        totals["projectSubtotal"] = total_val
                
                # Look for overhead & profit
                if 'overhead' in cell_str and 'profit' in cell_str:
                    total_val = self._find_currency_in_row(row)
                    if total_val:
                        totals["overheadAndProfit"] = total_val
                
                # Look for job total
                if 'job total' in cell_str:
                    total_val = self._find_currency_in_row(row)
                    if total_val:
                        totals["jobTotal"] = total_val
        
        return totals
    
    def _find_currency_in_row(self, row) -> Optional[float]:
        """
        Find currency value in a row
        """
        for cell_value in row:
            if pd.isna(cell_value):
                continue
            
            cell_str = str(cell_value).strip()
            if re.match(r'^\$?[\d,]+\.?\d*$', cell_str) and len(cell_str) > 3:
                clean_value = re.sub(r'[^\d.-]', '', cell_str)
                try:
                    return round(float(clean_value), 2)
                except:
                    continue
        return None
    
    def _validate_contract(self, result: Dict[str, Any]) -> None:
        """
        Validate output matches JSON contract
        """
        # Check grandTotalFromItems equals sum of division totals
        expected_grand_total = sum(div['divisionTotal'] for div in result['divisions'])
        if abs(result['grandTotalFromItems'] - expected_grand_total) > 0.01:
            raise Exception(f"grandTotalFromItems mismatch: {result['grandTotalFromItems']} != {expected_grand_total}")
        
        # Validate all floats are 2 decimals
        for division in result['divisions']:
            for item in division['items']:
                for field in ['quantity', 'materialCost', 'laborCost', 'subEquipCost', 'totalCost']:
                    value = item[field]
                    if not isinstance(value, (int, float)) or round(value, 2) != value:
                        raise Exception(f"Invalid decimal format for {field}: {value}")
    
    def to_division_pack(self, division_obj: Dict[str, Any]) -> str:
        """
        Generate compact text block for ChatGPT processing
        """
        if not division_obj.get('items'):
            return ""
        
        lines = [
            f"DIVISION_CODE: {division_obj['divisionCode']}",
            f"DIVISION_NAME: {division_obj['divisionName']}",
            "ROWS:"
        ]
        
        for item in division_obj['items']:
            line = (
                f"- [row={item['lineId'].split('-')[-1]}] "
                f'"{item["tradeDescription"]}" | '
                f'qty={item["quantity"]} | '
                f'unit={item["unit"] or "null"} | '
                f'material={item["materialCost"]} | '
                f'labor={item["laborCost"]} | '
                f'subequip={item["subEquipCost"]} | '
                f'total={item["totalCost"]} | '
                f'scope="{item["scopeNotes"] or ""}" | '
                f'est="{item["estimatingNotes"] or "null"}"'
            )
            lines.append(line)
        
        return "\n".join(lines)
    
    def normalize_with_chatgpt(self, pack: str) -> Dict[str, Any]:
        """
        Send division pack to ChatGPT for text normalization
        Keep code's numbers as source of truth
        """
        try:
            if not pack.strip():
                return {}
            
            prompt = f"""You are a construction data normalizer. Clean up this division's text while keeping all numbers exactly the same.

{pack}

Rules:
1. Keep ALL numeric values exactly as provided (quantities, costs) 
2. Clean up tradeDescription text (fix typos, standardize format)
3. Normalize units to: EA, LF, SF, SY, CY, HR, LS (or null if unclear)
4. Clean up scope notes and estimating notes
5. Return JSON matching the exact structure

Return JSON format:
{{
  "divisionCode": "XX",
  "divisionName": "cleaned name",
  "items": [
    {{
      "lineId": "same as input",
      "tradeDescription": "cleaned description",
      "quantity": exact_number_from_input,
      "unit": "normalized_unit_or_null",
      "materialCost": exact_number_from_input,
      "laborCost": exact_number_from_input,
      "subEquipCost": exact_number_from_input,
      "totalCost": exact_number_from_input,
      "scopeNotes": "cleaned_notes_or_null",
      "estimatingNotes": "cleaned_notes_or_null"
    }}
  ]
}}

Return ONLY valid JSON, no explanations."""
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a construction data normalizer. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0,
                max_tokens=4000
            )
            
            result = json.loads(response.choices[0].message.content)
            
            # Calculate division total from items
            if 'items' in result:
                division_total = sum(item.get('totalCost', 0) for item in result['items'])
                result['divisionTotal'] = round(division_total, 2)
            
            return result
            
        except Exception as e:
            print(f"ChatGPT normalization failed: {str(e)}")
            return {}