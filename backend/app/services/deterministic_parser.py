import pandas as pd
import re
import json
from typing import Dict, List, Any, Optional


def parse_estimate_xlsx(xlsx_path: str) -> dict:
    """Implements the steps above and returns the project-level JSON."""
    
    # Step 1 — Read
    df = pd.read_excel(xlsx_path, sheet_name="Estimate - Shed", header=None)
    df = df.fillna('')
    
    # Step 2 — Find bottom summary rows (scan upward in column C)
    project_subtotal_raw = None
    project_subtotal_idx = None
    overhead_profit_raw = None
    job_total_raw = None
    
    # Scan from bottom up
    for i in range(len(df) - 1, -1, -1):
        desc = str(df.iloc[i, 2]).strip().lower()
        
        if 'project subtotal' in desc and project_subtotal_raw is None:
            project_subtotal_raw = _parse_currency(df.iloc[i, 12])
            project_subtotal_idx = i
            print(f"Found Project Subtotal at row {i}: ${project_subtotal_raw}")
        
        if 'overhead' in desc and 'profit' in desc and overhead_profit_raw is None:
            overhead_profit_raw = _parse_currency(df.iloc[i, 12])
            print(f"Found Overhead & Profit at row {i}: ${overhead_profit_raw}")
        
        if 'job total' in desc and job_total_raw is None:
            job_total_raw = _parse_currency(df.iloc[i, 12])
            print(f"Found Job Total at row {i}: ${job_total_raw}")
    
    if project_subtotal_idx is None:
        raise Exception("Could not find Project Subtotal row")
    
    # Step 3 — Parse items up to, but not including, the Project Subtotal row
    divisions = []
    current_division = None
    
    # Iterate rows from 6 to project_subtotal_idx - 1
    for row_idx in range(6, project_subtotal_idx):
        row = df.iloc[row_idx]
        
        # Division detection: when column A is 1–2 digit int
        div_code_raw = str(row.iloc[0]).strip()
        if re.match(r'^\d{1,2}$', div_code_raw):
            # Close previous division
            if current_division and current_division['items']:
                _finalize_division(current_division)
                divisions.append(current_division)
            
            # Start new division
            division_code = div_code_raw.zfill(2)
            division_name = str(row.iloc[2]).strip()
            current_division = {
                'divisionCode': division_code,
                'divisionName': division_name,
                'items': []
            }
            print(f"Started Division {division_code}: {division_name}")
            continue
        
        # Skip if no current division
        if not current_division:
            continue
        
        # Get description
        description = str(row.iloc[2]).strip()
        
        # Skip empty descriptions
        if not description or description == 'nan':
            continue
        
        # Skip summary rows (case-insensitive, end-anchored)
        skip_patterns = [r'(subtotal|job total|payment terms|accepted by|terms|warranty)$']
        if any(re.search(pattern, description, re.IGNORECASE) for pattern in skip_patterns):
            continue
        
        # Extract costs
        material_cost = _parse_currency(row.iloc[7])  # H
        labor_cost = _parse_currency(row.iloc[9])     # J
        subequip_cost = _parse_currency(row.iloc[11]) # L
        total_cost = _parse_currency(row.iloc[12])    # M
        
        # Include if any cost > 0
        if material_cost > 0 or labor_cost > 0 or subequip_cost > 0 or total_cost > 0:
            # Calculate total
            calc_total = total_cost if total_cost > 0 else (material_cost + labor_cost + subequip_cost)
            
            # Extract other fields
            quantity = _parse_number(row.iloc[3])  # D
            unit = _normalize_unit(str(row.iloc[4]).strip())  # E
            scope_notes = str(row.iloc[13]).strip() if str(row.iloc[13]).strip() != 'nan' else None  # N
            estimating_notes = str(row.iloc[14]).strip() if str(row.iloc[14]).strip() != 'nan' else None  # O
            
            # Build lineId
            line_id = f"{current_division['divisionCode']}-{_slugify(description)[:24]}-{row_idx}"
            
            item = {
                'lineId': line_id,
                'tradeDescription': description,
                'quantity': round(quantity, 2) if quantity is not None else None,
                'unit': unit,
                'materialCost': round(material_cost, 2),
                'laborCost': round(labor_cost, 2),
                'subEquipCost': round(subequip_cost, 2),
                'totalCost': round(calc_total, 2),
                'scopeNotes': scope_notes,
                'estimatingNotes': estimating_notes
            }
            
            current_division['items'].append(item)
            print(f"  Added item: {description[:40]} - ${calc_total:.2f}")
    
    # Step 4 — Close last division, compute totals
    if current_division and current_division['items']:
        _finalize_division(current_division)
        divisions.append(current_division)
    
    # Calculate grand total from items
    grand_total_from_items = sum(div['divisionTotal'] for div in divisions)
    
    # Step 5 — Set project totals (match spreadsheet)
    project_subtotal = project_subtotal_raw or 0.0
    overhead_profit = overhead_profit_raw or 0.0
    job_total = job_total_raw or 0.0
    
    # Assert reconciliation
    if abs(project_subtotal - grand_total_from_items) > 0.01:
        raise Exception(f"Parsed items don't reconcile with Project Subtotal: {grand_total_from_items:.2f} vs {project_subtotal:.2f}")
    
    print(f"✅ Reconciliation passed: ${grand_total_from_items:.2f} ≈ ${project_subtotal:.2f}")
    
    # Step 6 — Meta
    client = str(df.iloc[0, 2]).strip() if str(df.iloc[0, 2]).strip() != 'nan' else None
    project = str(df.iloc[1, 2]).strip() if str(df.iloc[1, 2]).strip() != 'nan' else None
    date = str(df.iloc[2, 2]).strip() if str(df.iloc[2, 2]).strip() != 'nan' else None
    
    # Step 7 — Return JSON exactly in the schema
    result = {
        "meta": {
            "client": client,
            "project": project,
            "date": date
        },
        "divisions": divisions,
        "projectSubtotal": round(project_subtotal, 2),
        "overheadAndProfit": round(overhead_profit, 2),
        "jobTotal": round(job_total, 2),
        "grandTotalFromItems": round(grand_total_from_items, 2)
    }
    
    print(f"Parser complete: {len(divisions)} divisions, ${grand_total_from_items:.2f} total")
    return result


