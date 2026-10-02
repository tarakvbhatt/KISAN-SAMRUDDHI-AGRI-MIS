// Kisan Samruddhi MIS importer
// Loads /app/data/mis_seed.json (pre-parsed from the uploaded workbook)
// and inserts into Supabase. Uses the service_role key to bypass RLS.
//
// Run: node scripts/seed_supabase.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import WS from 'ws'
globalThis.WebSocket = WS

const env = Object.fromEntries(
  readFileSync('/app/.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('=')
    let v = l.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    return [l.slice(0, i).trim(), v]
  })
)

const SUPABASE_URL = env.SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function must(label, promise) {
  const r = await promise
  if (r.error) { console.error('✗', label, JSON.stringify(r.error)); throw r.error }
  console.log('✓', label, Array.isArray(r.data) ? `(${r.data.length})` : '')
  return r.data
}

// ---------- SEED REFERENCE DATA ----------
async function seedReference() {
  console.log('\n== Reference data ==')
  await must('district Mahisagar', sb.from('districts').upsert({ name: 'Mahisagar', state_name: 'Gujarat' }, { onConflict: 'name' }).select())
  const [{ district_id }] = await must('fetch district', sb.from('districts').select('district_id').eq('name', 'Mahisagar'))

  await must('block Khanpur', sb.from('blocks').upsert({ district_id, name: 'Khanpur' }, { onConflict: 'district_id,name' }).select())
  const [{ block_id }] = await must('fetch block', sb.from('blocks').select('block_id').eq('name', 'Khanpur').eq('district_id', district_id))

  const panchayatNames = ['Bakor', 'Dhol Khakhra', 'Mor Khakhra', 'Padedi (Kanod)', 'Pandarvada', 'Udava', 'Zer']
  await must('panchayats', sb.from('panchayats').upsert(panchayatNames.map(name => ({ block_id, name })), { onConflict: 'block_id,name' }).select())
  const panchayats = await must('fetch panchayats', sb.from('panchayats').select('panchayat_id, name').eq('block_id', block_id))
  const panchayatByName = Object.fromEntries(panchayats.map(p => [p.name, p.panchayat_id]))

  const villagesSeed = [
    { pname: 'Bakor', code: 'AMT', name: 'Amethi' },
    { pname: 'Dhol Khakhra', code: 'CHN', name: 'Chhani' },
    { pname: 'Pandarvada', code: 'DLP', name: 'Dalelpura' },
    { pname: 'Dhol Khakhra', code: 'DKK', name: 'Dhol Khakhra' },
    { pname: 'Padedi (Kanod)', code: 'DOD', name: 'Dodavanta' },
    { pname: 'Bakor', code: 'FKV', name: 'Ferkuva' },
    { pname: 'Bakor', code: 'HMV', name: 'Hasaliyani Muvadi' },
    { pname: 'Bakor', code: 'MSD', name: 'Masadra' },
    { pname: 'Bakor', code: 'NVG', name: 'Navaghra' },
    { pname: 'Mor Khakhra', code: 'NSD', name: 'Nesda' },
    { pname: 'Udava', code: 'UDV', name: 'Udava' },
    { pname: 'Zer', code: 'ZER', name: 'Zer' },
  ]
  await must('villages', sb.from('villages').upsert(
    villagesSeed.map(v => ({ panchayat_id: panchayatByName[v.pname], village_code: v.code, name: v.name })),
    { onConflict: 'village_code' }
  ).select())

  await must('social_groups', sb.from('social_groups').upsert([
    { code: 'ST', name: 'ST' }, { code: 'SC', name: 'SC' }, { code: 'OBC', name: 'OBC' }, { code: 'GEN', name: 'General/Other' }
  ], { onConflict: 'code' }).select())

  await must('seasons', sb.from('seasons').upsert([
    { season_code: 'SHIYALU', display_label: 'Shiyalu (Winter)', agri_season: 'Rabi', sort_order: 1 },
    { season_code: 'UNALU', display_label: 'Unalu (Summer)', agri_season: 'Summer', sort_order: 2 },
    { season_code: 'CHOMASU', display_label: 'Chomasu (Monsoon)', agri_season: 'Kharif', sort_order: 3 },
  ], { onConflict: 'season_code' }).select())

  await must('project_years', sb.from('project_years').upsert({
    label: '2025-26', start_date: '2025-04-01', end_date: '2026-03-31', is_current: true,
  }, { onConflict: 'label' }).select())

  await must('units', sb.from('units').upsert(
    [['kg', 'Kilogram'], ['litre', 'Litre'], ['no', 'Number'], ['tonne', 'Tonne'], ['quintal', 'Quintal'], ['bag', 'Bag'], ['times', 'Times (count)'], ['sqft', 'Square feet'], ['guntha', 'Guntha']]
      .map(([code, name]) => ({ code, name })),
    { onConflict: 'code' }
  ).select())

  await must('income_sources', sb.from('income_sources').upsert([
    { source_code: 'AGRI_CROP', name: 'Agri Crop', sort_order: 1 },
    { source_code: 'AGRI_LAB', name: 'Agri Labour', sort_order: 2 },
    { source_code: 'LIVESTOCK', name: 'Livestock', sort_order: 3 },
    { source_code: 'MGNREGA', name: 'MGNREGA', sort_order: 4 },
    { source_code: 'SALARY', name: 'Salary', sort_order: 5 },
    { source_code: 'HANDICRAFT', name: 'Handicraft', sort_order: 6 },
    { source_code: 'BUSINESS', name: 'Business', sort_order: 7 },
    { source_code: 'NTFP', name: 'NTFP', sort_order: 8 },
    { source_code: 'OTHER', name: 'Other', sort_order: 9 },
  ], { onConflict: 'source_code' }).select())

  await must('input_types', sb.from('input_types').upsert(
    ['Seed', 'Fertilizer', 'Pesticide', 'Nursery/Seedling', 'Equipment', 'Service', 'Other'].map(name => ({ name })),
    { onConflict: 'name' }
  ).select())

  await must('programme_activities default', sb.from('programme_activities').upsert([
    { activity_code: 'IAP_SEED', name: 'Improved Agriculture Practice - Seed/Input Kit', activity_type: 'Input Distribution' },
    { activity_code: 'IAP_FERT', name: 'Improved Agriculture Practice - Fertilizer', activity_type: 'Input Distribution' },
    { activity_code: 'CREEPER', name: 'Creeper Vegetable Support', activity_type: 'Input Distribution' },
    { activity_code: 'OTHER', name: 'Other', activity_type: 'Other' },
  ], { onConflict: 'activity_code' }).select())
}

