'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, BookOpen, CalendarCheck, Check, ChevronRight, CircleHelp, Download, FileSpreadsheet, LayoutDashboard, Leaf, LineChart, MapPin, Menu, Package, Pencil, Plus, Printer, RefreshCw, Save, Search, Sparkles, Sprout, Target, TrendingDown, TrendingUp, Users, UsersRound, Wheat, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 })

const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : number.format(Number(v)))
const money = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : currency.format(Number(v)))
const moneyShort = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : '₹' + compact.format(Number(v)))

function StatCard({ icon: Icon, label, value, note, tone = 'green' }) {
  const tones = {
    green: ['bg-emerald-100', 'bg-emerald-50 text-emerald-700'],
    amber: ['bg-amber-100', 'bg-amber-50 text-amber-700'],
    blue:  ['bg-sky-100',  'bg-sky-50 text-sky-700'],
    rose:  ['bg-rose-100', 'bg-rose-50 text-rose-700'],
  }
  const [bgTone, iconTone] = tones[tone] || tones.green
  return (
    <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5">
      <CardContent className="relative p-5">
        <div className={`absolute right-0 top-0 h-20 w-20 -translate-y-5 translate-x-5 rounded-full ${bgTone}`} />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
          </div>
          <div className={`rounded-xl p-2.5 ${iconTone}`}><Icon className="h-5 w-5" /></div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ title, detail }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 text-center">
      <CircleHelp className="mb-3 h-7 w-7 text-muted-foreground" />
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [villages, setVillages] = useState([])
  const [farmers, setFarmers] = useState([])
  const [farmerTotal, setFarmerTotal] = useState(0)
  const [references, setReferences] = useState({ villages: [], social_groups: [] })
  const [selectedFarmer, setSelectedFarmer] = useState(null)
  const [farmerCrops, setFarmerCrops] = useState([])
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ mobile_number: '', village_id: '', social_group_id: '', respondent_name: '' })
  const [impact, setImpact] = useState(null)
  const [groupsData, setGroupsData] = useState(null)
  const [selectedVillage, setSelectedVillage] = useState(null)
  const [villageLoading, setVillageLoading] = useState(false)
  const [cropFormOpen, setCropFormOpen] = useState(false)
  const [cropForm, setCropForm] = useState({ crop_name: '', season_code: 'SHIYALU', area_acres: '', sowing_date: '', yield_quintal: '', gross_income: '', variety: '' })
  const [inputFormOpen, setInputFormOpen] = useState(false)
  const [inputForm, setInputForm] = useState({ item_name: '', variety: '', input_type: 'Seed', season_code: 'SHIYALU', quantity: '', unit: 'kg', rate: '', org_cost: '', govt_cost: '' })
  const [farmerInputs, setFarmerInputs] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10))
  const [attendanceTopic, setAttendanceTopic] = useState('')
  const [attendancePresent, setAttendancePresent] = useState({})
  const [yieldPerf, setYieldPerf] = useState(null)
  const [yieldLoading, setYieldLoading] = useState(false)
  const [briefing, setBriefing] = useState(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [farmersLoading, setFarmersLoading] = useState(false)
  const [impactLoading, setImpactLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [message, setMessage] = useState(null)
  const [form, setForm] = useState({ head_of_family_name: '', respondent_name: '', village_id: '', social_group_id: '', mobile_number: '' })

  const loadJson = async (url, options) => {
    const response = await fetch(url, { cache: 'no-store', ...options })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.detail || body.error || 'Unable to load MIS data.')
    return body
  }

  const loadOverview = useCallback(async () => {
    setLoading(true); setMessage(null)
    try {
      const [d, v, r] = await Promise.all([loadJson('/api/mis/dashboard'), loadJson('/api/mis/villages'), loadJson('/api/mis/references')])
      setDashboard(d); setVillages(v.villages || []); setReferences(r)
    } catch (e) { setMessage({ type: 'error', text: e.message }) }
    finally { setLoading(false) }
  }, [])

  const loadFarmers = useCallback(async (term = search) => {
    setFarmersLoading(true)
    try {
      const body = await loadJson(`/api/mis/farmers?search=${encodeURIComponent(term)}&page_size=100`)
      setFarmers(body.farmers || []); setFarmerTotal(body.total || 0); setMessage(null)
    } catch (e) { setMessage({ type: 'error', text: e.message }) }
    finally { setFarmersLoading(false) }
  }, [search])

  const loadImpact = useCallback(async () => {
    setImpactLoading(true)
    try { const body = await loadJson('/api/mis/income-impact'); setImpact(body) }
    catch (e) { setMessage({ type: 'error', text: e.message }) }
    finally { setImpactLoading(false) }
  }, [])

  const loadGroups = useCallback(async () => {
    try { const body = await loadJson('/api/mis/groups'); setGroupsData(body) }
    catch (e) { /* silent on dashboard */ }
  }, [])

  const openVillage = useCallback(async (village_id) => {
    setVillageLoading(true); setSelectedVillage({ loading: true, village_id })
    try { const body = await loadJson(`/api/mis/villages/${village_id}`); setSelectedVillage(body) }
    catch (e) { setMessage({ type: 'error', text: e.message }); setSelectedVillage(null) }
    finally { setVillageLoading(false) }
  }, [])

  const submitCrop = async (e) => {
    e.preventDefault(); setSaving(true); setMessage(null)
    try {
      await loadJson(`/api/mis/farmers/${encodeURIComponent(selectedFarmer.farmer_code)}/crops`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_name: cropForm.crop_name,
          season_code: cropForm.season_code,
          area_acres: cropForm.area_acres ? Number(cropForm.area_acres) : null,
          sowing_date: cropForm.sowing_date || null,
          yield_quintal: cropForm.yield_quintal ? Number(cropForm.yield_quintal) : null,
          gross_income: cropForm.gross_income ? Number(cropForm.gross_income) : null,
          variety: cropForm.variety || null,
        }),
      })
      setMessage({ type: 'success', text: 'Crop record added to the khedut diary.' })
      setCropForm({ crop_name: '', season_code: 'SHIYALU', area_acres: '', sowing_date: '', yield_quintal: '', gross_income: '', variety: '' })
      setCropFormOpen(false)
      // Reload crops
      const r = await loadJson(`/api/mis/farmers/${encodeURIComponent(selectedFarmer.farmer_code)}/crops`)
      setFarmerCrops(r.crops || [])
    } catch (e) { setMessage({ type: 'error', text: e.message }) }
    finally { setSaving(false) }
  }

  const submitInput = async (e) => {
    e.preventDefault(); setSaving(true); setMessage(null)
    try {
      await loadJson(`/api/mis/farmers/${encodeURIComponent(selectedFarmer.farmer_code)}/inputs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputForm),
      })
      setMessage({ type: 'success', text: 'Input distribution recorded.' })
      setInputForm({ item_name: '', variety: '', input_type: 'Seed', season_code: 'SHIYALU', quantity: '', unit: 'kg', rate: '', org_cost: '', govt_cost: '' })
      setInputFormOpen(false)
      const r = await loadJson(`/api/mis/farmers/${encodeURIComponent(selectedFarmer.farmer_code)}/inputs`)
      setFarmerInputs(r.inputs || [])
    } catch (e) { setMessage({ type: 'error', text: e.message }) }
    finally { setSaving(false) }
  }

  const openGroup = async (groupCode) => {
    try {
      const body = await loadJson(`/api/mis/groups/${encodeURIComponent(groupCode)}/attendance`)
      setSelectedGroup(body); setAttendanceOpen(false); setAttendancePresent({})
    } catch (e) { setMessage({ type: 'error', text: e.message }) }
  }

  const submitAttendance = async (e) => {
    e.preventDefault(); setSaving(true); setMessage(null)
    try {
      const present_member_ids = Object.entries(attendancePresent).filter(([, v]) => v).map(([k]) => Number(k))
      await loadJson(`/api/mis/groups/${encodeURIComponent(selectedGroup.group.group_code)}/meetings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_date: attendanceDate, topic: attendanceTopic, present_member_ids }),
      })
      setMessage({ type: 'success', text: 'Meeting recorded with attendance.' })
      setAttendanceOpen(false); setAttendanceTopic(''); setAttendancePresent({})
      // Reload group attendance
      const r = await loadJson(`/api/mis/groups/${encodeURIComponent(selectedGroup.group.group_code)}/attendance`)
      setSelectedGroup(r)
      loadGroups()
    } catch (e) { setMessage({ type: 'error', text: e.message }) }
    finally { setSaving(false) }
  }

  const loadYield = useCallback(async () => {
    setYieldLoading(true)
    try { const body = await loadJson('/api/mis/yield-performance'); setYieldPerf(body) }
    catch (e) { setMessage({ type: 'error', text: e.message }) }
    finally { setYieldLoading(false) }
  }, [])

  const generateBriefing = useCallback(async () => {
    setBriefingLoading(true); setMessage(null)
    try {
      const body = await loadJson('/api/mis/ai-briefing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      setBriefing(body)
    } catch (e) { setMessage({ type: 'error', text: e.message }) }
    finally { setBriefingLoading(false) }
  }, [])

  useEffect(() => { loadOverview() }, [loadOverview])
  useEffect(() => { if (activeView === 'farmers') loadFarmers('') }, [activeView, loadFarmers])
  useEffect(() => { if (activeView === 'impact' && !impact) loadImpact() }, [activeView, impact, loadImpact])
  useEffect(() => { if (activeView === 'yield' && !yieldPerf) loadYield() }, [activeView, yieldPerf, loadYield])
  useEffect(() => { loadGroups() }, [loadGroups])

  const kpis = dashboard?.kpis || {}
  const bands = dashboard?.income_bands || []
  const maxVillageFarmers = useMemo(() => Math.max(...villages.map((v) => Number(v.total_farmers || 0)), 1), [villages])
  const maxBandFarmers = useMemo(() => Math.max(...bands.map((v) => Number(v.farmers || 0)), 1), [bands])
  const navigate = (view) => { setActiveView(view); setMobileNavOpen(false) }

  const openFarmer = async (farmer) => {
    try {
      const body = await loadJson(`/api/mis/farmers/${encodeURIComponent(farmer.farmer_code)}`)
      setSelectedFarmer(body.farmer); setEditing(false); setFarmerCrops([]); setFarmerInputs([])
      // Fetch crop diary and inputs in parallel
      loadJson(`/api/mis/farmers/${encodeURIComponent(farmer.farmer_code)}/crops`).then((r) => setFarmerCrops(r.crops || [])).catch(() => {})
      loadJson(`/api/mis/farmers/${encodeURIComponent(farmer.farmer_code)}/inputs`).then((r) => setFarmerInputs(r.inputs || [])).catch(() => {})
    } catch (e) { setMessage({ type: 'error', text: e.message }) }
  }

  const startEdit = () => {
    if (!selectedFarmer) return
    // Resolve current village_id and social_group_id from references
    const village = references.villages.find((v) => v.name === selectedFarmer.village)
    const sg = references.social_groups.find((g) => g.name === selectedFarmer.social_group)
    setEditForm({
      mobile_number: selectedFarmer.mobile_number || '',
      village_id: village?.village_id || '',
      social_group_id: sg?.social_group_id || '',
      respondent_name: selectedFarmer.respondent_name || '',
    })
    setEditing(true)
  }

  const saveEdit = async (e) => {
    e.preventDefault(); setSaving(true); setMessage(null)
    try {
      await loadJson(`/api/mis/farmers/${encodeURIComponent(selectedFarmer.farmer_code)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm),
      })
      setMessage({ type: 'success', text: 'Farmer record updated.' })
      // Reload the farmer 360 and the list
      const body = await loadJson(`/api/mis/farmers/${encodeURIComponent(selectedFarmer.farmer_code)}`)
      setSelectedFarmer(body.farmer); setEditing(false)
      loadFarmers(search)
    } catch (e) { setMessage({ type: 'error', text: e.message }) }
    finally { setSaving(false) }
  }

  const submitFarmer = async (event) => {
    event.preventDefault(); setSaving(true); setMessage(null)
    try {
      await loadJson('/api/mis/farmers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      setMessage({ type: 'success', text: 'Farmer added to the master register.' })
      setForm({ head_of_family_name: '', respondent_name: '', village_id: '', social_group_id: '', mobile_number: '' })
      setFormOpen(false)
      await Promise.all([loadOverview(), loadFarmers(search)])
    } catch (e) { setMessage({ type: 'error', text: e.message }) }
    finally { setSaving(false) }
  }

  const navItems = [
    { key: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { key: 'farmers', label: 'Farmer register', icon: UsersRound },
    { key: 'villages', label: 'Village performance', icon: MapPin },
    { key: 'impact', label: 'Income impact', icon: LineChart },
    { key: 'yield', label: 'Yield performance', icon: Target },
  ]

  // Group farmer crops by season for diary display
  const cropsBySeason = useMemo(() => {
    const g = {}
    for (const c of farmerCrops) {
      const k = c.season || '—'
      if (!g[k]) g[k] = []
      g[k].push(c)
    }
    return g
  }, [farmerCrops])

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[254px] flex-col bg-[#123c2e] text-white lg:flex">
        <div className="flex h-24 items-center gap-3 px-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d7e7a7] text-[#123c2e]"><Sprout className="h-5 w-5" /></div>
          <div><p className="text-[15px] font-semibold tracking-tight">Kisan Samruddhi</p><p className="text-xs text-emerald-100/60">Agriculture MIS</p></div>
        </div>
        <div className="px-4"><Separator className="bg-white/10" /></div>
        <nav className="mt-8 flex-1 space-y-1 px-3">
          <p className="px-4 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/45">Workspace</p>
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => navigate(key)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${activeView === key ? 'bg-[#d7e7a7] font-semibold text-[#123c2e]' : 'text-emerald-50/70 hover:bg-white/10 hover:text-white'}`}>
              <Icon className="h-[18px] w-[18px]" />{label}
            </button>
          ))}
          <p className="mt-9 px-4 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/45">Programme</p>
          <div className="flex items-center gap-3 px-4 py-3 text-sm text-emerald-50/60"><BookOpen className="h-[18px] w-[18px]" />Khedut diary</div>
          <div className="flex items-center gap-3 px-4 py-3 text-sm text-emerald-50/60"><BarChart3 className="h-[18px] w-[18px]" />Financial summary</div>
        </nav>
        <div className="m-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-medium text-emerald-100/60">Current project year</p>
          <p className="mt-1 text-sm font-semibold">2025–26</p>
          <p className="mt-3 text-[11px] leading-relaxed text-emerald-100/50">Connected to the Supabase programme register</p>
        </div>
      </aside>

      {mobileNavOpen && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[270px] bg-[#123c2e] text-white transition-transform lg:hidden ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-7">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-[#d7e7a7] p-2 text-[#123c2e]"><Sprout className="h-5 w-5" /></div><span className="font-semibold">Kisan Samruddhi</span></div>
          <button onClick={() => setMobileNavOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-1 px-3">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => navigate(key)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm ${activeView === key ? 'bg-[#d7e7a7] font-semibold text-[#123c2e]' : 'text-emerald-50/70'}`}>
              <Icon className="h-[18px] w-[18px]" />{label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="lg:pl-[254px]">
        <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between border-b border-black/5 bg-[#f7f8f4]/90 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 hover:bg-black/5 lg:hidden" onClick={() => setMobileNavOpen(true)}><Menu className="h-5 w-5" /></button>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Khanpur Block · Mahisagar, Gujarat</p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight">
                {activeView === 'dashboard' ? 'Programme overview' : activeView === 'farmers' ? 'Farmer master register' : activeView === 'villages' ? 'Village performance' : activeView === 'impact' ? 'Income impact report' : 'Yield performance'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 sm:flex"><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />Live data</Badge>
            <Button variant="outline" size="sm" onClick={() => activeView === 'farmers' ? loadFarmers(search) : activeView === 'impact' ? loadImpact() : activeView === 'yield' ? loadYield() : loadOverview()} className="gap-2 bg-white">
              <RefreshCw className={`h-3.5 w-3.5 ${loading || farmersLoading || impactLoading || yieldLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d7e7a7] text-sm font-bold text-[#123c2e]">KS</div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
          {message && (
            <div className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{message.type === 'success' ? 'Saved successfully' : 'Data connection needs attention'}</p>
                <p className="mt-0.5 text-xs opacity-80">{message.text}</p>
              </div>
              <button className="ml-auto" onClick={() => setMessage(null)}><X className="h-4 w-4" /></button>
            </div>
          )}

          {/* ============== DASHBOARD ============== */}
          {activeView === 'dashboard' && (
            <div className="space-y-7">
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#e8f0d5] px-3 py-1 text-xs font-semibold text-[#38612c]"><span className="h-1.5 w-1.5 rounded-full bg-[#6a9b4a]" />Monitoring dashboard</div>
                  <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.03em] text-[#173b2d] sm:text-4xl">See progress from the field, in one clear view.</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">A living picture of farmer reach, village coverage, crop records and household income change.</p>
                </div>
                <Button onClick={() => navigate('farmers')} className="w-fit gap-2 bg-[#123c2e] text-white hover:bg-[#1d5842]">Open farmer register <ArrowUpRight className="h-4 w-4" /></Button>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={UsersRound} label="Total beneficiaries" value={loading ? '…' : num(kpis.total_beneficiaries)} note="Farmers in the master register" />
                <StatCard icon={MapPin} label="Villages covered" value={loading ? '…' : num(kpis.villages_covered)} note="Across the Khanpur programme" tone="blue" />
                <StatCard icon={TrendingUp} label="Avg baseline income" value={loading ? '…' : money(kpis.avg_baseline_income)} note="Household annual income" tone="amber" />
                <StatCard icon={Wheat} label="Khedut crop records" value={loading ? '…' : num(kpis.khedut_crop_records)} note="Season and crop observations" />
              </section>

              {/* === AI WEEKLY BRIEFING === */}
              <section>
                <Card className="relative overflow-hidden border-0 shadow-sm ring-1 ring-emerald-100">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-200/60 to-amber-100/60 blur-2xl" />
                  <CardContent className="relative p-6 sm:p-7">
                    {!briefing ? (
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-sm"><Sparkles className="h-5 w-5" /></div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">AI weekly briefing</p>
                            <h3 className="mt-1 text-lg font-semibold text-[#173b2d]">Ask the data what matters this week.</h3>
                            <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">We&apos;ll scan dashboard KPIs, village income trends, crop yield vs target and group attendance to surface wins, concerns and recommended CRP actions.</p>
                          </div>
                        </div>
                        <Button onClick={generateBriefing} disabled={briefingLoading} className="w-fit gap-2 bg-[#123c2e] text-white hover:bg-[#1d5842]">
                          {briefingLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          {briefingLoading ? 'Thinking…' : 'Generate briefing'}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white"><Sparkles className="h-5 w-5" /></div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">AI weekly briefing · {new Date(briefing.generated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                              <p className="mt-1 text-lg font-semibold leading-snug text-[#173b2d]">{briefing.briefing.headline}</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={generateBriefing} disabled={briefingLoading} className="gap-2 bg-white">
                            <RefreshCw className={`h-3.5 w-3.5 ${briefingLoading ? 'animate-spin' : ''}`} /> Regenerate
                          </Button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-800"><TrendingUp className="h-3.5 w-3.5" /> Wins</div>
                            <ul className="space-y-1.5 text-xs leading-5 text-emerald-900">
                              {briefing.briefing.wins?.map((w, i) => <li key={i} className="flex gap-1.5"><Check className="h-3 w-3 shrink-0 translate-y-0.5" /><span>{w}</span></li>)}
                            </ul>
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800"><AlertCircle className="h-3.5 w-3.5" /> Concerns</div>
                            <ul className="space-y-1.5 text-xs leading-5 text-amber-900">
                              {briefing.briefing.concerns?.map((c, i) => <li key={i} className="flex gap-1.5"><span className="mt-0.5">•</span><span>{c}</span></li>)}
                            </ul>
                          </div>
                          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-sky-800"><Target className="h-3.5 w-3.5" /> Actions this week</div>
                            <ol className="space-y-1.5 text-xs leading-5 text-sky-900">
                              {briefing.briefing.actions?.map((a, i) => <li key={i} className="flex gap-1.5"><span className="font-semibold">{i + 1}.</span><span>{a}</span></li>)}
                            </ol>
                          </div>
                        </div>

                        {briefing.briefing.attention_villages?.length ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-muted-foreground">Villages needing CRP visit:</span>
                            {briefing.briefing.attention_villages.map((v) => (
                              <Badge key={v} className="bg-rose-100 text-rose-800 hover:bg-rose-100"><MapPin className="mr-1 h-2.5 w-2.5" />{v}</Badge>
                            ))}
                          </div>
                        ) : null}
                        <p className="text-[10px] text-muted-foreground">Powered by Emergent LLM · {briefing.snapshot_summary?.farmers} farmers · {briefing.snapshot_summary?.villages} villages · {briefing.snapshot_summary?.crop_records} crop records analysed</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
                <Card className="border-0 shadow-sm ring-1 ring-black/5">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div><CardTitle className="text-base">Village reach</CardTitle><p className="mt-1 text-xs text-muted-foreground">Farmers registered by village</p></div>
                    <button onClick={() => navigate('villages')} className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900">View all <ChevronRight className="h-3.5 w-3.5" /></button>
                  </CardHeader>
                  <CardContent>
                    {villages.length ? (
                      <div className="space-y-4">
                        {villages.slice(0, 7).map((v) => (
                          <div key={v.village_id} className="grid grid-cols-[120px_1fr_40px] items-center gap-3 text-sm">
                            <span className="truncate font-medium text-foreground">{v.village}</span>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-[#6e9c52]" style={{ width: `${Math.max((Number(v.total_farmers || 0) / maxVillageFarmers) * 100, 2)}%` }} />
                            </div>
                            <span className="text-right text-xs font-semibold text-muted-foreground">{num(v.total_farmers)}</span>
                          </div>
                        ))}
                      </div>
                    ) : <EmptyState title={loading ? 'Loading village reach…' : 'No village data yet'} detail={loading ? 'Reading the programme summary views.' : 'Run the supplied schema and add village-linked farmers to see reach.'} />}
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm ring-1 ring-black/5">
                  <CardHeader className="pb-3"><CardTitle className="text-base">Baseline income bands</CardTitle><p className="mt-1 text-xs text-muted-foreground">Distribution of assessed households</p></CardHeader>
                  <CardContent>
                    {bands.length ? (
                      <div className="space-y-4">
                        {bands.map((band) => (
                          <div key={band.band}>
                            <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">{band.band?.replace(/^\d\. /, '')}</span><span className="font-semibold">{num(band.farmers)}</span></div>
                            <Progress value={(Number(band.farmers || 0) / maxBandFarmers) * 100} className="h-2 bg-muted [&>div]:bg-[#d5a84b]" />
                          </div>
                        ))}
                      </div>
                    ) : <EmptyState title={loading ? 'Loading income bands…' : 'No income assessments yet'} detail="Income bands will populate once baseline assessments are available." />}
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-5 md:grid-cols-3">
                <Card className="border-0 bg-[#123c2e] text-white shadow-sm md:col-span-2">
                  <CardContent className="flex flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-7">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-100/60">Seasonal reach</p>
                      <h3 className="mt-2 text-2xl font-semibold">Inputs are moving to farmers.</h3>
                      <p className="mt-2 max-w-lg text-sm leading-6 text-emerald-50/65">Track seasonal distribution, group participation and creeper vegetable support as your teams update records.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:min-w-[240px]">
                      <div><p className="text-2xl font-semibold">{num(kpis.shiyalu_beneficiaries)}</p><p className="text-xs text-emerald-100/55">Shiyalu</p></div>
                      <div><p className="text-2xl font-semibold">{num(kpis.unalu_beneficiaries)}</p><p className="text-xs text-emerald-100/55">Unalu</p></div>
                      <div><p className="text-2xl font-semibold">{num(kpis.chomasu_beneficiaries)}</p><p className="text-xs text-emerald-100/55">Chomasu</p></div>
                      <div><p className="text-2xl font-semibold">{num(kpis.creeper_veg_beneficiaries)}</p><p className="text-xs text-emerald-100/55">Creeper veg</p></div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-[#f0eadb] shadow-sm">
                  <CardContent className="flex h-full flex-col justify-between p-6">
                    <div>
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 text-[#886b2c]"><Users className="h-5 w-5" /></div>
                      <p className="text-sm font-semibold text-[#4a3a1c]">FIG &amp; FFS groups</p>
                      <p className="mt-1 text-xs leading-5 text-[#766443]">Peer-learning groups active in programme villages.</p>
                    </div>
                    <div className="mt-5 space-y-2">
                      <div className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-sm"><span className="font-medium text-[#4a3a1c]">FIG</span><span><span className="font-semibold">{num(groupsData?.summary?.fig_members)}</span> <span className="text-xs text-[#766443]">· {num(groupsData?.summary?.fig_groups)} groups</span></span></div>
                      <div className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-sm"><span className="font-medium text-[#4a3a1c]">FFS</span><span><span className="font-semibold">{num(groupsData?.summary?.ffs_members)}</span> <span className="text-xs text-[#766443]">· {num(groupsData?.summary?.ffs_groups)} groups</span></span></div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {groupsData?.groups?.length ? (
                <Card className="border-0 shadow-sm ring-1 ring-black/5">
                  <CardHeader className="pb-3"><CardTitle className="text-base">Groups register</CardTitle><p className="mt-1 text-xs text-muted-foreground">Active FIG &amp; FFS groups with member counts</p></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[680px] text-left text-sm">
                        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                          <tr><th className="px-5 py-3 font-medium">Group</th><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 font-medium">Village</th><th className="px-5 py-3 font-medium text-right">Members</th><th className="px-5 py-3 font-medium text-right">Capacity</th></tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {groupsData.groups.map((g) => (
                            <tr key={g.group_id} className="cursor-pointer hover:bg-muted/40" onClick={() => openGroup(g.group_code)}>
                              <td className="px-5 py-3"><p className="font-medium">{g.group_name}</p><p className="text-xs text-muted-foreground">{g.group_code}</p></td>
                              <td className="px-5 py-3"><Badge className={g.group_type === 'FIG' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-sky-100 text-sky-800 hover:bg-sky-100'}>{g.group_type}</Badge></td>
                              <td className="px-5 py-3 text-muted-foreground">{g.village}</td>
                              <td className="px-5 py-3 text-right font-semibold tabular-nums">{num(g.member_count)}</td>
                              <td className="px-5 py-3 text-right text-xs text-muted-foreground tabular-nums">{g.capacity ? num(g.capacity) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}

          {/* ============== FARMER REGISTER ============== */}
          {activeView === 'farmers' && (
            <div className="space-y-6">
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-medium text-emerald-700">Master register</p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[#173b2d]">Know every farmer by name.</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Search the register, open a 360° profile, or add a new household record.</p>
                </div>
                <Button onClick={() => setFormOpen((o) => !o)} className="w-fit gap-2 bg-[#123c2e] text-white hover:bg-[#1d5842]"><Plus className="h-4 w-4" /> Add farmer</Button>
                <Button asChild variant="outline" className="w-fit gap-2 bg-white"><a href="/api/mis/export/farmers.csv" download><FileSpreadsheet className="h-4 w-4" /> Export CSV</a></Button>
              </section>

              {formOpen && (
                <Card className="border-0 shadow-sm ring-1 ring-emerald-900/10">
                  <CardHeader><CardTitle className="text-base">New farmer record</CardTitle><p className="text-xs text-muted-foreground">A farmer code will be assigned from the village automatically.</p></CardHeader>
                  <CardContent>
                    <form onSubmit={submitFarmer} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2 lg:col-span-2"><Label htmlFor="head_of_family_name">Head of family name *</Label><Input id="head_of_family_name" required value={form.head_of_family_name} onChange={(e) => setForm({ ...form, head_of_family_name: e.target.value })} placeholder="e.g. Damor Sukhiben Galabhai" /></div>
                      <div className="space-y-2"><Label htmlFor="respondent_name">Respondent name</Label><Input id="respondent_name" value={form.respondent_name} onChange={(e) => setForm({ ...form, respondent_name: e.target.value })} /></div>
                      <div className="space-y-2"><Label htmlFor="mobile_number">Mobile number</Label><Input id="mobile_number" inputMode="numeric" value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} placeholder="10 digit number" /></div>
                      <div className="space-y-2"><Label htmlFor="village_id">Village *</Label>
                        <select id="village_id" required value={form.village_id} onChange={(e) => setForm({ ...form, village_id: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                          <option value="">Select village</option>
                          {references.villages.map((v) => <option key={v.village_id} value={v.village_id}>{v.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2"><Label htmlFor="social_group_id">Social group</Label>
                        <select id="social_group_id" value={form.social_group_id} onChange={(e) => setForm({ ...form, social_group_id: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                          <option value="">Select group</option>
                          {references.social_groups.map((g) => <option key={g.social_group_id} value={g.social_group_id}>{g.name}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
                        <Button type="submit" disabled={saving} className="bg-[#123c2e] text-white">{saving ? 'Saving…' : 'Save farmer'}</Button>
                        <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card className="border-0 shadow-sm ring-1 ring-black/5">
                <CardContent className="p-0">
                  <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-sm">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadFarmers(search)} placeholder="Search name, code or village" className="pl-9" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{farmerTotal ? `${num(farmerTotal)} farmers` : 'No records loaded'}</span>
                      <Button variant="outline" size="sm" onClick={() => loadFarmers(search)} className="gap-2"><Search className="h-3.5 w-3.5" /> Search</Button>
                    </div>
                  </div>
                  {farmersLoading ? (
                    <div className="p-10 text-center text-sm text-muted-foreground">Reading farmer register…</div>
                  ) : farmers.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                          <tr><th className="px-5 py-3 font-medium">Farmer</th><th className="px-5 py-3 font-medium">Location</th><th className="px-5 py-3 font-medium">Social group</th><th className="px-5 py-3 font-medium">Season support</th><th className="px-5 py-3" /></tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {farmers.map((f) => (
                            <tr key={f.farmer_id} className="group hover:bg-muted/20">
                              <td className="px-5 py-4"><p className="font-medium text-foreground">{f.head_of_family_name}</p><p className="mt-0.5 text-xs text-muted-foreground">{f.farmer_code || 'Unregistered'}</p></td>
                              <td className="px-5 py-4"><p>{f.village || '—'}</p><p className="mt-0.5 text-xs text-muted-foreground">{f.hamlet || f.panchayat || '—'}</p></td>
                              <td className="px-5 py-4 text-muted-foreground">{f.social_group || '—'}</td>
                              <td className="px-5 py-4">
                                <div className="flex gap-1.5">
                                  {f.shiyalu_input && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">S</Badge>}
                                  {f.unalu_input && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">U</Badge>}
                                  {f.chomasu_input && <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">C</Badge>}
                                  {!f.shiyalu_input && !f.unalu_input && !f.chomasu_input && <span className="text-xs text-muted-foreground">No inputs</span>}
                                </div>
                              </td>
                              <td className="px-5 py-4 text-right"><button onClick={() => openFarmer(f)} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 opacity-70 transition group-hover:opacity-100">View profile <ArrowUpRight className="h-3.5 w-3.5" /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="p-8"><EmptyState title={loading ? 'Loading farmer register…' : 'No farmers found'} detail={search ? 'Try a different name, farmer code or village.' : 'Add your first farmer record to begin the register.'} /></div>}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ============== VILLAGE PERFORMANCE ============== */}
          {activeView === 'villages' && (
            <div className="space-y-6">
              <section>
                <p className="text-sm font-medium text-emerald-700">Place-based reporting</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[#173b2d]">Village performance.</h2>
                <p className="mt-2 text-sm text-muted-foreground">Compare reach, seasonal activity and income movement across programme villages.</p>
              </section>
              {villages.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {villages.map((v) => (
                    <button type="button" key={v.village_id} onClick={() => openVillage(v.village_id)} className="text-left transition hover:-translate-y-0.5">
                      <Card className="border-0 shadow-sm ring-1 ring-black/5 transition hover:ring-emerald-300 hover:shadow-md">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between">
                            <div><p className="text-lg font-semibold">{v.village}</p><p className="mt-1 text-xs text-muted-foreground">{v.block || 'Khanpur Block'}</p></div>
                            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><MapPin className="h-4 w-4" /></div>
                          </div>
                          <div className="mt-6 grid grid-cols-2 gap-4">
                            <div><p className="text-2xl font-semibold">{num(v.total_farmers)}</p><p className="text-xs text-muted-foreground">farmers</p></div>
                            <div><p className="text-2xl font-semibold">{num(Number(v.fig_members || 0) + Number(v.ffs_members || 0))}</p><p className="text-xs text-muted-foreground">group members</p></div>
                          </div>
                          <Separator className="my-4" />
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div><p className="font-semibold text-emerald-700">{num(v.farmers_shiyalu)}</p><p className="mt-1 text-muted-foreground">Shiyalu</p></div>
                            <div><p className="font-semibold text-amber-700">{num(v.farmers_unalu)}</p><p className="mt-1 text-muted-foreground">Unalu</p></div>
                            <div><p className="font-semibold text-sky-700">{num(v.farmers_chomasu)}</p><p className="mt-1 text-muted-foreground">Chomasu</p></div>
                          </div>
                          <div className="mt-5 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5 text-xs">
                            <span className="text-muted-foreground">Avg current income</span>
                            <span className="font-semibold">{money(v.avg_current_income)}</span>
                          </div>
                          <div className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-emerald-700">Open village <ChevronRight className="h-3.5 w-3.5" /></div>
                        </CardContent>
                      </Card>
                    </button>
                  ))}
                </div>
              ) : <Card className="border-0 shadow-sm ring-1 ring-black/5"><CardContent className="p-6"><EmptyState title={loading ? 'Loading village performance…' : 'No village performance yet'} detail="Village-level metrics appear after the schema and programme records are available." /></CardContent></Card>}
            </div>
          )}

          {/* ============== INCOME IMPACT ============== */}
          {activeView === 'impact' && (
            <div className="space-y-6">
              <section>
                <p className="text-sm font-medium text-emerald-700">Baseline vs current</p>
                <div className="mt-1 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#173b2d]">Income impact report.</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Compare household income before and after programme intervention, village by village.</p>
                  </div>
                  <Button asChild variant="outline" className="w-fit gap-2 bg-white"><a href="/api/mis/export/income-impact.csv" download><Download className="h-4 w-4" /> Export CSV</a></Button>
                </div>
              </section>

              {impactLoading && <div className="p-10 text-center text-sm text-muted-foreground">Computing impact…</div>}

              {!impactLoading && impact && (
                <>
                  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard icon={UsersRound} label="Farmers assessed" value={num(impact.summary.farmers)} note="With baseline + current data" />
                    <StatCard icon={TrendingUp} label="Avg baseline income" value={money(impact.summary.avg_baseline)} note="Pre-programme, per household" tone="amber" />
                    <StatCard icon={LineChart} label="Avg current income" value={money(impact.summary.avg_current)} note="Current project year" tone="blue" />
                    <StatCard icon={impact.summary.avg_change_pct >= 0 ? TrendingUp : TrendingDown}
                      label="Avg change"
                      value={`${impact.summary.avg_change_pct >= 0 ? '+' : ''}${impact.summary.avg_change_pct.toFixed(1)}%`}
                      note={`${num(impact.summary.improved)} improved · ${num(impact.summary.declined)} declined · ${num(impact.summary.pending)} pending`}
                      tone={impact.summary.avg_change_pct >= 0 ? 'green' : 'rose'}
                    />
                  </section>

                  <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
                    <Card className="border-0 shadow-sm ring-1 ring-black/5">
                      <CardHeader className="pb-3"><CardTitle className="text-base">Village-level comparison</CardTitle><p className="mt-1 text-xs text-muted-foreground">Average household income, baseline vs current</p></CardHeader>
                      <CardContent>
                        {impact.villages.length ? (
                          <div className="space-y-5">
                            {impact.villages.map((v) => {
                              const maxAbs = Math.max(v.avg_baseline, v.avg_current, 1)
                              return (
                                <div key={v.village}>
                                  <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                                    <div className="flex items-center gap-2 font-medium">
                                      <span>{v.village}</span>
                                      <span className="text-[11px] font-normal text-muted-foreground">{num(v.farmers)} farmers</span>
                                    </div>
                                    <span className={`text-xs font-semibold ${v.change_pct == null ? 'text-muted-foreground' : v.change_pct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                      {v.change_pct == null ? '—' : `${v.change_pct >= 0 ? '+' : ''}${v.change_pct.toFixed(1)}%`}
                                    </span>
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-3">
                                      <span className="w-16 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">Base</span>
                                      <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
                                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${(v.avg_baseline / maxAbs) * 100}%` }} />
                                      </div>
                                      <span className="w-20 shrink-0 text-right text-xs tabular-nums">{moneyShort(v.avg_baseline)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="w-16 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">Current</span>
                                      <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
                                        <div className={`h-full rounded-full ${v.change_pct == null ? 'bg-slate-400' : v.change_pct >= 0 ? 'bg-emerald-500' : 'bg-rose-400'}`} style={{ width: `${(v.avg_current / maxAbs) * 100}%` }} />
                                      </div>
                                      <span className="w-20 shrink-0 text-right text-xs tabular-nums">{moneyShort(v.avg_current)}</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : <EmptyState title="No income data" detail="Village comparison appears once baseline + current records exist." />}
                      </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm ring-1 ring-black/5">
                      <CardHeader className="pb-3"><CardTitle className="text-base">Impact distribution</CardTitle><p className="mt-1 text-xs text-muted-foreground">How households are trending</p></CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">Income increased</span><span className="font-semibold text-emerald-700">{num(impact.summary.improved)}</span></div>
                            <Progress value={(impact.summary.improved / Math.max(impact.summary.farmers, 1)) * 100} className="h-2 bg-muted [&>div]:bg-emerald-500" />
                          </div>
                          <div>
                            <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">Income declined</span><span className="font-semibold text-rose-700">{num(impact.summary.declined)}</span></div>
                            <Progress value={(impact.summary.declined / Math.max(impact.summary.farmers, 1)) * 100} className="h-2 bg-muted [&>div]:bg-rose-400" />
                          </div>
                          <div>
                            <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">Pending (no current data)</span><span className="font-semibold text-slate-700">{num(impact.summary.pending)}</span></div>
                            <Progress value={(impact.summary.pending / Math.max(impact.summary.farmers, 1)) * 100} className="h-2 bg-muted [&>div]:bg-slate-400" />
                          </div>
                        </div>
                        <Separator className="my-5" />
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-lg bg-muted/40 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Org investment</p><p className="mt-1 font-semibold">{money(impact.summary.org_investment)}</p></div>
                          <div className="rounded-lg bg-muted/40 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Govt investment</p><p className="mt-1 font-semibold">{money(impact.summary.govt_investment)}</p></div>
                          <div className="rounded-lg bg-muted/40 p-3 col-span-2"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total mobilised</p><p className="mt-1 font-semibold">{money(impact.summary.org_investment + impact.summary.govt_investment)}</p></div>
                        </div>
                      </CardContent>
                    </Card>
                  </section>

                  <Card className="border-0 shadow-sm ring-1 ring-black/5">
                    <CardHeader className="pb-3"><CardTitle className="text-base">Top income movers</CardTitle><p className="mt-1 text-xs text-muted-foreground">Households with the biggest absolute change this year</p></CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                            <tr><th className="px-5 py-3 font-medium">Farmer</th><th className="px-5 py-3 font-medium">Village</th><th className="px-5 py-3 font-medium text-right">Baseline</th><th className="px-5 py-3 font-medium text-right">Current</th><th className="px-5 py-3 font-medium text-right">Change</th></tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {impact.top_movers.length ? impact.top_movers.map((m) => (
                              <tr key={m.farmer_code}>
                                <td className="px-5 py-3"><p className="font-medium">{m.farmer_name}</p><p className="text-xs text-muted-foreground">{m.farmer_code}</p></td>
                                <td className="px-5 py-3 text-muted-foreground">{m.village}</td>
                                <td className="px-5 py-3 text-right tabular-nums">{money(m.baseline)}</td>
                                <td className="px-5 py-3 text-right tabular-nums">{money(m.current)}</td>
                                <td className={`px-5 py-3 text-right font-semibold tabular-nums ${m.change >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  <span className="inline-flex items-center gap-1 justify-end">{m.change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{money(Math.abs(m.change))}</span>
                                </td>
                              </tr>
                            )) : <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">No movers yet.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}

          {/* ============== YIELD PERFORMANCE ============== */}
          {activeView === 'yield' && (
            <div className="space-y-6">
              <section>
                <p className="text-sm font-medium text-emerald-700">Target vs actual</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[#173b2d]">Yield performance.</h2>
                <p className="mt-2 text-sm text-muted-foreground">How crop yields in the field compare against programme targets. Default targets are tuned for Khanpur Block agro-climatic conditions.</p>
              </section>

              {yieldLoading ? <div className="p-10 text-center text-sm text-muted-foreground">Computing yield performance…</div> : null}

              {!yieldLoading && yieldPerf && (
                <>
                  <section className="grid gap-4 sm:grid-cols-3">
                    <StatCard icon={Wheat} label="Crops tracked" value={num(yieldPerf.crops.length)} note="Season × crop combinations" />
                    <StatCard icon={Target} label="Avg achievement" value={(() => { const vs = yieldPerf.crops.filter((c) => c.achievement_pct != null).map((c) => c.achievement_pct); return vs.length ? `${(vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(0)}%` : '—' })()} note="Weighted across tracked crops" tone="amber" />
                    <StatCard icon={TrendingDown} label="Under-performing farmers" value={num(yieldPerf.under_performers_count)} note="Yield < 70% of target" tone="rose" />
                  </section>

                  <Card className="border-0 shadow-sm ring-1 ring-black/5">
                    <CardHeader className="pb-3"><CardTitle className="text-base">Crop-wise yield achievement</CardTitle><p className="mt-1 text-xs text-muted-foreground">Average quintal / acre vs target</p></CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                              <th className="px-5 py-3 font-medium">Crop</th>
                              <th className="px-5 py-3 font-medium">Season</th>
                              <th className="px-5 py-3 font-medium text-right">Records</th>
                              <th className="px-5 py-3 font-medium text-right">Avg yield / acre</th>
                              <th className="px-5 py-3 font-medium text-right">Target</th>
                              <th className="px-5 py-3 font-medium">Achievement</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {yieldPerf.crops.map((c, i) => {
                              const pct = c.achievement_pct
                              const tone = pct == null ? 'bg-muted' : pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-rose-400'
                              return (
                                <tr key={i}>
                                  <td className="px-5 py-3 font-medium capitalize">{c.crop}</td>
                                  <td className="px-5 py-3 text-muted-foreground">{c.season}</td>
                                  <td className="px-5 py-3 text-right tabular-nums">{num(c.records)}</td>
                                  <td className="px-5 py-3 text-right tabular-nums">{c.avg_yield_per_acre != null ? c.avg_yield_per_acre : '—'}</td>
                                  <td className="px-5 py-3 text-right tabular-nums">{c.target_quintal_per_acre || '—'}</td>
                                  <td className="px-5 py-3">
                                    {pct != null ? (
                                      <div className="flex items-center gap-3">
                                        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(pct, 120)}%` }} /></div>
                                        <span className={`text-xs font-semibold tabular-nums ${pct >= 100 ? 'text-emerald-700' : pct >= 70 ? 'text-amber-700' : 'text-rose-700'}`}>{pct.toFixed(0)}%</span>
                                      </div>
                                    ) : <span className="text-xs text-muted-foreground">No target set</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ============== FARMER 360 DRAWER ============== */}
      {selectedFarmer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelectedFarmer(null)}>
          <section className="h-full w-full max-w-2xl overflow-y-auto bg-[#fbfcf8] p-6 shadow-2xl sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Farmer 360°</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#173b2d]">{selectedFarmer.head_of_family_name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedFarmer.farmer_code || 'Unregistered'} · {selectedFarmer.village || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                {!editing && (
                  <>
                    <a href={`/farmer/${encodeURIComponent(selectedFarmer.farmer_code)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-white px-3 text-sm font-medium hover:bg-accent">
                      <Printer className="h-3.5 w-3.5" /> Print
                    </a>
                    <Button size="sm" variant="outline" className="gap-1.5 bg-white" onClick={startEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  </>
                )}
                <button onClick={() => setSelectedFarmer(null)} className="rounded-lg p-2 hover:bg-black/5"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <Separator className="my-6" />

            {editing && (
              <form onSubmit={saveEdit} className="mb-6 grid gap-4 rounded-xl border border-emerald-200 bg-white p-5 sm:grid-cols-2">
                <div className="sm:col-span-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-emerald-800">Update farmer record</p>
                  <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e_mobile">Mobile number</Label>
                  <Input id="e_mobile" inputMode="numeric" value={editForm.mobile_number} onChange={(e) => setEditForm({ ...editForm, mobile_number: e.target.value })} placeholder="10 digit, starts 6-9" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e_resp">Respondent name</Label>
                  <Input id="e_resp" value={editForm.respondent_name} onChange={(e) => setEditForm({ ...editForm, respondent_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e_village">Village</Label>
                  <select id="e_village" value={editForm.village_id} onChange={(e) => setEditForm({ ...editForm, village_id: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Keep current</option>
                    {references.villages.map((v) => <option key={v.village_id} value={v.village_id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e_sg">Social group</Label>
                  <select id="e_sg" value={editForm.social_group_id} onChange={(e) => setEditForm({ ...editForm, social_group_id: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">None</option>
                    {references.social_groups.map((g) => <option key={g.social_group_id} value={g.social_group_id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={saving} className="gap-1.5 bg-[#123c2e] text-white"><Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save changes'}</Button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-4 ring-1 ring-black/5"><p className="text-xs text-muted-foreground">Current income</p><p className="mt-2 text-lg font-semibold">{money(selectedFarmer.current_income)}</p></div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-black/5"><p className="text-xs text-muted-foreground">Income change</p><p className={`mt-2 text-lg font-semibold ${Number(selectedFarmer.income_change) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{money(selectedFarmer.income_change)}</p></div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Household</p>
                <div className="mt-3 grid grid-cols-2 gap-y-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">Respondent</p><p className="mt-1 font-medium">{selectedFarmer.respondent_name || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Mobile</p><p className="mt-1 font-medium">{selectedFarmer.mobile_number || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Social group</p><p className="mt-1 font-medium">{selectedFarmer.social_group || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Hamlet</p><p className="mt-1 font-medium">{selectedFarmer.hamlet || '—'}</p></div>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Programme activity</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-white p-4"><p className="text-xs text-muted-foreground">Shiyalu crops</p><p className="mt-1 text-xl font-semibold">{num(selectedFarmer.shiyalu_crops)}</p></div>
                  <div className="rounded-xl border border-border bg-white p-4"><p className="text-xs text-muted-foreground">Input records</p><p className="mt-1 text-xl font-semibold">{num(selectedFarmer.input_records)}</p></div>
                  <div className="rounded-xl border border-border bg-white p-4"><p className="text-xs text-muted-foreground">FIG attendance</p><p className="mt-1 text-xl font-semibold">{selectedFarmer.fig_attendance_pct == null ? '—' : `${selectedFarmer.fig_attendance_pct}%`}</p></div>
                  <div className="rounded-xl border border-border bg-white p-4"><p className="text-xs text-muted-foreground">FFS attendance</p><p className="mt-1 text-xl font-semibold">{selectedFarmer.ffs_attendance_pct == null ? '—' : `${selectedFarmer.ffs_attendance_pct}%`}</p></div>
                </div>
              </div>
              <Separator />

              {/* === KHEDUT DIARY === */}
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Khedut diary</p>
                    <p className="text-xs text-muted-foreground">{num(farmerCrops.length)} crop records</p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 bg-white" onClick={() => setCropFormOpen((o) => !o)}><Plus className="h-3.5 w-3.5" /> Add crop</Button>
                </div>

                {cropFormOpen && (
                  <form onSubmit={submitCrop} className="mt-3 grid gap-3 rounded-xl border border-emerald-200 bg-white p-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="c_name" className="text-xs">Crop *</Label>
                      <Input id="c_name" required value={cropForm.crop_name} onChange={(e) => setCropForm({ ...cropForm, crop_name: e.target.value })} placeholder="e.g. Wheat" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c_season" className="text-xs">Season *</Label>
                      <select id="c_season" value={cropForm.season_code} onChange={(e) => setCropForm({ ...cropForm, season_code: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="SHIYALU">Shiyalu (Winter)</option>
                        <option value="UNALU">Unalu (Summer)</option>
                        <option value="CHOMASU">Chomasu (Monsoon)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c_var" className="text-xs">Variety</Label>
                      <Input id="c_var" value={cropForm.variety} onChange={(e) => setCropForm({ ...cropForm, variety: e.target.value })} placeholder="GW-451" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c_area" className="text-xs">Area (acres)</Label>
                      <Input id="c_area" type="number" step="0.1" value={cropForm.area_acres} onChange={(e) => setCropForm({ ...cropForm, area_acres: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c_sow" className="text-xs">Sowing date</Label>
                      <Input id="c_sow" type="date" value={cropForm.sowing_date} onChange={(e) => setCropForm({ ...cropForm, sowing_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c_yield" className="text-xs">Yield (quintal)</Label>
                      <Input id="c_yield" type="number" step="0.1" value={cropForm.yield_quintal} onChange={(e) => setCropForm({ ...cropForm, yield_quintal: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="c_inc" className="text-xs">Gross income (₹)</Label>
                      <Input id="c_inc" type="number" value={cropForm.gross_income} onChange={(e) => setCropForm({ ...cropForm, gross_income: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2 flex gap-2">
                      <Button type="submit" disabled={saving} className="gap-1.5 bg-[#123c2e] text-white"><Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save crop'}</Button>
                      <Button type="button" variant="ghost" onClick={() => setCropFormOpen(false)}>Cancel</Button>
                    </div>
                  </form>
                )}
                {Object.keys(cropsBySeason).length ? (
                  <div className="mt-3 space-y-4">
                    {Object.entries(cropsBySeason).map(([season, items]) => (
                      <div key={season} className="rounded-xl border border-border bg-white">
                        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-semibold">
                          <Leaf className="h-3.5 w-3.5 text-emerald-700" />{season}
                          <span className="ml-auto text-xs font-normal text-muted-foreground">{items.length} crop{items.length>1?'s':''}</span>
                        </div>
                        <div className="divide-y divide-border">
                          {items.map((c) => (
                            <div key={c.crop_record_id} className="grid grid-cols-2 gap-y-2 gap-x-4 px-4 py-3 text-sm sm:grid-cols-4">
                              <div><p className="font-medium capitalize">{c.crop_name} {c.variety ? <span className="text-xs text-muted-foreground">· {c.variety}</span> : null}</p><p className="text-[11px] text-muted-foreground">Crop #{c.crop_no} · {c.area_acres ?? '—'} acres</p></div>
                              <div><p className="text-[11px] text-muted-foreground">Sowing</p><p className="text-xs">{c.sowing_date || '—'}</p></div>
                              <div><p className="text-[11px] text-muted-foreground">Yield (q)</p><p className="text-xs font-medium">{num(c.yield_quintal)}</p></div>
                              <div><p className="text-[11px] text-muted-foreground">Income</p><p className="text-xs font-semibold text-emerald-700">{money(c.gross_income)}</p></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
                    No khedut diary entries yet for this farmer.
                  </div>
                )}
              </div>

              {/* === INPUT DISTRIBUTIONS === */}
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Input distributions</p>
                    <p className="text-xs text-muted-foreground">{num(farmerInputs.length)} items · {money(farmerInputs.reduce((s, r) => s + Number(r.total_cost || 0), 0))} received</p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 bg-white" onClick={() => setInputFormOpen((o) => !o)}><Plus className="h-3.5 w-3.5" /> Add input</Button>
                </div>

                {inputFormOpen && (
                  <form onSubmit={submitInput} className="mt-3 grid gap-3 rounded-xl border border-emerald-200 bg-white p-4 sm:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="i_item" className="text-xs">Item name *</Label>
                      <Input id="i_item" required value={inputForm.item_name} onChange={(e) => setInputForm({ ...inputForm, item_name: e.target.value })} placeholder="e.g. Urea 46%" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="i_type" className="text-xs">Type</Label>
                      <select id="i_type" value={inputForm.input_type} onChange={(e) => setInputForm({ ...inputForm, input_type: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="Seed">Seed</option>
                        <option value="Fertilizer">Fertilizer</option>
                        <option value="Pesticide">Pesticide</option>
                        <option value="Nursery/Seedling">Nursery/Seedling</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="i_season" className="text-xs">Season</Label>
                      <select id="i_season" value={inputForm.season_code} onChange={(e) => setInputForm({ ...inputForm, season_code: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="SHIYALU">Shiyalu</option>
                        <option value="UNALU">Unalu</option>
                        <option value="CHOMASU">Chomasu</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="i_qty" className="text-xs">Quantity</Label>
                      <Input id="i_qty" type="number" step="0.1" value={inputForm.quantity} onChange={(e) => setInputForm({ ...inputForm, quantity: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="i_unit" className="text-xs">Unit</Label>
                      <select id="i_unit" value={inputForm.unit} onChange={(e) => setInputForm({ ...inputForm, unit: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="kg">kg</option><option value="litre">litre</option><option value="no">no</option><option value="bag">bag</option><option value="quintal">quintal</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="i_org" className="text-xs">Org cost (₹)</Label>
                      <Input id="i_org" type="number" value={inputForm.org_cost} onChange={(e) => setInputForm({ ...inputForm, org_cost: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="i_govt" className="text-xs">Govt cost (₹)</Label>
                      <Input id="i_govt" type="number" value={inputForm.govt_cost} onChange={(e) => setInputForm({ ...inputForm, govt_cost: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="i_rate" className="text-xs">Rate / unit</Label>
                      <Input id="i_rate" type="number" value={inputForm.rate} onChange={(e) => setInputForm({ ...inputForm, rate: e.target.value })} />
                    </div>
                    <div className="sm:col-span-3 flex gap-2">
                      <Button type="submit" disabled={saving} className="gap-1.5 bg-[#123c2e] text-white"><Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save input'}</Button>
                      <Button type="button" variant="ghost" onClick={() => setInputFormOpen(false)}>Cancel</Button>
                    </div>
                  </form>
                )}

                {farmerInputs.length ? (
                  <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-white">
                    {farmerInputs.slice(0, 6).map((r) => (
                      <div key={r.distribution_id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3 text-sm">
                        <div><p className="font-medium">{r.item_name} {r.variety ? <span className="text-xs text-muted-foreground">· {r.variety}</span> : null}</p><p className="text-[11px] text-muted-foreground">{r.season} · {r.input_type} · qty {num(r.quantity)}</p></div>
                        <div className="text-right text-xs"><p className="font-semibold">{money(r.total_cost)}</p><p className="text-[10px] text-muted-foreground">Org {num(r.org_cost)} · Govt {num(r.govt_cost)}</p></div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <Separator />

              <div className="rounded-xl bg-[#e8f0d5] p-4 text-sm text-[#38612c]">
                <div className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4" />Impact status: {selectedFarmer.impact_status || 'Pending'}</div>
                <p className="mt-1 text-xs leading-5 text-[#537346]">Profile combines farmer master, crop diary, input distribution and income impact views.</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ============== VILLAGE DEEP DIVE DRAWER ============== */}
      {selectedVillage && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelectedVillage(null)}>
          <section className="h-full w-full max-w-3xl overflow-y-auto bg-[#fbfcf8] p-6 shadow-2xl sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Village profile</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#173b2d]">{selectedVillage.village?.village || '—'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedVillage.village?.block || 'Khanpur Block'} · {selectedVillage.village?.village_code || '—'}</p>
              </div>
              <button onClick={() => setSelectedVillage(null)} className="rounded-lg p-2 hover:bg-black/5"><X className="h-5 w-5" /></button>
            </div>
            <Separator className="my-6" />

            {villageLoading && !selectedVillage.farmers ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Loading village profile…</div>
            ) : (
              <>
                <section className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-white p-4 ring-1 ring-black/5"><p className="text-xs text-muted-foreground">Farmers</p><p className="mt-1 text-xl font-semibold">{num(selectedVillage.village?.total_farmers)}</p></div>
                  <div className="rounded-xl bg-white p-4 ring-1 ring-black/5"><p className="text-xs text-muted-foreground">Avg baseline</p><p className="mt-1 text-xl font-semibold">{moneyShort(selectedVillage.income?.avg_baseline)}</p></div>
                  <div className="rounded-xl bg-white p-4 ring-1 ring-black/5"><p className="text-xs text-muted-foreground">Avg current</p><p className="mt-1 text-xl font-semibold">{moneyShort(selectedVillage.income?.avg_current)}</p></div>
                  <div className="rounded-xl bg-white p-4 ring-1 ring-black/5"><p className="text-xs text-muted-foreground">Change</p><p className={`mt-1 text-xl font-semibold ${(selectedVillage.income?.change_pct ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{selectedVillage.income?.change_pct == null ? '—' : `${selectedVillage.income.change_pct >= 0 ? '+' : ''}${selectedVillage.income.change_pct.toFixed(1)}%`}</p></div>
                </section>

                <section className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Crop mix</p>
                  {selectedVillage.crop_mix?.length ? (
                    <div className="mt-3 space-y-2.5">
                      {(() => {
                        const maxCount = Math.max(...selectedVillage.crop_mix.map((c) => c.count), 1)
                        return selectedVillage.crop_mix.slice(0, 8).map((c) => (
                          <div key={c.crop} className="grid grid-cols-[110px_1fr_60px] items-center gap-3 text-sm">
                            <span className="truncate font-medium capitalize">{c.crop}</span>
                            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(c.count / maxCount) * 100}%` }} /></div>
                            <div className="text-right text-xs"><p className="font-semibold">{num(c.count)}</p><p className="text-[10px] text-muted-foreground">{c.area?.toFixed(1)} ac</p></div>
                          </div>
                        ))
                      })()}
                    </div>
                  ) : <p className="mt-3 text-sm text-muted-foreground">No crop records yet.</p>}
                </section>

                <section className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Groups ({selectedVillage.groups?.length || 0})</p>
                  {selectedVillage.groups?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedVillage.groups.map((g) => (
                        <div key={g.group_code} className="rounded-lg border border-border bg-white px-3 py-2 text-xs">
                          <Badge className={`mr-2 ${g.group_type === 'FIG' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-sky-100 text-sky-800 hover:bg-sky-100'}`}>{g.group_type}</Badge>
                          <span className="font-medium">{g.group_name}</span>
                          <span className="ml-2 text-muted-foreground">· {g.member_count} members</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-sm text-muted-foreground">No groups registered in this village.</p>}
                </section>

                <section className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Farmers ({selectedVillage.farmers?.length || 0})</p>
                  <div className="mt-3 overflow-hidden rounded-xl border border-border bg-white">
                    <div className="max-h-[380px] overflow-y-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                          <tr><th className="px-4 py-2 font-medium">Farmer</th><th className="px-4 py-2 font-medium">Hamlet</th><th className="px-4 py-2 font-medium">Social group</th><th className="px-4 py-2 font-medium text-right">Season</th></tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {selectedVillage.farmers?.slice(0, 200).map((f) => (
                            <tr key={f.farmer_id} className="cursor-pointer hover:bg-muted/40" onClick={() => { setSelectedVillage(null); openFarmer(f) }}>
                              <td className="px-4 py-2.5"><p className="font-medium">{f.head_of_family_name}</p><p className="text-[11px] text-muted-foreground">{f.farmer_code}</p></td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{f.hamlet || '—'}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{f.social_group || '—'}</td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="inline-flex gap-1">
                                  {f.shiyalu_input && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">S</Badge>}
                                  {f.unalu_input && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">U</Badge>}
                                  {f.chomasu_input && <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">C</Badge>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </>
            )}
          </section>
        </div>
      )}
      {/* ============== GROUP ATTENDANCE DRAWER ============== */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelectedGroup(null)}>
          <section className="h-full w-full max-w-2xl overflow-y-auto bg-[#fbfcf8] p-6 shadow-2xl sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{selectedGroup.group.group_type} group</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#173b2d]">{selectedGroup.group.group_name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedGroup.group.group_code} · {selectedGroup.summary?.total_meetings || 0} meetings · avg attendance {selectedGroup.summary?.avg_attendance_pct ?? 0}%</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 bg-white" onClick={() => setAttendanceOpen((o) => !o)}><CalendarCheck className="h-3.5 w-3.5" /> Record meeting</Button>
                <button onClick={() => setSelectedGroup(null)} className="rounded-lg p-2 hover:bg-black/5"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <Separator className="my-6" />

            {attendanceOpen && (
              <form onSubmit={submitAttendance} className="mb-6 rounded-xl border border-emerald-200 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="a_date" className="text-xs">Meeting date *</Label>
                    <Input id="a_date" type="date" required value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="a_topic" className="text-xs">Topic</Label>
                    <Input id="a_topic" value={attendanceTopic} onChange={(e) => setAttendanceTopic(e.target.value)} placeholder="e.g. Winter crop review" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mark present ({Object.values(attendancePresent).filter(Boolean).length}/{selectedGroup.members.length})</p>
                  <div className="grid gap-2 sm:grid-cols-2 max-h-[280px] overflow-y-auto">
                    {selectedGroup.members.map((m) => (
                      <label key={m.group_member_id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted/30">
                        <input type="checkbox" checked={!!attendancePresent[m.group_member_id]} onChange={(e) => setAttendancePresent({ ...attendancePresent, [m.group_member_id]: e.target.checked })} className="h-4 w-4 accent-emerald-700" />
                        <div className="flex-1 min-w-0"><p className="truncate font-medium">{m.farmer_name}</p><p className="truncate text-[10px] text-muted-foreground">{m.farmer_code}</p></div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button type="submit" disabled={saving} className="gap-1.5 bg-[#123c2e] text-white"><Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save meeting'}</Button>
                  <Button type="button" variant="ghost" onClick={() => setAttendanceOpen(false)}>Cancel</Button>
                </div>
              </form>
            )}

            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member attendance ({selectedGroup.members.length})</p>
              <div className="overflow-hidden rounded-xl border border-border bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-4 py-2 font-medium">Member</th><th className="px-4 py-2 font-medium">Village</th><th className="px-4 py-2 font-medium text-right">Attended</th><th className="px-4 py-2 font-medium">%</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedGroup.members.map((m) => {
                      const pct = m.attendance_pct
                      const tone = pct == null ? 'bg-muted' : pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                      return (
                        <tr key={m.group_member_id}>
                          <td className="px-4 py-2.5"><p className="font-medium">{m.farmer_name}</p><p className="text-[11px] text-muted-foreground">{m.farmer_code}</p></td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.village}</td>
                          <td className="px-4 py-2.5 text-right text-xs tabular-nums">{m.meetings_attended}/{m.meetings_held}</td>
                          <td className="px-4 py-2.5">
                            {pct != null ? (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} /></div>
                                <span className="text-xs font-semibold tabular-nums">{pct}%</span>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedGroup.meetings?.length ? (
              <section className="mt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Meeting log ({selectedGroup.meetings.length})</p>
                <div className="space-y-2">
                  {selectedGroup.meetings.slice(0, 10).map((m) => (
                    <div key={m.meeting_id} className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-2.5 text-sm">
                      <div><p className="font-medium">{m.meeting_date} · Session {m.session_no}</p>{m.topic && <p className="text-xs text-muted-foreground">{m.topic}</p>}</div>
                      <div className="text-right"><p className="text-xs text-muted-foreground">{m.members_present}/{m.total_members}</p><p className="text-xs font-semibold">{m.attendance_pct ?? '—'}%</p></div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </section>
        </div>
      )}
    </div>
  )
}

export default App