def to_division_pack(division: dict) -> str:
    """
    Returns a compact text block we'll pass to ChatGPT later, e.g.:

    DIVISION_CODE: 08
    DIVISION_NAME: Electrical
    ROWS:
    - [row=742] "Electrical Allowance" | qty=null | unit=null |
      material=0.00 | labor=0.00 | subequip=0.00 | total=25000.00 |
      scope=null | est=null
    """
    if not division.get('items'):
        return ""
    
    lines = [
        f"DIVISION_CODE: {division['divisionCode']}",
        f"DIVISION_NAME: {division['divisionName']}",
        "ROWS:"
    ]
    
    for item in division['items']:
        # Extract row number from lineId (last part after final dash)
        line_id = item['lineId']
        row_num = line_id.split('-')[-1] if '-' in line_id else 'unknown'
        
        # Format values, handling None
        qty = item['quantity'] if item['quantity'] is not None else 'null'
        unit = f'"{item["unit"]}"' if item['unit'] else 'null'
        scope = f'"{item["scopeNotes"]}"' if item['scopeNotes'] else 'null'
        est = f'"{item["estimatingNotes"]}"' if item['estimatingNotes'] else 'null'
        
        line = (
            f'- [row={row_num}] "{item["tradeDescription"]}" | '
            f'qty={qty} | unit={unit} | '
            f'material={item["materialCost"]:.2f} | '
            f'labor={item["laborCost"]:.2f} | '
            f'subequip={item["subEquipCost"]:.2f} | '
            f'total={item["totalCost"]:.2f} | '
            f'scope={scope} | est={est}'
        )
        lines.append(line)
    
    return '\n'.join(lines)


def save_project_json(data: dict, out_path: str) -> None:
    """Write pretty-printed JSON to disk."""
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved project JSON to: {out_path}")


# Helper functions
def _finalize_division(division: dict) -> None:
    """Calculate division total from items"""
    division_total = sum(item['totalCost'] for item in division['items'])
    division['divisionTotal'] = round(division_total, 2)
    print(f"  Division {division['divisionCode']} total: ${division_total:.2f} ({len(division['items'])} items)")


def _parse_currency(value) -> float:
    """Convert currency text to float"""
    if pd.isna(value) or value == '':
        return 0.0
    
    try:
        # Remove currency symbols and commas
        clean_str = re.sub(r'[^\d.-]', '', str(value))
        return float(clean_str) if clean_str else 0.0
    except:
        return 0.0


def _parse_number(value) -> Optional[float]:
    """Convert number text to float, return None if empty"""
    if pd.isna(value) or value == '' or str(value).strip() == 'nan':
        return None
    
    try:
        return float(str(value).strip())
    except:
        return None


def _normalize_unit(unit: str) -> Optional[str]:
    """Normalize units to standard set"""
    if not unit or unit == 'nan':
        return None
    
    unit_upper = unit.upper()
    valid_units = ['EA', 'LF', 'SF', 'SY', 'CY', 'HR', 'LS', 'MO']
    
    # Direct match
    if unit_upper in valid_units:
        return unit_upper
    
    # Common variations
    unit_map = {
        'EACH': 'EA',
        'LINEAR': 'LF',
        'LINEAL': 'LF',
        'SQUARE': 'SF',
        'SQ': 'SF',
        'CUBIC': 'CY',
        'HOUR': 'HR',
        'HOURS': 'HR',
        'LUMP': 'LS',
        'MONTH': 'MO',
        'MONTHS': 'MO'
    }
    
    return unit_map.get(unit_upper, None)


def _slugify(text: str) -> str:
    """Convert text to URL-safe slug"""
    # Convert to lowercase and replace non-alphanumeric with hyphens
    slug = re.sub(r'[^a-zA-Z0-9\s]', '', text.lower())
    slug = re.sub(r'\s+', '-', slug.strip())
    return slug