// ---------- IMPORT FARMER MASTER ----------
const SEED = JSON.parse(readFileSync('/app/data/mis_seed.json', 'utf8'))

async function importFarmers(ctx) {
  console.log('\n== Farmers ==')
  const { villages, social_groups } = ctx
  const vByName = Object.fromEntries(villages.map(v => [v.name.toLowerCase(), v]))
  const sgByName = Object.fromEntries(social_groups.map(g => [g.name.toLowerCase(), g.social_group_id]))

  // Dedupe hamlets by village — do not use onConflict (functional index not supported)
  const hamletKey = new Set()
  const hamletRows = []
  for (const f of SEED.farmers) {
    if (!f.hamlet) continue
    const v = vByName[(f.village || '').toLowerCase()]
    if (!v) continue
    const key = `${v.village_id}::${f.hamlet.toLowerCase()}`
    if (hamletKey.has(key)) continue
    hamletKey.add(key)
    hamletRows.push({ village_id: v.village_id, name: f.hamlet })
  }
  // Filter against existing hamlets to avoid duplicates
  const existingHamlets = await must('fetch existing hamlets', sb.from('hamlets').select('village_id, name'))
  const existingKey = new Set(existingHamlets.map(h => `${h.village_id}::${h.name.toLowerCase()}`))
  const newHamlets = hamletRows.filter(h => !existingKey.has(`${h.village_id}::${h.name.toLowerCase()}`))
  console.log('hamlets to insert (new):', newHamlets.length)
  for (let i = 0; i < newHamlets.length; i += 500) {
    const slice = newHamlets.slice(i, i + 500)
    const r = await sb.from('hamlets').insert(slice)
    if (r.error && r.error.code !== '23505') { console.error('hamlet err', r.error); throw r.error }
  }
  const hamlets = await must('fetch hamlets', sb.from('hamlets').select('hamlet_id, village_id, name'))
  const hamletByKey = Object.fromEntries(hamlets.map(h => [`${h.village_id}::${h.name.toLowerCase()}`, h.hamlet_id]))

  // Build farmer rows
  const farmerRows = []
  const skipped = []
  for (const f of SEED.farmers) {
    const v = vByName[(f.village || '').toLowerCase()]
    if (!v) { skipped.push(f.farmer_code); continue }
    const h = f.hamlet ? hamletByKey[`${v.village_id}::${f.hamlet.toLowerCase()}`] : null
    const mobile = f.mobile_number ? String(f.mobile_number).replace(/\D/g, '').slice(-10) : null
    farmerRows.push({
      farmer_code: f.farmer_code,
      registration_status: 'Registered',
      head_of_family_name: f.head_of_family_name,
      respondent_name: f.respondent_name,
      village_id: v.village_id,
      hamlet_id: h,
      mobile_number: mobile && /^[6-9]\d{9}$/.test(mobile) ? mobile : null,
      social_group_id: f.social_group ? sgByName[f.social_group.toLowerCase()] || null : null,
      survey_date: f.survey_date,
    })
  }
  console.log('farmers to upsert:', farmerRows.length, 'skipped (unknown village):', skipped.length)

  // Chunked upsert
  for (let i = 0; i < farmerRows.length; i += 200) {
    const slice = farmerRows.slice(i, i + 200)
    const r = await sb.from('farmers').upsert(slice, { onConflict: 'farmer_code' }).select('farmer_id, farmer_code')
    if (r.error) { console.error('farmer err at', i, r.error); throw r.error }
    process.stdout.write(`farmers ${i + slice.length}/${farmerRows.length}\r`)
  }
  console.log('\nfarmers inserted/upserted.')

  // Sync village counters
  const r = await sb.rpc('sync_village_id_counters')
  if (r.error) console.warn('counter sync err (ok to ignore):', r.error.message)
  else console.log('✓ village_id_counters synced')
}

