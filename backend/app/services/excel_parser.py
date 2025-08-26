import pandas as pd
import re
from typing import List, Dict, Any, Tuple, Optional
import io

class ExcelBudgetParser:
    """Intelligent Excel parser for multi-tab construction budgets"""
    
    def __init__(self):
        # Keywords that indicate a budget/estimate sheet - PRIORITIZE "ESTIMATE"
        self.high_priority_keywords = [
            'estimate'  # This gets +50 points - highest priority
        ]
        self.budget_keywords = [
            'budget', 'cost', 'summary', 'total',
            'line item', 'division', 'scope', 'take', 'takeoff', 'quantity'
        ]
        self.avoid_keywords = [
            'pricing', 'price', 'cover', 'summary only', 'notes', 'instructions', 'template'
        ]
        
        # Common column name variations for construction budgets
        self.column_mappings = {
            # Division/CSI codes
            'division': ['div', 'division', 'csi', 'csi division', 'trade', 'section'],
            # Descriptions
            'description': ['desc', 'description', 'item', 'work item', 'scope', 'activity', 'task'],
            # Quantities
            'quantity': ['qty', 'quantity', 'amount', 'take', 'takeoff', 'units'],
            # Units of measure
            'unit': ['unit', 'units', 'um', 'uom', 'measure', 'each'],
            # Costs
            'unit_cost': ['unit cost', 'cost', 'price', 'rate', 'unit price', 'cost per unit'],
            'total_cost': ['total', 'total cost', 'amount', 'extended', 'line total', 'subtotal']
        }
    
    def analyze_workbook(self, file_content: bytes) -> Dict[str, Any]:
        """Analyze all worksheets and suggest the best one for budget data"""
        try:
            # Read all sheets
            excel_file = pd.ExcelFile(io.BytesIO(file_content))
            sheet_analysis = []
            print(f"Found {len(excel_file.sheet_names)} sheets: {excel_file.sheet_names}")
            
            for sheet_name in excel_file.sheet_names:
                try:
                    print(f"Processing sheet: {sheet_name}")
                    # Read first 20 rows to analyze
                    df = pd.read_excel(io.BytesIO(file_content), sheet_name=sheet_name, nrows=20)
                    print(f"Sheet {sheet_name}: {len(df)} rows, {len(df.columns)} columns")
                    
                    score = self._score_sheet(sheet_name, df)
                    column_suggestions = self._suggest_columns(df)
                    
                    # Clean preview data to remove NaN values and ensure JSON serializable
                    if not df.empty:
                        preview_df = df.head(3).fillna('')
                        # Convert all data to strings to avoid any JSON serialization issues
                        preview_df = preview_df.astype(str)
                        preview_data = preview_df.to_dict('records')
                    else:
                        preview_data = []
                    
                    # Ensure column suggestions don't have NaN values
                    clean_suggestions = {}
                    for k, v in column_suggestions.items():
                        if v is not None and str(v) != 'nan':
                            clean_suggestions[k] = str(v)
                        else:
                            clean_suggestions[k] = None
                    
                    sheet_info = {
                        'sheet_name': sheet_name,
                        'score': float(score) if not pd.isna(score) else 0.0,
                        'row_count': int(len(df)),
                        'column_count': int(len(df.columns)),
                        'suggested_columns': clean_suggestions,
                        'preview': preview_data
                    }
                    
                    sheet_analysis.append(sheet_info)
                    print(f"Successfully processed sheet: {sheet_name}")
                    
                except Exception as e:
                    print(f"Error processing sheet {sheet_name}: {str(e)}")
                    # Skip problematic sheets
                    sheet_analysis.append({
                        'sheet_name': sheet_name,
                        'score': 0,
                        'error': str(e)
                    })
            
            # Sort by score (highest first)
            sheet_analysis.sort(key=lambda x: x.get('score', 0), reverse=True)
            
            return {
                'total_sheets': len(excel_file.sheet_names),
                'sheet_analysis': sheet_analysis,
                'recommended_sheet': sheet_analysis[0]['sheet_name'] if sheet_analysis else None
            }
            
        except Exception as e:
            raise Exception(f"Error analyzing Excel workbook: {str(e)}")
    
    def _score_sheet(self, sheet_name: str, df: pd.DataFrame) -> float:
        """Score a worksheet based on how likely it contains budget data"""
        score = 0.0
        
        # Score based on sheet name with HEAVY preference for "Estimate"
        sheet_name_lower = sheet_name.lower()
        
        # High priority keywords get massive boost
        for keyword in self.high_priority_keywords:
            if keyword in sheet_name_lower:
                score += 50.0  # HUGE boost for "estimate"
        
        # Regular budget keywords
        for keyword in self.budget_keywords:
            if keyword in sheet_name_lower:
                score += 10.0
        
        # Heavy penalty for avoid keywords
        for keyword in self.avoid_keywords:
            if keyword in sheet_name_lower:
                score -= 30.0  # Strong penalty for "pricing", "price", etc.
        
        if df.empty:
            return score
        
        # Score based on column headers
        columns_lower = [str(col).lower() for col in df.columns]
        for category, variations in self.column_mappings.items():
            for variation in variations:
                if any(variation in col for col in columns_lower):
                    score += 5.0
                    break
        
        # Score based on numeric data presence
        numeric_cols = df.select_dtypes(include=['number']).columns
        score += len(numeric_cols) * 2.0
        
        # Score based on row count (budget sheets usually have many line items)
        if len(df) > 10:
            score += 5.0
        if len(df) > 50:
            score += 10.0
        
        return max(0.0, score)
    
    def _suggest_columns(self, df: pd.DataFrame) -> Dict[str, Optional[str]]:
        """Suggest which columns map to which budget fields"""
        suggestions = {}
        columns_lower = [str(col).lower() for col in df.columns]
        
        for field, variations in self.column_mappings.items():
            best_match = None
            best_score = 0
            
            for i, col in enumerate(columns_lower):
                for variation in variations:
                    if variation in col:
                        # Exact matches score higher
                        score = 10 if variation == col else 5
                        # Earlier columns score slightly higher (common convention)
                        score += (len(columns_lower) - i) * 0.1
                        
                        if score > best_score:
                            best_score = score
                            best_match = df.columns[i]
            
            suggestions[field] = best_match
        
        return suggestions
    
    def parse_selected_sheet(
        self, 
        file_content: bytes, 
        sheet_name: str, 
        column_mapping: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """Parse the selected sheet with optional custom column mapping"""
        try:
            # Read the specified sheet
            df = pd.read_excel(io.BytesIO(file_content), sheet_name=sheet_name)
            
            if df.empty:
                raise Exception(f"Sheet '{sheet_name}' is empty")
            
            # Clean column names
            df.columns = df.columns.astype(str).str.strip()
            
            # Apply column mapping if provided, otherwise use auto-detection
            if column_mapping:
                # Convert Excel column letters (A, B, C) to actual column names
                mapped_columns = {}
                df_columns = list(df.columns)
                print(f"Available columns: {df_columns}")
                
                for field, col_ref in column_mapping.items():
                    if col_ref and col_ref.strip():
                        # If it's a single letter (A, B, C), convert to column name
                        if len(col_ref) == 1 and col_ref.isalpha():
                            col_index = ord(col_ref.upper()) - ord('A')
                            if 0 <= col_index < len(df_columns):
                                mapped_columns[field] = df_columns[col_index]
                                print(f"Mapped {field} -> Column {col_ref} ({df_columns[col_index]})")
                            else:
                                print(f"Warning: Column {col_ref} index {col_index} out of range")
                        else:
                            # Use as-is (already a column name)
                            mapped_columns[field] = col_ref
                            print(f"Mapped {field} -> {col_ref}")
            else:
                # Auto-detect columns
                suggested = self._suggest_columns(df)
                mapped_columns = {k: v for k, v in suggested.items() if v is not None}
            
            # Validate required columns are mapped
            required_fields = ['description']  # Only description is truly required
            missing_required = [field for field in required_fields if field not in mapped_columns or not mapped_columns[field]]
            
            if missing_required:
                available_cols = list(df.columns)
                raise Exception(f"Cannot find required columns: {missing_required}. Available columns: {available_cols}")
            
            # Extract and clean data
            budget_items = []
            
            for index, row in df.iterrows():
                try:
                    # Skip rows where description is empty
                    desc_col = mapped_columns.get('description')
                    if not desc_col or pd.isna(row[desc_col]) or str(row[desc_col]).strip() == '':
                        continue
                    
                    item = {
                        'division': self._safe_extract(row, mapped_columns.get('division'), str, ''),
                        'description': self._safe_extract(row, mapped_columns.get('description'), str, '').strip(),
                        'quantity': self._safe_extract(row, mapped_columns.get('quantity'), float, 0.0),
                        'unit': self._safe_extract(row, mapped_columns.get('unit'), str, 'LS'),
                        'unit_cost': self._safe_extract(row, mapped_columns.get('unit_cost'), float, 0.0),
                        'total_cost': self._safe_extract(row, mapped_columns.get('total_cost'), float, 0.0),
                        'notes': self._safe_extract(row, mapped_columns.get('notes'), str, None)
                    }
                    
                    # Calculate missing values
                    if item['unit_cost'] == 0 and item['total_cost'] > 0 and item['quantity'] > 0:
                        item['unit_cost'] = item['total_cost'] / item['quantity']
                    elif item['total_cost'] == 0 and item['unit_cost'] > 0 and item['quantity'] > 0:
                        item['total_cost'] = item['unit_cost'] * item['quantity']
                    
                    # Only include rows with meaningful content
                    if item['description'] and len(item['description']) > 2:
                        budget_items.append(item)
                        
                except Exception as e:
                    # Log problematic rows but continue processing
                    print(f"Warning: Skipping row {index}: {str(e)}")
                    continue
            
            return budget_items
            
        except Exception as e:
            raise Exception(f"Error parsing sheet '{sheet_name}': {str(e)}")
    
    def _safe_extract(self, row, column_name: Optional[str], data_type, default_value):
        """Safely extract and convert data from a row"""
        if not column_name or column_name not in row:
            return default_value
        
        value = row[column_name]
        if pd.isna(value):
            return default_value
        
        try:
            if data_type == float:
                # Handle currency symbols, commas, etc.
                if isinstance(value, str):
                    clean_value = re.sub(r'[^\d.-]', '', value)
                    return float(clean_value) if clean_value else default_value
                return float(value)
            elif data_type == str:
                return str(value).strip()
            else:
                return data_type(value)
        except:
            return default_value