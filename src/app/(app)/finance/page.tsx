'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export default function FinancePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'trips' | 'fuel' | 'maintenance'>('overview')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [overview, setOverview] = useState<any>(null)
  const [tripCosts, setTripCosts] = useState<any[]>([])
  const [fuelCosts, setFuelCosts] = useState<any[]>([])
  const [maintCosts, setMaintCosts] = useState<any[]>([])

  useEffect(() => { loadAll() }, [dateFrom, dateTo])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadOverview(), loadTripCosts(), loadFuelCosts(), loadMaintCosts()])
    setLoading(false)
  }

  async function loadOverview() {
    const [{ data: fuel }, { data: maint }, { data: trips }] = await Promise.all([
      supabase.from('fuel_entries').select('amount').gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59`),
      supabase.from('maintenance_records').select('cost').gte('service_date', dateFrom).lte('service_date', dateTo).eq('status', 'completed'),
      supabase.from('trips').select('total_cost,total_distance,status').gte('planned_start', `${dateFrom}T00:00:00`).lte('planned_start', `${dateTo}T23:59:59`).is('deleted_at', null),
    ])

    const fuelTotal = (fuel ?? []).reduce((s, f) => s + (f.amount ?? 0), 0)
    const maintTotal = (maint ?? []).reduce((s, m) => s + (m.cost ?? 0), 0)
    const tripTotal = (trips ?? []).reduce((s, t) => s + (t.total_cost ?? 0), 0)
    const totalDist = (trips ?? []).reduce((s, t) => s + (t.total_distance ?? 0), 0)
    const grandTotal = fuelTotal + maintTotal
    const costPerKm = totalDist > 0 ? grandTotal / totalDist : 0
    const completedTrips = (trips ?? []).filter(t => t.status === 'completed').length

    setOverview({ fuelTotal, maintTotal, grandTotal, costPerKm, totalDist, completedTrips, tripTotal })
  }

  async function loadTripCosts() {
    const { data } = await supabase.from('trips')
      .select('id,trip_number,total_distance,total_cost,status,planned_start,branch:branches(name),vehicle:vehicles(vehicle_number),driver:drivers(full_name)')
      .gte('planned_start', `${dateFrom}T00:00:00`)
      .lte('planned_start', `${dateTo}T23:59:59`)
      .eq('status', 'completed')
      .order('planned_start', { ascending: false })
    setTripCosts(data ?? [])
  }

  async function loadFuelCosts() {
    const { data } = await supabase.from('fuel_entries')
      .select('id,amount,litres,fuel_type,created_at,vehicle:vehicles(vehicle_number),driver:drivers(full_name),station_name')
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`)
      .order('created_at', { ascending: false })
    setFuelCosts(data ?? [])
  }

  async function loadMaintCosts() {
    const { data } = await supabase.from('maintenance_records')
      .select('id,title,cost,maintenance_type,service_date,workshop_name,vehicle:vehicles(vehicle_number)')
      .gte('service_date', dateFrom)
      .lte('service_date', dateTo)
      .eq('status', 'completed')
      .not('cost', 'is', null)
      .order('service_date', { ascending: false })
    setMaintCosts(data ?? [])
  }

  const TABS = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'trips', label: '🚛 Trip Costs' },
    { key: 'fuel', label: '⛽ Fuel Costs' },
    { key: 'maintenance', label: '🔧 Maintenance Costs' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance & Costs</h1>
          <p className="page-subtitle">Track operational costs — fuel, maintenance and trip expenses</p>
        </div>
      </div>

      {/* Date range */}
      <div className="card mb-5">
        <div className="card-body">
          <div className="flex flex-wrap gap-3 items-end">
            <div><label className="form-label">From</label><input type="date" className="form-control h-9" value={dateFrom} onChange={e => setDateFrom(e.target.value)}/></div>
            <div><label className="form-label">To</label><input type="date" className="form-control h-9" value={dateTo} onChange={e => setDateTo(e.target.value)}/></div>
            {[
              { label: 'This Month', fn: () => { const d = new Date(); setDateFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]); setDateTo(d.toISOString().split('T')[0]) } },
              { label: 'Last Month', fn: () => { const d = new Date(); setDateFrom(new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]); setDateTo(new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]) } },
            ].map(b => <button key={b.label} onClick={b.fn} className="btn btn-secondary btn-sm">{b.label}</button>)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${tab === t.key ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/></div>}

      {/* OVERVIEW */}
      {!loading && tab === 'overview' && overview && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Spend', value: `AED ${overview.grandTotal.toLocaleString('en', { minimumFractionDigits: 2 })}`, color: 'text-primary-700', sub: 'Fuel + Maintenance' },
              { label: 'Fuel Cost', value: `AED ${overview.fuelTotal.toLocaleString('en', { minimumFractionDigits: 2 })}`, color: 'text-blue-700', sub: `${overview.fuelTotal > 0 && overview.grandTotal > 0 ? Math.round((overview.fuelTotal / overview.grandTotal) * 100) : 0}% of total` },
              { label: 'Maintenance Cost', value: `AED ${overview.maintTotal.toLocaleString('en', { minimumFractionDigits: 2 })}`, color: 'text-orange-600', sub: `${overview.maintTotal > 0 && overview.grandTotal > 0 ? Math.round((overview.maintTotal / overview.grandTotal) * 100) : 0}% of total` },
              { label: 'Cost per KM', value: overview.costPerKm > 0 ? `AED ${overview.costPerKm.toFixed(2)}` : '—', color: 'text-green-700', sub: `${overview.totalDist.toLocaleString()} km total` },
            ].map((s, i) => (
              <div key={i} className="card">
                <div className="card-body">
                  <div className={`text-[22px] font-extrabold ${s.color}`}>{s.value}</div>
                  <div className="text-[13px] text-gray-600 font-medium mt-0.5">{s.label}</div>
                  <div className="text-[11px] text-gray-400">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Cost breakdown bar */}
          {overview.grandTotal > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Cost Breakdown</span></div>
              <div className="card-body">
                <div className="flex rounded-full overflow-hidden h-8 mb-3">
                  <div className="bg-blue-500 flex items-center justify-center text-white text-[11px] font-bold transition-all"
                    style={{ width: `${(overview.fuelTotal / overview.grandTotal) * 100}%` }}>
                    {overview.fuelTotal > 0 ? 'Fuel' : ''}
                  </div>
                  <div className="bg-orange-400 flex items-center justify-center text-white text-[11px] font-bold transition-all"
                    style={{ width: `${(overview.maintTotal / overview.grandTotal) * 100}%` }}>
                    {overview.maintTotal > 0 ? 'Maint.' : ''}
                  </div>
                </div>
                <div className="flex gap-4 text-[12px]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"/>Fuel: AED {overview.fuelTotal.toFixed(0)}</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block"/>Maintenance: AED {overview.maintTotal.toFixed(0)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TRIP COSTS */}
      {!loading && tab === 'trips' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Completed Trips</span>
            <span className="text-[12px] text-gray-400">{tripCosts.length} trips</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Trip #</th><th>Date</th><th>Vehicle</th><th>Driver</th><th>Branch</th><th>Distance</th><th>Cost</th></tr></thead>
              <tbody>
                {tripCosts.length === 0
                  ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">No completed trips in this period</td></tr>
                  : tripCosts.map(t => (
                    <tr key={t.id}>
                      <td className="font-mono text-[12px]">{t.trip_number}</td>
                      <td className="text-[12px]">{formatDate(t.planned_start, 'dd MMM')}</td>
                      <td className="text-[13px]">{t.vehicle?.vehicle_number ?? '—'}</td>
                      <td className="text-[13px]">{t.driver?.full_name ?? '—'}</td>
                      <td className="text-[12px]">{t.branch?.name ?? '—'}</td>
                      <td className="text-[13px]">{t.total_distance ? `${t.total_distance.toLocaleString()} km` : '—'}</td>
                      <td className="font-semibold text-[13px]">{t.total_cost ? `AED ${t.total_cost.toFixed(2)}` : '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FUEL COSTS */}
      {!loading && tab === 'fuel' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Fuel Expenses</span>
            <span className="text-[12px] text-gray-400">Total: AED {fuelCosts.reduce((s, f) => s + (f.amount ?? 0), 0).toFixed(2)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Vehicle</th><th>Driver</th><th>Type</th><th>Litres</th><th>Amount</th><th>Station</th></tr></thead>
              <tbody>
                {fuelCosts.length === 0
                  ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">No fuel entries in this period</td></tr>
                  : fuelCosts.map(f => (
                    <tr key={f.id}>
                      <td className="text-[12px]">{formatDate(f.created_at, 'dd MMM')}</td>
                      <td className="font-semibold text-[13px]">{f.vehicle?.vehicle_number ?? '—'}</td>
                      <td className="text-[13px]">{f.driver?.full_name ?? '—'}</td>
                      <td><span className="badge bg-blue-100 text-blue-700 text-[11px]">{f.fuel_type}</span></td>
                      <td className="text-[13px]">{f.litres?.toFixed(1)} L</td>
                      <td className="font-bold text-primary-700">AED {f.amount?.toFixed(2)}</td>
                      <td className="text-[12px]">{f.station_name ?? '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MAINTENANCE COSTS */}
      {!loading && tab === 'maintenance' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Maintenance Expenses</span>
            <span className="text-[12px] text-gray-400">Total: AED {maintCosts.reduce((s, m) => s + (m.cost ?? 0), 0).toFixed(2)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Vehicle</th><th>Type</th><th>Title</th><th>Workshop</th><th>Cost</th></tr></thead>
              <tbody>
                {maintCosts.length === 0
                  ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">No maintenance costs in this period</td></tr>
                  : maintCosts.map(m => (
                    <tr key={m.id}>
                      <td className="text-[12px]">{formatDate(m.service_date, 'dd MMM')}</td>
                      <td className="font-semibold text-[13px]">{m.vehicle?.vehicle_number ?? '—'}</td>
                      <td><span className="badge bg-orange-100 text-orange-700 text-[11px] capitalize">{m.maintenance_type}</span></td>
                      <td className="text-[13px]">{m.title}</td>
                      <td className="text-[12px]">{m.workshop_name ?? '—'}</td>
                      <td className="font-bold text-primary-700">AED {m.cost?.toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
