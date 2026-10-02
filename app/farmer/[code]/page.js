'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Printer, Sprout } from 'lucide-react'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('en-IN')
const money = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : currency.format(Number(v)))
const num = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : number.format(Number(v)))

export default function FarmerPrintPage() {
  const { code } = useParams()
  const [farmer, setFarmer] = useState(null)
  const [crops, setCrops] = useState([])
  const [inputs, setInputs] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    const run = async () => {
      try {
        const [f, c, i] = await Promise.all([
          fetch(`/api/mis/farmers/${encodeURIComponent(code)}`).then((r) => r.json()),
          fetch(`/api/mis/farmers/${encodeURIComponent(code)}/crops`).then((r) => r.json()),
          fetch(`/api/mis/farmers/${encodeURIComponent(code)}/inputs`).then((r) => r.json()),
        ])
        if (!f.farmer) throw new Error(f.error || 'Farmer not found')
        setFarmer(f.farmer); setCrops(c.crops || []); setInputs(i.inputs || [])
      } catch (e) { setError(e.message) }
    }
    run()
  }, [code])

  if (error) return <div className="p-10 text-center text-rose-700">{error}</div>
  if (!farmer) return <div className="p-10 text-center text-muted-foreground">Loading farmer card…</div>

  const totalInputCost = inputs.reduce((s, r) => s + Number(r.total_cost || 0), 0)
  const totalIncome = crops.reduce((s, r) => s + Number(r.gross_income || 0), 0)

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="mx-auto max-w-[800px] p-8 print:p-0">
        {/* Toolbar */}
        <div className="no-print mb-4 flex items-center justify-between border-b border-neutral-200 pb-3">
          <div className="text-xs text-neutral-500">Printable farmer card · {code}</div>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </button>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-emerald-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-800">
              <Sprout className="h-4 w-4" /> Kisan Samruddhi · Agriculture MIS
            </div>
            <h1 className="mt-2 text-2xl font-bold">Farmer Card</h1>
            <p className="text-sm text-neutral-600">Khanpur Block · Mahisagar, Gujarat · 2025–26</p>
          </div>
          <div className="text-right">
            <div className="rounded border border-neutral-300 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Farmer Code</p>
              <p className="text-lg font-mono font-semibold">{farmer.farmer_code}</p>
            </div>
          </div>
        </div>

        {/* Identity */}
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold text-emerald-800">Identity</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><span className="text-neutral-500">Head of family:</span> <span className="font-semibold">{farmer.head_of_family_name}</span></div>
            <div><span className="text-neutral-500">Respondent:</span> <span>{farmer.respondent_name || '—'}</span></div>
            <div><span className="text-neutral-500">Village:</span> <span>{farmer.village}</span></div>
            <div><span className="text-neutral-500">Hamlet:</span> <span>{farmer.hamlet || '—'}</span></div>
            <div><span className="text-neutral-500">Panchayat:</span> <span>{farmer.panchayat || '—'}</span></div>
            <div><span className="text-neutral-500">Block:</span> <span>{farmer.block || 'Khanpur'}</span></div>
            <div><span className="text-neutral-500">Mobile:</span> <span>{farmer.mobile_number || '—'}</span></div>
            <div><span className="text-neutral-500">Social group:</span> <span>{farmer.social_group || '—'}</span></div>
          </div>
        </section>

        {/* Income */}
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold text-emerald-800">Income impact</h2>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div className="rounded border border-neutral-300 p-3"><p className="text-[10px] uppercase text-neutral-500">Baseline</p><p className="mt-1 font-semibold">{money(farmer.baseline_income)}</p></div>
            <div className="rounded border border-neutral-300 p-3"><p className="text-[10px] uppercase text-neutral-500">Current</p><p className="mt-1 font-semibold">{money(farmer.current_income)}</p></div>
            <div className="rounded border border-neutral-300 p-3"><p className="text-[10px] uppercase text-neutral-500">Change</p><p className={`mt-1 font-semibold ${Number(farmer.income_change) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{money(farmer.income_change)}</p></div>
            <div className="rounded border border-neutral-300 p-3"><p className="text-[10px] uppercase text-neutral-500">Status</p><p className="mt-1 font-semibold">{farmer.impact_status || 'Pending'}</p></div>
          </div>
        </section>

        {/* Khedut Diary */}
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold text-emerald-800">Khedut diary ({crops.length} crop records · total income {money(totalIncome)})</h2>
          {crops.length ? (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-emerald-50 text-left">
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold">Season</th>
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold">Crop</th>
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold">Variety</th>
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold text-right">Area (ac)</th>
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold">Sowing</th>
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold text-right">Yield (q)</th>
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold text-right">Income</th>
                </tr>
              </thead>
              <tbody>
                {crops.map((c) => (
                  <tr key={c.crop_record_id}>
                    <td className="border border-neutral-300 px-2 py-1.5">{c.season}</td>
                    <td className="border border-neutral-300 px-2 py-1.5 capitalize">{c.crop_name}</td>
                    <td className="border border-neutral-300 px-2 py-1.5">{c.variety || '—'}</td>
                    <td className="border border-neutral-300 px-2 py-1.5 text-right tabular-nums">{num(c.area_acres)}</td>
                    <td className="border border-neutral-300 px-2 py-1.5">{c.sowing_date || '—'}</td>
                    <td className="border border-neutral-300 px-2 py-1.5 text-right tabular-nums">{num(c.yield_quintal)}</td>
                    <td className="border border-neutral-300 px-2 py-1.5 text-right tabular-nums">{money(c.gross_income)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-neutral-500">No crop records yet.</p>}
        </section>

        {/* Inputs */}
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold text-emerald-800">Input distributions ({inputs.length} · total value {money(totalInputCost)})</h2>
          {inputs.length ? (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-emerald-50 text-left">
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold">Season</th>
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold">Item</th>
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold">Type</th>
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold text-right">Qty</th>
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold text-right">Org (₹)</th>
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold text-right">Govt (₹)</th>
                  <th className="border border-neutral-300 px-2 py-1.5 font-semibold text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {inputs.map((r) => (
                  <tr key={r.distribution_id}>
                    <td className="border border-neutral-300 px-2 py-1.5">{r.season}</td>
                    <td className="border border-neutral-300 px-2 py-1.5">{r.item_name}{r.variety ? <span className="text-neutral-500"> · {r.variety}</span> : null}</td>
                    <td className="border border-neutral-300 px-2 py-1.5">{r.input_type}</td>
                    <td className="border border-neutral-300 px-2 py-1.5 text-right tabular-nums">{num(r.quantity)}</td>
                    <td className="border border-neutral-300 px-2 py-1.5 text-right tabular-nums">{num(r.org_cost)}</td>
                    <td className="border border-neutral-300 px-2 py-1.5 text-right tabular-nums">{num(r.govt_cost)}</td>
                    <td className="border border-neutral-300 px-2 py-1.5 text-right tabular-nums font-semibold">{num(r.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-neutral-500">No input records yet.</p>}
        </section>

        {/* Footer */}
        <div className="mt-10 flex items-end justify-between border-t border-neutral-200 pt-4 text-[10px] text-neutral-500">
          <div>Generated on {new Date().toLocaleDateString('en-IN')} · Field copy for CRP</div>
          <div className="text-right">
            <div className="mt-6 w-40 border-t border-neutral-400 pt-1 text-center">CRP Signature</div>
          </div>
        </div>
      </div>
    </div>
  )
}
