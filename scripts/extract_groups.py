#!/usr/bin/env python3
"""Extract FIG/FFS groups + members (derive groups from member sheets)."""
import json, re, openpyxl

wb = openpyxl.load_workbook('/app/data/kisan.xlsx', data_only=True, read_only=True)

def clean(v):
    if v is None: return None
    if isinstance(v, str):
        v = v.strip()
        if v in ('—', '-', '', 'N/A', 'na', 'NA', 'nan'): return None
        return v
    return v

def norm_date(v):
    if not v: return None
    if hasattr(v, 'isoformat'): return v.isoformat()[:10]
    s = str(v).strip()
    m = re.match(r'^(\d{1,2})[/-](\d{1,2})[/-](\d{4})', s)
    if m: return f"{m[3]}-{int(m[2]):02d}-{int(m[1]):02d}"
    if re.match(r'^\d{4}-\d{2}-\d{2}', s): return s[:10]
    return None

def parse_members(sheet_name, group_type):
    """Return (groups_dict keyed by (village, name), members list)."""
    members = []
    groups = {}
    ws = wb[sheet_name]
    for r in ws.iter_rows(values_only=True, min_row=4):
        farmer_code = clean(r[1])
        village = clean(r[3])
        group_no_raw = r[6]
        group_name = clean(r[7])
        contact = clean(r[9])
        aadhaar = clean(r[10]) if len(r) > 10 else None
        if not farmer_code or not re.match(r'^AGR-[A-Z]{3}-\d{3,4}$', farmer_code): continue
        if not village or not group_name: continue
        try:
            group_no = int(group_no_raw) if group_no_raw is not None else None
        except (TypeError, ValueError):
            try: group_no = int(str(group_no_raw).strip())
            except Exception: group_no = None
        key = (village, group_name)
        if key not in groups:
            groups[key] = {
                'group_type': group_type,
                'group_no': group_no,
                'group_name': group_name,
                'village': village,
                'capacity': None,
                'formation_date': None,
            }
        members.append({
            'farmer_code': farmer_code,
            'village': village,
            'group_name': group_name,
            'contact': contact,
            'aadhaar': aadhaar,
        })
    return list(groups.values()), members

fig_groups_registered = []
for r in wb['6_FIG_Groups'].iter_rows(values_only=True, min_row=4):
    gid, village, _blk, gno, name, formed, cap = r[0], r[1], r[2], r[3], r[4], r[5], r[6]
    if not gid or not name or not village: continue
    fig_groups_registered.append({
        'group_code': clean(gid),
        'village': clean(village),
        'group_name': clean(name),
        'formation_date': norm_date(formed),
        'capacity': int(cap) if isinstance(cap, (int, float)) and cap > 0 else None,
    })

fig_groups, fig_members = parse_members('7_FIG_Members', 'FIG')
ffs_groups, ffs_members = parse_members('9_FFS_Members', 'FFS')

# Merge registered capacity/formation into fig_groups
registered_by_key = {(g['village'], g['group_name']): g for g in fig_groups_registered}
for g in fig_groups:
    key = (g['village'], g['group_name'])
    if key in registered_by_key:
        reg = registered_by_key[key]
        g['group_code'] = reg['group_code']
        g['capacity'] = reg['capacity']
        g['formation_date'] = reg['formation_date']

# Assign group_codes if not already assigned
fig_counter = 100
for g in fig_groups:
    if 'group_code' not in g:
        fig_counter += 1
        g['group_code'] = f'FIG-GRP-{fig_counter:03d}'
ffs_counter = 100
for g in ffs_groups:
    ffs_counter += 1
    g['group_code'] = f'FFS-GRP-{ffs_counter:03d}'

data = {
    'fig_groups': fig_groups,
    'ffs_groups': ffs_groups,
    'fig_members': fig_members,
    'ffs_members': ffs_members,
}
with open('/app/data/mis_groups.json', 'w') as f:
    json.dump(data, f)
print(f"FIG groups={len(fig_groups)} members={len(fig_members)}")
print(f"FFS groups={len(ffs_groups)} members={len(ffs_members)}")
print("sample fig_groups:", fig_groups[:3])
print("sample ffs_groups:", ffs_groups[:3])