// ---------- IMPORT INCOME ASSESSMENTS ----------
async function importIncome(ctx) {
  console.log('\n== Income assessments ==')
  const { project_year_id, income_sources, farmerByCode } = ctx
  const srcByCode = Object.fromEntries(income_sources.map(s => [s.source_code, s.income_source_id]))

  // Build assessment rows (baseline + current for each farmer that has data)
  const asmtRows = []
  for (const row of SEED.income) {
    const fid = farmerByCode[row.farmer_code]
    if (!fid) continue
    const baseAny = Object.values(row.baseline).some(v => v != null && v > 0)
    const currAny = Object.values(row.current).some(v => v != null && v > 0)
    if (baseAny || row.baseline_exp) asmtRows.push({ farmer_id: fid, assessment_type: 'Baseline', project_year_id, total_expenditure: row.baseline_exp, agri_expenditure: null, _lines: row.baseline })
    if (currAny || row.current_exp) asmtRows.push({ farmer_id: fid, assessment_type: 'Current', project_year_id, total_expenditure: row.current_exp, agri_expenditure: null, _lines: row.current })
  }

  console.log('assessments to upsert:', asmtRows.length)
  for (let i = 0; i < asmtRows.length; i += 200) {
    const slice = asmtRows.slice(i, i + 200)
    const payload = slice.map(({ _lines, ...rest }) => rest)
    const r = await sb.from('income_assessments').upsert(payload, { onConflict: 'farmer_id,assessment_type,project_year_id' }).select('assessment_id, farmer_id, assessment_type')
    if (r.error) { console.error('asmt err at', i, r.error); throw r.error }
    // Map back assessment_id to original slice for lines
    const keyToId = Object.fromEntries(r.data.map(a => [`${a.farmer_id}::${a.assessment_type}`, a.assessment_id]))
    const lines = []
    for (const row of slice) {
      const aid = keyToId[`${row.farmer_id}::${row.assessment_type}`]
      if (!aid) continue
      for (const [code, amt] of Object.entries(row._lines)) {
        if (amt == null) continue
        const sid = srcByCode[code]
        if (!sid) continue
        lines.push({ assessment_id: aid, income_source_id: sid, amount: amt })
      }
    }
    if (lines.length) {
      for (let j = 0; j < lines.length; j += 500) {
        const rl = await sb.from('income_assessment_lines').upsert(lines.slice(j, j + 500), { onConflict: 'assessment_id,income_source_id' })
        if (rl.error) { console.error('lines err', rl.error); throw rl.error }
      }
    }
    process.stdout.write(`income ${i + slice.length}/${asmtRows.length}\r`)
  }
  console.log('\nincome done.')
}

