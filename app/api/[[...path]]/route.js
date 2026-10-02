import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { LlmChat, UserMessage, validateApiKey } from 'emergentintegrations'

export const runtime = 'nodejs'

let supabaseClient

function getSupabase() {
  if (supabaseClient) return supabaseClient
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  // Prefer service role key so RLS doesn't block admin reads/writes
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase environment variables are not configured')
  supabaseClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return supabaseClient
}

function withCors(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}
const json = (data, options) => withCors(NextResponse.json(data, options))

function isMissingSchema(error) {
  return error?.code === '42P01' || error?.code === 'PGRST205' || error?.message?.toLowerCase?.().includes('relation')
}
function apiError(error) {
  console.error('MIS API Error:', error)
  if (isMissingSchema(error)) return json({ error: 'The Supabase MIS schema is not available yet.', setup_needed: true }, { status: 503 })
  if (error?.message?.includes('environment variables')) return json({ error: 'Supabase is not configured.', setup_needed: true }, { status: 503 })
  return json({ error: error?.message || 'Unable to load MIS data.' }, { status: 500 })
}

async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const method = request.method
  const route = `/${path.join('/')}`

  if (method === 'OPTIONS') return withCors(new NextResponse(null, { status: 204 }))
  if ((route === '/' || route === '/root') && method === 'GET')
    return json({ message: 'Kisan Samruddhi MIS API', database: 'Supabase PostgreSQL' })

  try {
    const supabase = getSupabase()

    if (route === '/mis/status' && method === 'GET') {
      const { data, error } = await supabase.from('v_dashboard_kpis').select('total_beneficiaries').limit(1).maybeSingle()
      if (error) throw error
      return json({ connected: true, schema_ready: true, total_beneficiaries: data?.total_beneficiaries ?? 0 })
    }

    if (route === '/mis/dashboard' && method === 'GET') {
      const [kpiResult, bandResult] = await Promise.all([
        supabase.from('v_dashboard_kpis').select('*').limit(1).maybeSingle(),
        supabase.from('v_income_band_distribution').select('*').order('band', { ascending: true }),
      ])
      if (kpiResult.error) throw kpiResult.error
      if (bandResult.error) throw bandResult.error
      return json({ kpis: kpiResult.data || {}, income_bands: bandResult.data || [] })
    }

    if (route === '/mis/villages' && method === 'GET') {
      const { data, error } = await supabase.from('v_village_summary').select('*').order('total_farmers', { ascending: false }).limit(50)
      if (error) throw error
      return json({ villages: data || [] })
    }

    if (route === '/mis/references' && method === 'GET') {
      const [villagesResult, groupsResult] = await Promise.all([
        supabase.from('villages').select('village_id, name, village_code').eq('is_active', true).order('name'),
        supabase.from('social_groups').select('social_group_id, code, name').order('name'),
      ])
      if (villagesResult.error) throw villagesResult.error
      if (groupsResult.error) throw groupsResult.error
      return json({ villages: villagesResult.data || [], social_groups: groupsResult.data || [] })
    }

    // Farmer register (list + search)
    if (route === '/mis/farmers' && method === 'GET') {
      const { searchParams } = new URL(request.url)
      const search = searchParams.get('search')?.trim()
      const page = Math.max(Number(searchParams.get('page') || 1), 1)
      const pageSize = Math.min(Math.max(Number(searchParams.get('page_size') || 50), 1), 100)
      let query = supabase
        .from('v_farmer_master')
        .select(
          'farmer_id, farmer_code, registration_status, head_of_family_name, respondent_name, village, hamlet, panchayat, block, mobile_number, social_group, baseline_expenditure, shiyalu_input, unalu_input, chomasu_input, creeper_veg',
          { count: 'exact' }
        )
        .order('head_of_family_name', { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1)
      if (search) query = query.or(`head_of_family_name.ilike.%${search}%,farmer_code.ilike.%${search}%,village.ilike.%${search}%`)
      const { data, error, count } = await query
      if (error) throw error
      return json({ farmers: data || [], total: count || 0, page, page_size: pageSize })
    }

    // === NEW: Crop diary for a single farmer ===
    if (route.match(/^\/mis\/farmers\/[^/]+\/crops$/) && method === 'GET') {
      const farmerCode = decodeURIComponent(path[2] || '')
      if (!farmerCode) return json({ error: 'Farmer code is required.' }, { status: 400 })
      const { data: farmer, error: fErr } = await supabase.from('farmers').select('farmer_id').eq('farmer_code', farmerCode).maybeSingle()
      if (fErr) throw fErr
      if (!farmer) return json({ error: 'Farmer not found.' }, { status: 404 })
      const { data, error } = await supabase
        .from('crop_records')
        .select(
          'crop_record_id, crop_no, area_acres, sowing_date, harvest_date, yield_quintal, gross_income, org_support, govt_support, variety_text, crops(name,category), seasons(display_label,season_code), project_years(label)'
        )
        .eq('farmer_id', farmer.farmer_id)
        .order('season_id')
        .order('crop_no')
      if (error) throw error
      const crops = (data || []).map((r) => ({
        crop_record_id: r.crop_record_id,
        crop_no: r.crop_no,
        area_acres: r.area_acres,
        sowing_date: r.sowing_date,
        harvest_date: r.harvest_date,
        yield_quintal: r.yield_quintal,
        gross_income: r.gross_income,
        org_support: r.org_support,
        govt_support: r.govt_support,
        variety: r.variety_text,
        crop_name: r.crops?.name,
        crop_category: r.crops?.category,
        season: r.seasons?.display_label,
        season_code: r.seasons?.season_code,
        year: r.project_years?.label,
      }))
      return json({ crops })
    }

    // === NEW: Income impact — village-level and overall baseline vs current ===
    if (route === '/mis/income-impact' && method === 'GET') {
      const { data, error } = await supabase.from('v_income_impact').select('farmer_code, farmer_name, village, baseline_income, baseline_expenditure, current_income, current_expenditure, income_change, income_change_pct, impact_status, org_investment, govt_investment, net_benefit')
      if (error) throw error
      const rows = data || []
      let totBase = 0, totCurr = 0, totExpBase = 0, totExpCurr = 0, orgInv = 0, govtInv = 0, improved = 0, declined = 0, same = 0, pending = 0
      const byVillage = new Map()
      for (const r of rows) {
        const b = Number(r.baseline_income || 0)
        const c = Number(r.current_income || 0)
        totBase += b; totCurr += c
        totExpBase += Number(r.baseline_expenditure || 0)
        totExpCurr += Number(r.current_expenditure || 0)
        orgInv += Number(r.org_investment || 0)
        govtInv += Number(r.govt_investment || 0)
        if (r.impact_status === 'Increase') improved++
        else if (r.impact_status === 'Decrease') declined++
        else if (r.impact_status === 'No Change') same++
        else pending++
        const key = r.village || 'Unknown'
        const bucket = byVillage.get(key) || { village: key, farmers: 0, baseline_total: 0, current_total: 0, org_investment: 0, govt_investment: 0, improved: 0 }
        bucket.farmers += 1
        bucket.baseline_total += b
        bucket.current_total += c
        bucket.org_investment += Number(r.org_investment || 0)
        bucket.govt_investment += Number(r.govt_investment || 0)
        if (r.impact_status === 'Increase') bucket.improved += 1
        byVillage.set(key, bucket)
      }
      const villages = [...byVillage.values()].map((v) => ({
        ...v,
        avg_baseline: v.farmers ? Math.round(v.baseline_total / v.farmers) : 0,
        avg_current: v.farmers ? Math.round(v.current_total / v.farmers) : 0,
        change_pct: v.baseline_total ? ((v.current_total - v.baseline_total) / v.baseline_total) * 100 : null,
      })).sort((a, b) => (b.change_pct ?? -9999) - (a.change_pct ?? -9999))
      // Top farmers by biggest absolute income change (first 10)
      const top_movers = [...rows]
        .filter((r) => Number(r.income_change) !== 0)
        .sort((a, b) => Number(b.income_change || 0) - Number(a.income_change || 0))
        .slice(0, 10)
        .map((r) => ({ farmer_code: r.farmer_code, farmer_name: r.farmer_name, village: r.village, baseline: Number(r.baseline_income || 0), current: Number(r.current_income || 0), change: Number(r.income_change || 0), change_pct: r.income_change_pct, status: r.impact_status }))
      return json({
        summary: {
          farmers: rows.length,
          total_baseline: totBase,
          total_current: totCurr,
          avg_baseline: rows.length ? Math.round(totBase / rows.length) : 0,
          avg_current: rows.length ? Math.round(totCurr / rows.length) : 0,
          avg_change_pct: totBase ? ((totCurr - totBase) / totBase) * 100 : 0,
          baseline_expenditure: totExpBase,
          current_expenditure: totExpCurr,
          org_investment: orgInv,
          govt_investment: govtInv,
          improved,
          declined,
          same,
          pending,
        },
        villages,
        top_movers,
      })
    }

    // === NEW: Groups list (FIG + FFS) with member counts ===
    if (route === '/mis/groups' && method === 'GET') {
      const { data, error } = await supabase
        .from('farmer_groups')
        .select('group_id, group_code, group_type, group_name, group_no, capacity, is_active, villages(name), group_members(count)')
        .eq('is_active', true)
        .order('group_type')
        .order('group_name')
      if (error) throw error
      const groups = (data || []).map((g) => ({
        group_id: g.group_id,
        group_code: g.group_code,
        group_type: g.group_type,
        group_name: g.group_name,
        group_no: g.group_no,
        capacity: g.capacity,
        village: g.villages?.name,
        member_count: g.group_members?.[0]?.count || 0,
      }))
      const summary = {
        fig_groups: groups.filter((g) => g.group_type === 'FIG').length,
        ffs_groups: groups.filter((g) => g.group_type === 'FFS').length,
        fig_members: groups.filter((g) => g.group_type === 'FIG').reduce((s, g) => s + g.member_count, 0),
        ffs_members: groups.filter((g) => g.group_type === 'FFS').reduce((s, g) => s + g.member_count, 0),
      }
      return json({ summary, groups })
    }

    // === NEW: Group members list ===
    if (route.match(/^\/mis\/groups\/[^/]+\/members$/) && method === 'GET') {
      const groupCode = decodeURIComponent(path[2] || '')
      const { data: g, error: gE } = await supabase.from('farmer_groups').select('group_id, group_name, group_type').eq('group_code', groupCode).maybeSingle()
      if (gE) throw gE
      if (!g) return json({ error: 'Group not found' }, { status: 404 })
      const { data, error } = await supabase
        .from('group_members')
        .select('group_member_id, is_active, farmers(farmer_id, farmer_code, head_of_family_name, mobile_number, villages(name))')
        .eq('group_id', g.group_id)
        .order('group_member_id')
      if (error) throw error
      const members = (data || []).map((m) => ({
        group_member_id: m.group_member_id,
        is_active: m.is_active,
        farmer_code: m.farmers?.farmer_code,
        farmer_name: m.farmers?.head_of_family_name,
        mobile_number: m.farmers?.mobile_number,
        village: m.farmers?.villages?.name,
      }))
      return json({ group: { group_code: groupCode, group_name: g.group_name, group_type: g.group_type }, members })
    }

    // === NEW: Add crop record for a farmer ===
    if (route.match(/^\/mis\/farmers\/[^/]+\/crops$/) && method === 'POST') {
      const farmerCode = decodeURIComponent(path[2] || '')
      const body = await request.json()
      const { data: farmer, error: fE } = await supabase.from('farmers').select('farmer_id').eq('farmer_code', farmerCode).maybeSingle()
      if (fE) throw fE
      if (!farmer) return json({ error: 'Farmer not found' }, { status: 404 })

      // Resolve crop_id from name (create crop if missing)
      const cropName = body.crop_name?.toString().trim()
      const seasonCode = body.season_code?.toString().trim()
      if (!cropName || !seasonCode) return json({ error: 'crop_name and season_code are required' }, { status: 400 })
      const { data: existingCrop } = await supabase.from('crops').select('crop_id').ilike('name', cropName).maybeSingle()
      let cropId = existingCrop?.crop_id
      if (!cropId) {
        const ins = await supabase.from('crops').insert({ name: cropName, category: 'Other' }).select('crop_id').single()
        if (ins.error) throw ins.error
        cropId = ins.data.crop_id
      }
      const { data: season, error: sE } = await supabase.from('seasons').select('season_id').eq('season_code', seasonCode).maybeSingle()
      if (sE) throw sE
      if (!season) return json({ error: 'Invalid season' }, { status: 400 })
      const { data: py } = await supabase.from('project_years').select('project_year_id').eq('is_current', true).maybeSingle()
      if (!py) return json({ error: 'No current project year' }, { status: 400 })

      // Compute next crop_no for this farmer+season+year
      const { data: existing } = await supabase.from('crop_records').select('crop_no').eq('farmer_id', farmer.farmer_id).eq('season_id', season.season_id).eq('project_year_id', py.project_year_id).order('crop_no', { ascending: false }).limit(1)
      const nextNo = Math.min(10, ((existing?.[0]?.crop_no || 0) + 1))

      const payload = {
        farmer_id: farmer.farmer_id,
        season_id: season.season_id,
        project_year_id: py.project_year_id,
        crop_no: nextNo,
        crop_id: cropId,
        variety_text: body.variety?.toString().slice(0, 80) || null,
        area_acres: body.area_acres != null ? Number(body.area_acres) : null,
        sowing_date: body.sowing_date || null,
        harvest_date: body.harvest_date || null,
        yield_quintal: body.yield_quintal != null ? Number(body.yield_quintal) : null,
        gross_income: body.gross_income != null ? Number(body.gross_income) : null,
        org_support: body.org_support != null ? Number(body.org_support) : 0,
        govt_support: body.govt_support != null ? Number(body.govt_support) : 0,
      }
      const { data, error } = await supabase.from('crop_records').insert(payload).select('crop_record_id, crop_no').single()
      if (error) throw error
      return json({ crop_record: data }, { status: 201 })
    }

    // === NEW: Village profile (farmer list, crop mix, income trend) ===
    if (route.match(/^\/mis\/villages\/[^/]+$/) && method === 'GET') {
      const vid = Number(decodeURIComponent(path[2] || ''))
      if (!Number.isInteger(vid)) return json({ error: 'village_id is required' }, { status: 400 })
      const villageMeta = await supabase.from('villages').select('village_id, name, village_code').eq('village_id', vid).maybeSingle()
      if (villageMeta.error) throw villageMeta.error
      if (!villageMeta.data) return json({ error: 'Village not found' }, { status: 404 })
      const vName = villageMeta.data.name

      const [sumRes, farmerRes, cropsRes, incomeRes, groupsRes] = await Promise.all([
        supabase.from('v_village_summary').select('*').eq('village_id', vid).maybeSingle(),
        supabase.from('v_farmer_master').select('farmer_id, farmer_code, head_of_family_name, hamlet, social_group, mobile_number, shiyalu_input, unalu_input, chomasu_input').eq('village', vName).order('head_of_family_name').limit(500),
        supabase.from('crop_records').select('crop_id, area_acres, yield_quintal, gross_income, crops(name,category), seasons(display_label,season_code)').in('farmer_id', (await supabase.from('farmers').select('farmer_id').eq('village_id', vid)).data?.map(f => f.farmer_id) || []),
        supabase.from('v_income_impact').select('farmer_code, baseline_income, current_income, income_change, impact_status').eq('village', vName),
        supabase.from('farmer_groups').select('group_id, group_code, group_type, group_name, group_members(count)').eq('village_id', vid).eq('is_active', true),
      ])
      if (sumRes.error) throw sumRes.error
      if (farmerRes.error) throw farmerRes.error
      if (cropsRes.error) throw cropsRes.error
      if (groupsRes.error) throw groupsRes.error

      const cropMix = {}
      for (const c of cropsRes.data || []) {
        const name = c.crops?.name || 'Other'
        const bucket = cropMix[name] || { crop: name, area: 0, yield: 0, income: 0, count: 0, season: c.seasons?.display_label }
        bucket.area += Number(c.area_acres || 0)
        bucket.yield += Number(c.yield_quintal || 0)
        bucket.income += Number(c.gross_income || 0)
        bucket.count += 1
        cropMix[name] = bucket
      }
      const crop_mix = Object.values(cropMix).sort((a, b) => b.count - a.count)

      const inc = incomeRes.data || []
      const incomeAgg = inc.reduce((acc, r) => {
        acc.baseline += Number(r.baseline_income || 0)
        acc.current += Number(r.current_income || 0)
        if (r.impact_status === 'Increase') acc.improved += 1
        else if (r.impact_status === 'Decrease') acc.declined += 1
        return acc
      }, { baseline: 0, current: 0, improved: 0, declined: 0 })
      incomeAgg.farmers = inc.length
      incomeAgg.avg_baseline = inc.length ? Math.round(incomeAgg.baseline / inc.length) : 0
      incomeAgg.avg_current = inc.length ? Math.round(incomeAgg.current / inc.length) : 0
      incomeAgg.change_pct = incomeAgg.baseline ? ((incomeAgg.current - incomeAgg.baseline) / incomeAgg.baseline) * 100 : null

      const groups = (groupsRes.data || []).map((g) => ({
        group_code: g.group_code, group_type: g.group_type, group_name: g.group_name, member_count: g.group_members?.[0]?.count || 0,
      }))
      return json({
        village: { ...(sumRes.data || {}), village_id: vid, village: vName, village_code: villageMeta.data.village_code },
        farmers: farmerRes.data || [],
        crop_mix,
        income: incomeAgg,
        groups,
      })
    }

    // === NEW: Group attendance (per member %) ===
    if (route.match(/^\/mis\/groups\/[^/]+\/attendance$/) && method === 'GET') {
      const groupCode = decodeURIComponent(path[2] || '')
      const { data: g, error: gE } = await supabase.from('farmer_groups').select('group_id, group_name, group_type').eq('group_code', groupCode).maybeSingle()
      if (gE) throw gE
      if (!g) return json({ error: 'Group not found' }, { status: 404 })

      const [meetingsRes, membersRes, attRes] = await Promise.all([
        supabase.from('group_meetings').select('meeting_id, meeting_code, meeting_date, topic, members_present, total_members, attendance_pct, session_no').eq('group_id', g.group_id).order('meeting_date', { ascending: false }),
        supabase.from('group_members').select('group_member_id, farmers(farmer_code, head_of_family_name, villages(name))').eq('group_id', g.group_id),
        supabase.from('meeting_attendance').select('meeting_id, group_member_id, attended').in('meeting_id', (await supabase.from('group_meetings').select('meeting_id').eq('group_id', g.group_id)).data?.map(m => m.meeting_id) || []),
      ])
      if (meetingsRes.error) throw meetingsRes.error
      if (membersRes.error) throw membersRes.error

      const totalMeetings = meetingsRes.data?.length || 0
      const attByMember = new Map()
      for (const a of attRes.data || []) {
        const cur = attByMember.get(a.group_member_id) || 0
        if (a.attended) attByMember.set(a.group_member_id, cur + 1)
        else if (!attByMember.has(a.group_member_id)) attByMember.set(a.group_member_id, 0)
      }
      const members = (membersRes.data || []).map((m) => {
        const attended = attByMember.get(m.group_member_id) || 0
        return {
          group_member_id: m.group_member_id,
          farmer_code: m.farmers?.farmer_code,
          farmer_name: m.farmers?.head_of_family_name,
          village: m.farmers?.villages?.name,
          meetings_held: totalMeetings,
          meetings_attended: attended,
          attendance_pct: totalMeetings ? Math.round((attended / totalMeetings) * 1000) / 10 : null,
        }
      })
      const avg = members.length ? Math.round(members.reduce((s, m) => s + (m.attendance_pct || 0), 0) / members.length * 10) / 10 : 0
      return json({ group: { group_code: groupCode, ...g }, meetings: meetingsRes.data || [], members, summary: { total_meetings: totalMeetings, avg_attendance_pct: avg } })
    }

    // === NEW: Record a group meeting with attendance ===
    if (route.match(/^\/mis\/groups\/[^/]+\/meetings$/) && method === 'POST') {
      const groupCode = decodeURIComponent(path[2] || '')
      const body = await request.json()
      const { data: g, error: gE } = await supabase.from('farmer_groups').select('group_id, group_type').eq('group_code', groupCode).maybeSingle()
      if (gE) throw gE
      if (!g) return json({ error: 'Group not found' }, { status: 404 })
      if (!body.meeting_date) return json({ error: 'meeting_date is required' }, { status: 400 })

      const presentIds = Array.isArray(body.present_member_ids) ? body.present_member_ids.map(Number) : []
      // Fetch all group members
      const { data: allMembers } = await supabase.from('group_members').select('group_member_id').eq('group_id', g.group_id)
      const totalMembers = allMembers?.length || 0
      // Generate meeting code
      const { count: existing } = await supabase.from('group_meetings').select('*', { count: 'exact', head: true }).eq('group_id', g.group_id)
      const sessionNo = (existing || 0) + 1
      const code = `MTG-${g.group_type}-${g.group_id}-${sessionNo}`
      const insMeeting = await supabase.from('group_meetings').insert({
        meeting_code: code,
        group_id: g.group_id,
        meeting_date: body.meeting_date,
        session_no: sessionNo,
        topic: body.topic || null,
        total_members: totalMembers,
        members_present: presentIds.length,
      }).select('meeting_id, meeting_code, meeting_date, attendance_pct').single()
      if (insMeeting.error) throw insMeeting.error

      if (presentIds.length) {
        const rows = presentIds.map((id) => ({ meeting_id: insMeeting.data.meeting_id, group_member_id: id, attended: true }))
        const insAtt = await supabase.from('meeting_attendance').insert(rows)
        if (insAtt.error) throw insAtt.error
      }
      return json({ meeting: insMeeting.data }, { status: 201 })
    }

    // === NEW: Add input distribution to a farmer ===
    if (route.match(/^\/mis\/farmers\/[^/]+\/inputs$/) && method === 'POST') {
      const farmerCode = decodeURIComponent(path[2] || '')
      const body = await request.json()
      const { data: farmer, error: fE } = await supabase.from('farmers').select('farmer_id').eq('farmer_code', farmerCode).maybeSingle()
      if (fE) throw fE
      if (!farmer) return json({ error: 'Farmer not found' }, { status: 404 })

      const seasonCode = body.season_code || 'SHIYALU'
      const [{ data: season }, { data: py }, { data: inputType }, { data: activity }] = await Promise.all([
        supabase.from('seasons').select('season_id').eq('season_code', seasonCode).maybeSingle(),
        supabase.from('project_years').select('project_year_id').eq('is_current', true).maybeSingle(),
        supabase.from('input_types').select('input_type_id').ilike('name', body.input_type || 'Seed').maybeSingle(),
        supabase.from('programme_activities').select('activity_id').ilike('name', body.activity || '%Seed/Input Kit%').maybeSingle(),
      ])
      if (!season || !py) return json({ error: 'Season or project year not configured' }, { status: 400 })
      if (!body.item_name) return json({ error: 'item_name is required' }, { status: 400 })

      const { data: unit } = body.unit ? await supabase.from('units').select('unit_id').eq('code', body.unit).maybeSingle() : { data: null }
      const payload = {
        farmer_id: farmer.farmer_id,
        season_id: season.season_id,
        project_year_id: py.project_year_id,
        activity_id: activity?.activity_id || null,
        input_type_id: inputType?.input_type_id || null,
        item_name: body.item_name.toString().slice(0, 150),
        variety_grade: body.variety?.toString().slice(0, 80) || null,
        quantity: body.quantity != null && body.quantity !== '' ? Number(body.quantity) : null,
        unit_id: unit?.unit_id || null,
        rate_per_unit: body.rate != null && body.rate !== '' ? Number(body.rate) : null,
        org_cost: body.org_cost != null && body.org_cost !== '' ? Number(body.org_cost) : 0,
        govt_cost: body.govt_cost != null && body.govt_cost !== '' ? Number(body.govt_cost) : 0,
        farmer_contribution: body.farmer_contribution != null && body.farmer_contribution !== '' ? Number(body.farmer_contribution) : 0,
      }
      if (!payload.activity_id || !payload.input_type_id) {
        // Fallback to the first available
        const [{ data: anyAct }, { data: anyType }] = await Promise.all([
          supabase.from('programme_activities').select('activity_id').limit(1).maybeSingle(),
          supabase.from('input_types').select('input_type_id').limit(1).maybeSingle(),
        ])
        payload.activity_id = payload.activity_id || anyAct?.activity_id
        payload.input_type_id = payload.input_type_id || anyType?.input_type_id
      }
      const { data, error } = await supabase.from('input_distributions').insert(payload).select('distribution_id, item_name, total_cost').single()
      if (error) throw error
      return json({ input: data }, { status: 201 })
    }

    // === NEW: Farmer input distributions list ===
    if (route.match(/^\/mis\/farmers\/[^/]+\/inputs$/) && method === 'GET') {
      const farmerCode = decodeURIComponent(path[2] || '')
      const { data: farmer, error: fE } = await supabase.from('farmers').select('farmer_id').eq('farmer_code', farmerCode).maybeSingle()
      if (fE) throw fE
      if (!farmer) return json({ error: 'Farmer not found' }, { status: 404 })
      const { data, error } = await supabase
        .from('input_distributions')
        .select('distribution_id, item_name, variety_grade, quantity, rate_per_unit, org_cost, govt_cost, farmer_contribution, total_cost, created_at, seasons(display_label,season_code), input_types(name), programme_activities(name)')
        .eq('farmer_id', farmer.farmer_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return json({ inputs: (data || []).map((r) => ({
        distribution_id: r.distribution_id,
        item_name: r.item_name,
        variety: r.variety_grade,
        quantity: r.quantity,
        rate: r.rate_per_unit,
        org_cost: r.org_cost,
        govt_cost: r.govt_cost,
        farmer_contribution: r.farmer_contribution,
        total_cost: r.total_cost,
        season: r.seasons?.display_label,
        input_type: r.input_types?.name,
        activity: r.programme_activities?.name,
      })) })
    }

    // === NEW: Yield targets vs actuals per crop ===
    if (route === '/mis/yield-performance' && method === 'GET') {
      // Default targets in quintal/acre (realistic for Khanpur Block)
      const DEFAULT_TARGETS = {
        wheat: 15, gram: 8, maize: 20, rice: 20, paddy: 20, cotton: 10, 'bt cotton': 10,
        'pigeon pea': 6, tur: 6, bajra: 10, jowar: 8, chana: 8, sorghum: 8, mustard: 7,
        'ground nut': 10, groundnut: 10, soybean: 10, 'vegetable kit': 50,
      }
      const { data, error } = await supabase.from('crop_records').select('yield_quintal, area_acres, gross_income, crops(name), seasons(display_label,season_code)')
      if (error) throw error
      const buckets = {}
      for (const r of data || []) {
        const name = r.crops?.name || 'Other'
        const key = `${name.toLowerCase()}::${r.seasons?.season_code || '—'}`
        const bucket = buckets[key] || { crop: name, season: r.seasons?.display_label || '—', records: 0, total_area: 0, total_yield: 0, total_income: 0, under: 0, at_target: 0 }
        bucket.records += 1
        bucket.total_area += Number(r.area_acres || 0)
        bucket.total_yield += Number(r.yield_quintal || 0)
        bucket.total_income += Number(r.gross_income || 0)
        buckets[key] = bucket
      }
      const results = Object.values(buckets).map((b) => {
        const target = DEFAULT_TARGETS[b.crop.toLowerCase()] || null
        const avg_yield_per_acre = b.total_area ? b.total_yield / b.total_area : null
        const achievement = target && avg_yield_per_acre ? (avg_yield_per_acre / target) * 100 : null
        return {
          ...b,
          target_quintal_per_acre: target,
          avg_yield_per_acre: avg_yield_per_acre != null ? Math.round(avg_yield_per_acre * 10) / 10 : null,
          achievement_pct: achievement != null ? Math.round(achievement * 10) / 10 : null,
        }
      }).sort((a, b) => (b.records - a.records))

      // Under-performing farmers (per crop)
      const underPerformers = []
      for (const r of data || []) {
        const cropName = (r.crops?.name || '').toLowerCase()
        const target = DEFAULT_TARGETS[cropName]
        if (!target || !r.area_acres || !r.yield_quintal) continue
        const yp = Number(r.yield_quintal) / Number(r.area_acres)
        if (yp < target * 0.7) {
          underPerformers.push({ crop: r.crops.name, season: r.seasons?.display_label, yield_per_acre: Math.round(yp * 10) / 10, target, gap_pct: Math.round((1 - yp / target) * 100) })
        }
      }
      return json({ crops: results, under_performers_count: underPerformers.length, defaults: DEFAULT_TARGETS })
    }

    // === NEW: AI Weekly Briefing ===
    if (route === '/mis/ai-briefing' && method === 'POST') {
      // Build the data snapshot from existing views
      const [kpiRes, villageRes, impactRes, groupsRes] = await Promise.all([
        supabase.from('v_dashboard_kpis').select('*').limit(1).maybeSingle(),
        supabase.from('v_village_summary').select('village, total_farmers, farmers_shiyalu, avg_baseline_income, avg_current_income').order('total_farmers', { ascending: false }).limit(12),
        supabase.from('v_income_impact').select('village, baseline_income, current_income, income_change, impact_status'),
        supabase.from('farmer_groups').select('group_type, group_name, villages(name), group_members(count), group_meetings(attendance_pct)').eq('is_active', true),
      ])
      if (kpiRes.error) throw kpiRes.error

      // Yield rollup (same defaults as yield-performance)
      const DEFAULT_TARGETS = { wheat: 15, gram: 8, maize: 20, chana: 8, 'pigeon pea': 6, bajra: 10, cotton: 10, mustard: 7, groundnut: 10 }
      const { data: crops } = await supabase.from('crop_records').select('yield_quintal, area_acres, crops(name)')
      const cropAgg = {}
      for (const c of crops || []) {
        const n = (c.crops?.name || '').toLowerCase()
        if (!DEFAULT_TARGETS[n]) continue
        const b = cropAgg[n] || { crop: n, area: 0, yield: 0, records: 0 }
        b.area += Number(c.area_acres || 0); b.yield += Number(c.yield_quintal || 0); b.records += 1
        cropAgg[n] = b
      }
      const crop_yield = Object.values(cropAgg).map((b) => ({
        crop: b.crop,
        records: b.records,
        avg_yield_per_acre: b.area ? Math.round((b.yield / b.area) * 10) / 10 : null,
        target: DEFAULT_TARGETS[b.crop],
        achievement_pct: b.area ? Math.round((b.yield / b.area) / DEFAULT_TARGETS[b.crop] * 100) : null,
      }))

      // Village income rollup
      const villageIncome = {}
      for (const r of impactRes.data || []) {
        const k = r.village
        const b = villageIncome[k] || { village: k, baseline: 0, current: 0, farmers: 0, improved: 0, declined: 0 }
        b.baseline += Number(r.baseline_income || 0)
        b.current += Number(r.current_income || 0)
        b.farmers += 1
        if (r.impact_status === 'Increase') b.improved += 1
        if (r.impact_status === 'Decrease') b.declined += 1
        villageIncome[k] = b
      }
      const villageIncomeArr = Object.values(villageIncome).map((v) => ({
        ...v,
        avg_baseline: v.farmers ? Math.round(v.baseline / v.farmers) : 0,
        avg_current: v.farmers ? Math.round(v.current / v.farmers) : 0,
        change_pct: v.baseline ? Math.round(((v.current - v.baseline) / v.baseline) * 1000) / 10 : null,
      })).sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0))

      const groups = (groupsRes.data || []).map((g) => ({
        group: g.group_name,
        type: g.group_type,
        village: g.villages?.name,
        members: g.group_members?.[0]?.count || 0,
        meetings: g.group_meetings?.length || 0,
        avg_attendance: g.group_meetings?.length ? Math.round(g.group_meetings.reduce((s, m) => s + Number(m.attendance_pct || 0), 0) / g.group_meetings.length) : null,
      }))

      const snapshot = {
        programme: { block: 'Khanpur', district: 'Mahisagar', state: 'Gujarat', project_year: '2025-26' },
        kpis: kpiRes.data || {},
        villages_by_size: villageRes.data?.slice(0, 8) || [],
        village_income: {
          best: villageIncomeArr.slice(-3).reverse(),
          worst: villageIncomeArr.slice(0, 3),
        },
        crop_yield_vs_target: crop_yield,
        groups_summary: groups,
      }

      // Call LLM
      try {
        const apiKey = validateApiKey(process.env.EMERGENT_LLM_KEY)
        const provider = process.env.LLM_PROVIDER || 'openai'
        const model = process.env.LLM_MODEL || 'gpt-5'

        const schema = `Return ONE JSON object with this exact shape (no markdown, no commentary):
{
  "headline": "one-line programme status (max 110 chars)",
  "wins": ["3 crisp wins, each max 140 chars, referencing specific villages/crops/numbers"],
  "concerns": ["3 concrete concerns referencing specific villages/crops/numbers"],
  "actions": ["3 specific recommended actions for the Programme Manager this week"],
  "attention_villages": ["village names that need urgent CRP visit"]
}
Use concise English. Numbers must come from the snapshot. Do NOT invent names or metrics.`

        const chat = new LlmChat(
          apiKey,
          `briefing-${Date.now()}`,
          'You are an experienced NGO agriculture programme manager. You analyze MIS data snapshots and produce short, specific, actionable weekly briefings in English. Only use facts in the snapshot.'
        )
          .withModel(provider, model)
          .withParams({ max_tokens: 4000 })

        const reply = await chat.sendMessage(
          new UserMessage({ text: `${schema}\n\nSnapshot JSON:\n${JSON.stringify(snapshot)}` })
        )
        console.log('LLM raw reply type:', typeof reply, 'keys:', reply && typeof reply === 'object' ? Object.keys(reply) : 'n/a', 'val:', JSON.stringify(reply).slice(0, 500))
        const text = typeof reply === 'string' ? reply : (reply?.text || reply?.content || reply?.message || JSON.stringify(reply))
        // Strip code fences if any
        const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
        let briefing
        try { briefing = JSON.parse(cleaned) } catch { briefing = { headline: 'Briefing generated (parsing failed)', wins: [], concerns: [], actions: [cleaned.slice(0, 400)], attention_villages: [] } }
        return json({ briefing, generated_at: new Date().toISOString(), snapshot_summary: { farmers: snapshot.kpis.total_beneficiaries, villages: snapshot.kpis.villages_covered, crop_records: snapshot.kpis.khedut_crop_records } })
      } catch (llmErr) {
        console.error('LLM briefing error:', llmErr?.message || llmErr)
        return json({ error: 'Unable to generate AI briefing', detail: llmErr?.message?.slice(0, 200) }, { status: 502 })
      }
    }

    // === NEW: CSV exports ===
    if (route === '/mis/export/farmers.csv' && method === 'GET') {
      const { data, error } = await supabase.from('v_farmer_master').select('farmer_code, head_of_family_name, respondent_name, village, hamlet, panchayat, block, mobile_number, social_group, baseline_expenditure, shiyalu_input, unalu_input, chomasu_input, creeper_veg').order('village').order('head_of_family_name')
      if (error) throw error
      const rows = data || []
      const headers = ['Farmer Code', 'Head of Family', 'Respondent', 'Village', 'Hamlet', 'Panchayat', 'Block', 'Mobile', 'Social Group', 'Baseline Expenditure', 'Shiyalu', 'Unalu', 'Chomasu', 'Creeper Veg']
      const esc = (v) => v == null ? '' : /[,"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)
      const bool = (v) => (v ? 'Yes' : '')
      const csv = [headers.join(',')].concat(rows.map((r) => [r.farmer_code, r.head_of_family_name, r.respondent_name, r.village, r.hamlet, r.panchayat, r.block, r.mobile_number, r.social_group, r.baseline_expenditure, bool(r.shiyalu_input), bool(r.unalu_input), bool(r.chomasu_input), bool(r.creeper_veg)].map(esc).join(','))).join('\n')
      const response = new NextResponse(csv)
      response.headers.set('Content-Type', 'text/csv; charset=utf-8')
      response.headers.set('Content-Disposition', `attachment; filename="farmer_register_${new Date().toISOString().slice(0, 10)}.csv"`)
      return withCors(response)
    }

    if (route === '/mis/export/income-impact.csv' && method === 'GET') {
      const { data, error } = await supabase.from('v_income_impact').select('farmer_code, farmer_name, village, baseline_income, baseline_expenditure, current_income, current_expenditure, income_change, income_change_pct, impact_status, org_investment, govt_investment, net_benefit, project_year')
      if (error) throw error
      const rows = data || []
      const headers = ['Farmer Code', 'Farmer', 'Village', 'Baseline Income', 'Baseline Expenditure', 'Current Income', 'Current Expenditure', 'Income Change', 'Change %', 'Status', 'Org Investment', 'Govt Investment', 'Net Benefit', 'Year']
      const esc = (v) => v == null ? '' : /[,"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)
      const csv = [headers.join(',')].concat(rows.map((r) => [r.farmer_code, r.farmer_name, r.village, r.baseline_income, r.baseline_expenditure, r.current_income, r.current_expenditure, r.income_change, r.income_change_pct, r.impact_status, r.org_investment, r.govt_investment, r.net_benefit, r.project_year].map(esc).join(','))).join('\n')
      const response = new NextResponse(csv)
      response.headers.set('Content-Type', 'text/csv; charset=utf-8')
      response.headers.set('Content-Disposition', `attachment; filename="income_impact_${new Date().toISOString().slice(0, 10)}.csv"`)
      return withCors(response)
    }

    // Farmer 360 detail (keep below more specific routes)
    if (route.match(/^\/mis\/farmers\/[^/]+$/) && method === 'GET') {
      const farmerCode = decodeURIComponent(path[2] || '')
      if (!farmerCode) return json({ error: 'Farmer code is required.' }, { status: 400 })
      const { data, error } = await supabase.from('v_farmer_360').select('*').eq('farmer_code', farmerCode).limit(1).maybeSingle()
      if (error) throw error
      if (!data) return json({ error: 'Farmer not found.' }, { status: 404 })
      return json({ farmer: data })
    }

    // === NEW: Update farmer (mobile / village / social group / respondent) ===
    if (route.match(/^\/mis\/farmers\/[^/]+$/) && method === 'PATCH') {
      const farmerCode = decodeURIComponent(path[2] || '')
      if (!farmerCode) return json({ error: 'Farmer code is required.' }, { status: 400 })
      const body = await request.json()
      const updates = {}
      if (body.mobile_number !== undefined) {
        const m = (body.mobile_number || '').toString().replace(/\D/g, '').slice(-10)
        updates.mobile_number = m ? (/^[6-9]\d{9}$/.test(m) ? m : null) : null
      }
      if (body.village_id !== undefined && body.village_id !== null && body.village_id !== '') {
        const vid = Number(body.village_id)
        if (!Number.isInteger(vid)) return json({ error: 'Invalid village_id' }, { status: 400 })
        updates.village_id = vid
      }
      if (body.social_group_id !== undefined) {
        updates.social_group_id = body.social_group_id ? Number(body.social_group_id) : null
      }
      if (body.respondent_name !== undefined) {
        updates.respondent_name = body.respondent_name?.toString().trim() || null
      }
      if (body.head_of_family_name !== undefined && body.head_of_family_name?.toString().trim()) {
        updates.head_of_family_name = body.head_of_family_name.toString().trim()
      }
      if (!Object.keys(updates).length) return json({ error: 'No fields to update' }, { status: 400 })
      const { data, error } = await supabase.from('farmers').update(updates).eq('farmer_code', farmerCode).select('farmer_id, farmer_code, head_of_family_name, village_id, social_group_id, mobile_number, respondent_name').maybeSingle()
      if (error) throw error
      if (!data) return json({ error: 'Farmer not found.' }, { status: 404 })
      return json({ farmer: data })
    }

    // Create farmer
    if (route === '/mis/farmers' && method === 'POST') {
      const body = await request.json()
      const headOfFamilyName = body?.head_of_family_name?.trim()
      const villageId = Number(body?.village_id)
      if (!headOfFamilyName || !Number.isInteger(villageId)) return json({ error: 'Head of family name and village are required.' }, { status: 400 })
      const mobile = body.mobile_number ? body.mobile_number.toString().replace(/\D/g, '').slice(-10) : null
      const payload = {
        head_of_family_name: headOfFamilyName,
        respondent_name: body.respondent_name?.trim() || null,
        gender: body.gender || null,
        village_id: villageId,
        hamlet_id: body.hamlet_id ? Number(body.hamlet_id) : null,
        mobile_number: mobile && /^[6-9]\d{9}$/.test(mobile) ? mobile : null,
        social_group_id: body.social_group_id ? Number(body.social_group_id) : null,
        survey_date: body.survey_date || null,
        remarks: body.remarks?.trim() || null,
        registration_status: 'Registered',
      }
      const { data, error } = await supabase.from('farmers').insert(payload).select('farmer_id, farmer_code, head_of_family_name, village_id').single()
      if (error) throw error
      return json({ farmer: data }, { status: 201 })
    }

    return json({ error: `Route ${route} not found.` }, { status: 404 })
  } catch (error) {
    return apiError(error)
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PATCH = handleRoute
export const OPTIONS = handleRoute
