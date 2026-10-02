// Seed FIG/FFS groups and members into Supabase
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import WS from 'ws'
globalThis.WebSocket = WS

const env = Object.fromEntries(
  readFileSync('/app/.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('='); let v = l.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    return [l.slice(0, i).trim(), v]
  })
)
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const DATA = JSON.parse(readFileSync('/app/data/mis_groups.json', 'utf8'))

async function must(label, p) { const r = await p; if (r.error) { console.error('✗', label, r.error); throw r.error } console.log('✓', label); return r.data }

const villages = await must('villages', sb.from('villages').select('village_id, name'))
const vByName = Object.fromEntries(villages.map(v => [v.name.toLowerCase(), v.village_id]))

// Fetch all farmers (paginated)
const farmers = []
for (let p = 0; ; p++) {
  const { data, error } = await sb.from('farmers').select('farmer_id, farmer_code').range(p * 1000, p * 1000 + 999)
  if (error) throw error
  farmers.push(...data)
  if (data.length < 1000) break
}
const farmerByCode = Object.fromEntries(farmers.map(f => [f.farmer_code, f.farmer_id]))
console.log('farmers:', farmers.length)

async function seedGroups(groups, members) {
  // Insert groups
  const payload = groups.map(g => ({
    group_code: g.group_code,
    group_type: g.group_type,
    group_no: g.group_no,
    group_name: g.group_name.slice(0, 120),
    village_id: vByName[g.village.toLowerCase()],
    formation_date: g.formation_date,
    capacity: g.capacity,
    is_active: true,
  })).filter(g => g.village_id)
  if (!payload.length) return
  const r = await sb.from('farmer_groups').upsert(payload, { onConflict: 'group_code' }).select('group_id, group_code, group_name, group_type, village_id')
  if (r.error) throw r.error
  console.log(`  inserted ${r.data.length} groups`)

  // Build lookup
  const groupByKey = new Map()
  for (const g of r.data) {
    groupByKey.set(`${g.group_type}::${g.village_id}::${g.group_name.toLowerCase()}`, { id: g.group_id, type: g.group_type })
  }

  // Build member rows (dedupe by group+farmer)
  const seen = new Set()
  const memberRows = []
  for (const m of members) {
    const vid = vByName[m.village.toLowerCase()]
    const fid = farmerByCode[m.farmer_code]
    const key = `${groups[0].group_type}::${vid}::${m.group_name.toLowerCase()}`
    const grp = groupByKey.get(key)
    if (!vid || !fid || !grp) continue
    const dkey = `${grp.id}::${fid}`
    if (seen.has(dkey)) continue
    seen.add(dkey)
    memberRows.push({
      group_id: grp.id,
      group_type: grp.type,
      farmer_id: fid,
      is_active: true,
    })
  }
  if (memberRows.length) {
    const rm = await sb.from('group_members').upsert(memberRows, { onConflict: 'group_id,farmer_id' }).select('group_member_id')
    if (rm.error) { console.error('member err', rm.error); throw rm.error }
    console.log(`  inserted ${rm.data.length} members`)
  }
}

console.log('\n== FIG ==')
await seedGroups(DATA.fig_groups, DATA.fig_members)
console.log('\n== FFS ==')
await seedGroups(DATA.ffs_groups, DATA.ffs_members)
console.log('\n🎉 Groups import complete.')