// Normalize dates: accept ISO (yyyy-mm-dd), dd/mm/yyyy, dd-mm-yyyy
function normDate(v) {
  if (!v) return null
  const s = String(v).trim()
  let iso = null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) iso = s.slice(0, 10)
  else {
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (m) {
      const [, d, mo, y] = m
      iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  if (!iso) return null
  // Validate real date
  const [y, mo, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return iso
}

// ---------- IMPORT CROP RECORDS ----------
async function importCrops(ctx) {
  console.log('\n== Crop records (Khedut Diary) ==')
  const { project_year_id, farmerByCode, seasonsByLabel } = ctx

  // Collect unique crops and insert
  const cropNames = Array.from(new Set(SEED.crops.map(c => c.crop_name).filter(Boolean)))
  await must('crops', sb.from('crops').upsert(cropNames.map(name => ({ name, category: 'Other' })), { onConflict: 'name', ignoreDuplicates: true }).select())
  const allCrops = await must('fetch crops', sb.from('crops').select('crop_id, name'))
  const cropByName = Object.fromEntries(allCrops.map(c => [c.name.toLowerCase(), c.crop_id]))

  // Build rows
  const rows = []
  for (const c of SEED.crops) {
    const fid = farmerByCode[c.farmer_code]
    const season = seasonsByLabel[c.season]
    const cid = cropByName[(c.crop_name || '').toLowerCase()]
    if (!fid || !season || !cid) continue
    rows.push({
      farmer_id: fid,
      season_id: season,
      project_year_id,
      crop_no: Math.min(Math.max(c.crop_no || 1, 1), 10),
      crop_id: cid,
      variety_text: c.variety ? String(c.variety).slice(0, 80) : null,
      area_acres: c.area_acres,
      sowing_date: normDate(c.sowing_date),
      harvest_date: normDate(c.harvest_date),
      yield_quintal: c.yield_quintal != null && c.yield_quintal >= 0 ? c.yield_quintal : null,
      gross_income: c.gross_income != null && c.gross_income >= 0 ? c.gross_income : null,
      org_support: c.org_support != null && c.org_support >= 0 ? c.org_support : 0,
      govt_support: c.govt_support != null && c.govt_support >= 0 ? c.govt_support : 0,
    })
  }
  // Dedupe on (farmer_id, season_id, project_year_id, crop_no) — keep last
  const seen = new Map()
  for (const r of rows) seen.set(`${r.farmer_id}::${r.season_id}::${r.project_year_id}::${r.crop_no}`, r)
  const deduped = Array.from(seen.values())
  console.log('crop_records to upsert:', deduped.length, '(from', rows.length, 'raw)')

  for (let i = 0; i < deduped.length; i += 200) {
    const slice = deduped.slice(i, i + 200)
    const r = await sb.from('crop_records').upsert(slice, { onConflict: 'farmer_id,season_id,project_year_id,crop_no' }).select('crop_record_id')
    if (r.error) { console.error('crop err at', i, r.error); throw r.error }
    process.stdout.write(`crops ${i + slice.length}/${deduped.length}\r`)
  }
  console.log('\ncrop records done.')
}

// ---------- IMPORT INPUT DISTRIBUTIONS ----------
async function importInputs(ctx) {
  console.log('\n== Input distributions ==')
  const { project_year_id, farmerByCode, seasonsByLabel, activitiesByName, inputTypesByName, unitsByCode } = ctx

  const rows = []
  for (const d of SEED.inputs) {
    const fid = d.farmer_code ? farmerByCode[d.farmer_code] : null
    if (!fid) continue
    const sid = d.season ? seasonsByLabel[d.season] : null
    if (!sid) continue
    const aid = activitiesByName[(d.activity || '').toLowerCase()] || activitiesByName['other']
    const itid = inputTypesByName[(d.input_type || 'Other').toLowerCase()] || inputTypesByName['other']
    if (!aid || !itid) continue
    rows.push({
      farmer_id: fid,
      season_id: sid,
      project_year_id,
      activity_id: aid,
      input_type_id: itid,
      item_name: d.item_name.slice(0, 150),
      variety_grade: d.variety ? String(d.variety).slice(0, 80) : null,
      quantity: d.quantity,
      unit_id: d.unit ? unitsByCode[(d.unit || '').toLowerCase()] || null : null,
      rate_per_unit: d.rate,
      org_cost: d.org_cost || 0,
      govt_cost: d.govt_cost || 0,
      farmer_contribution: d.farmer_contribution || 0,
    })
  }
  console.log('input_distributions to insert:', rows.length)
  for (let i = 0; i < rows.length; i += 200) {
    const slice = rows.slice(i, i + 200)
    const r = await sb.from('input_distributions').insert(slice)
    if (r.error) { console.error('input err at', i, r.error); throw r.error }
    process.stdout.write(`inputs ${i + slice.length}/${rows.length}\r`)
  }
  console.log('\ninputs done.')
}

// ---------- MAIN ----------
async function main() {
  await seedReference()

  const villages = await must('fetch villages', sb.from('villages').select('village_id, name, village_code'))
  const social_groups = await must('fetch social_groups', sb.from('social_groups').select('social_group_id, name'))
  const seasons = await must('fetch seasons', sb.from('seasons').select('season_id, display_label'))
  const [{ project_year_id }] = await must('fetch project year', sb.from('project_years').select('project_year_id').eq('is_current', true))
  const income_sources = await must('fetch income_sources', sb.from('income_sources').select('income_source_id, source_code'))
  const activities = await must('fetch activities', sb.from('programme_activities').select('activity_id, name'))
  const inputTypes = await must('fetch input_types', sb.from('input_types').select('input_type_id, name'))
  const units = await must('fetch units', sb.from('units').select('unit_id, code'))

  const ctx = {
    villages,
    social_groups,
    project_year_id,
    income_sources,
    seasonsByLabel: Object.fromEntries(seasons.map(s => [s.display_label, s.season_id])),
    activitiesByName: Object.fromEntries(activities.map(a => [a.name.toLowerCase(), a.activity_id])),
    inputTypesByName: Object.fromEntries(inputTypes.map(a => [a.name.toLowerCase(), a.input_type_id])),
    unitsByCode: Object.fromEntries(units.map(u => [u.code.toLowerCase(), u.unit_id])),
  }

  await importFarmers(ctx)
  // Fetch all farmers with pagination (Supabase default max 1000)
  const allFarmers = []
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from('farmers').select('farmer_id, farmer_code').range(p * 1000, p * 1000 + 999)
    if (error) throw error
    allFarmers.push(...data)
    if (data.length < 1000) break
  }
  console.log('✓ fetch farmers', allFarmers.length)
  ctx.farmerByCode = Object.fromEntries(allFarmers.map(f => [f.farmer_code, f.farmer_id]))

  await importIncome(ctx)
  await importCrops(ctx)
  await importInputs(ctx)

  console.log('\n🎉 Import complete.')
}

main().catch(err => { console.error('FATAL', err); process.exit(1) })
