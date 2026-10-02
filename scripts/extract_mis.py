#!/usr/bin/env python3
"""Pre-parse Kisan Samruddhi MIS workbook into JSON for Node seeder."""
import json, re, openpyxl, sys
from datetime import datetime, date

SRC = '/app/data/kisan.xlsx'
OUT = '/app/data/mis_seed.json'

wb = openpyxl.load_workbook(SRC, data_only=True, read_only=True)

def clean(v):
    if v is None: return None
    if isinstance(v, (datetime, date)): return v.isoformat()[:10]
    if isinstance(v, str):
        v = v.strip()
        if v in ('—', '-', '', 'N/A', 'na', 'NA'): return None
        return v
    return v

def num(v):
    v = clean(v)
    if v is None: return None
    if isinstance(v, (int, float)): return float(v)
    try: return float(str(v).replace(',','').replace('₹','').strip())
    except: return None

# ========== FARMER MASTER ==========
farmers = []
ws = wb['1_Farmer_Master']
for i, r in enumerate(ws.iter_rows(values_only=True, min_row=4)):
    code = clean(r[0])
    if not code or not re.match(r'^AGR-[A-Z]{3}-\d{3,4}$', str(code)): continue
    farmers.append({
        'farmer_code': code,
        'head_of_family_name': clean(r[1]) or 'Unknown',
        'respondent_name': clean(r[2]),
        'village': clean(r[3]),
        'hamlet': clean(r[4]),
        'mobile_number': clean(r[7]),
        'social_group': clean(r[8]),
        'land_owned': num(r[9]),
        'land_cultivated': num(r[10]),
        'rabi_area': num(r[11]),
        'kharif_area': num(r[12]),
        'summer_area': num(r[13]),
        'fig_group': clean(r[14]),
        'ffs_group': clean(r[15]),
        'baseline_expenditure': num(r[16]),
        'agri_expenditure': num(r[17]),
        'survey_date': clean(r[18]),
    })

# ========== INCOME IMPACT ==========
# Headers row 4 (0-indexed 3): col D-L = baseline sources, N = baseline total, N also = baseline exp col
# D=3 base_crop, E=4 base_labour, F=5 base_livestock, G=6 base_mgnrega, H=7 base_salary,
# I=8 base_handicraft, J=9 base_business, K=10 base_ntfp, L=11 base_other, M=12 base_total, N=13 base_exp
# O=14 curr_crop, P=15 curr_labour, Q=16 curr_livestock, R=17 curr_mgnrega, S=18 curr_salary,
# T=19 curr_handicraft, U=20 curr_business, V=21 curr_ntfp, W=22 curr_other, X=23 curr_total, Y=24 curr_exp
income = []
ws = wb['11_Income_Impact']
SOURCE_CODES = ['AGRI_CROP','AGRI_LAB','LIVESTOCK','MGNREGA','SALARY','HANDICRAFT','BUSINESS','NTFP','OTHER']
for r in ws.iter_rows(values_only=True, min_row=5):
    code = clean(r[0])
    if not code or not re.match(r'^AGR-[A-Z]{3}-\d{3,4}$', str(code)): continue
    base_sources = [num(r[3+i]) for i in range(9)]
    curr_sources = [num(r[14+i]) for i in range(9)]
    base_exp = num(r[13])
    curr_exp = num(r[24])
    income.append({
        'farmer_code': code,
        'baseline': dict(zip(SOURCE_CODES, base_sources)),
        'baseline_exp': base_exp,
        'current': dict(zip(SOURCE_CODES, curr_sources)),
        'current_exp': curr_exp,
    })

# ========== KHEDUT DIARY ==========
# Row 4 headers: A=farmer_code, D=season, E=year, F=crop_no, G=crop_name, H=variety,
# I=area, J=land_prep (Y/N), K=land_prep_cost, L=sowing_date, M=transplant_date,
# ... many fields; also AJ (col 35) harvest_date, AK(36) yield_qtl, AL(37) total_income? Let's just grab essentials.
# Looking at the header, let me re-check the harvest/yield/economics column indices.
crops = []
ws = wb['3_Khedut_Diary']
# Get header row index 4 to confirm positions
header = None
for r in ws.iter_rows(values_only=True, min_row=4, max_row=4):
    header = r
    break
# Build column index by lookup
def col_idx(label_frag):
    for i,h in enumerate(header):
        if h and label_frag.lower() in str(h).lower(): return i
    return None

idx_harvest = col_idx('Harvest Date')
idx_yield = col_idx('Yield')
idx_gross = col_idx('TOTAL INCOME') or col_idx('Total Income')
idx_org = col_idx('Org Support')
idx_govt = col_idx('Govt')

for r in ws.iter_rows(values_only=True, min_row=5):
    code = clean(r[0])
    if not code: continue
    season = clean(r[3])
    crop_name = clean(r[6])
    if not season or not crop_name: continue
    crops.append({
        'farmer_code': code,
        'season': season,
        'year': clean(r[4]) or '2025-26',
        'crop_no': int(num(r[5]) or 1),
        'crop_name': crop_name,
        'variety': clean(r[7]),
        'area_acres': num(r[8]),
        'sowing_date': clean(r[11]),
        'harvest_date': clean(r[idx_harvest]) if idx_harvest else None,
        'yield_quintal': num(r[idx_yield]) if idx_yield else None,
        'gross_income': num(r[idx_gross]) if idx_gross else None,
        'org_support': num(r[idx_org]) if idx_org else 0,
        'govt_support': num(r[idx_govt]) if idx_govt else 0,
    })

# ========== INPUT DISTRIBUTION ==========
inputs = []
ws = wb['2_Input_Distribution']
for r in ws.iter_rows(values_only=True, min_row=4):
    code = clean(r[1])
    activity = clean(r[6])
    item = clean(r[8])
    if not (activity and item): continue
    inputs.append({
        'farmer_code': code,
        'season': clean(r[4]),
        'year': clean(r[5]) or '2025-26',
        'activity': activity,
        'input_type': clean(r[7]) or 'Other',
        'item_name': item,
        'variety': clean(r[9]),
        'quantity': num(r[10]),
        'unit': clean(r[11]),
        'rate': num(r[12]),
        'org_cost': num(r[13]) or 0,
        'govt_cost': num(r[14]) or 0,
        'farmer_contribution': num(r[15]) or 0,
        'dist_date': clean(r[18]),
    })

data = {'farmers': farmers, 'income': income, 'crops': crops, 'inputs': inputs}
with open(OUT, 'w') as f:
    json.dump(data, f)
print(f'farmers={len(farmers)} income={len(income)} crops={len(crops)} inputs={len(inputs)}')
print(f'wrote {OUT}')
