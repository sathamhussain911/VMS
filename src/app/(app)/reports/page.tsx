'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export default function ReportsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'trips' | 'fuel' | 'drivers' | 'fleet'>('trips')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [tripStats, setTripStats] = useState<any>(null)
  const [fuelStats, setFuelStats] = useState<any>(null)
  const [driverStats, setDriverStats] = useState<any[]>([])
  const [fleetStats, setFleetStats] = useState<any[]>([])

  useEffect(() => { loadAll() }, [dateFrom, dateTo])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadTripStats(), loadFuelStats(), loadDriverStats(), loadFleetStats()])
    setLoading(false)
  }

  async function loadTripStats() {
    const { data: trips } = await supabase.from('trips')
      .select('id,status,priority,total_distance,planned_start,actual_start,actual_end,branch:branches(name)')
      .gte('planned_start', `${dateFrom}T00:00:00`)
      .lte('planned_start', `${dateTo}T23:59:59`)
      .is('deleted_at', null)

    if (!trips) return
    const total = trips.length
    const completed = trips.filter(t => t.status === 'completed').length
    const cancelled = trips.filter(t => t.status === 'cancelled').length
    const inProgress = trips.filter(t => t.status === 'in_progress').length
    const totalDistance = trips.reduce((s, t) => s + (t.total_distance ?? 0), 0)
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    // Branch breakdown
    const byBranch: Record<string, number> = {}
    trips.forEach(t => {
      const name = t.branch?.name ?? 'Unknown'
      byBranch[name] = (byBranch[name] ?? 0) + 1
    })

    // Priority breakdown
    const byPriority: Record<string, number> = {}
    trips.forEach(t => { byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1 })

    setTripStats({ total, completed, cancelled, inProgress, totalDistance, completionRate, byBranch, byPriority })
  }

  async function loadFuelStats() {
    const { data: fuel } = await supabase.from('fuel_entries')
      .select('litres,amount,efficiency_kmpl,anomaly_flag,vehicle:vehicles(vehicle_number),created_at')
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`)

    if (!fuel) return
    const totalCost = fuel.reduce((s, f) => s + (f.amount ?? 0), 0)
    const totalLitres = fuel.reduce((s, f) => s + (f.litres ?? 0), 0)
    const efficiencies = fuel.filter(f => f.efficiency_kmpl).map(f => f.efficiency_kmpl)
    const avgEfficiency = efficiencies.length ? efficiencies.reduce((s, e) => s + e, 0) / efficiencies.length : 0
    const anomalies = fuel.filter(f => f.anomaly_flag).length
    const costPerLitre = totalLitres > 0 ? totalCost / totalLitres : 0

    // By vehicle
    const byVehicle: Record<string, { cost: number, litres: number }> = {}
    fuel.forEach(f => {
      const vn = f.vehicle?.vehicle_number ?? 'Unknown'
      if (!byVehicle[vn]) byVehicle[vn] = { cost: 0, litres: 0 }
      byVehicle[vn].cost += f.amount ?? 0
      byVehicle[vn].litres += f.litres ?? 0
    })

    setFuelStats({ totalCost, totalLitres, avgEfficiency, anomalies, costPerLitre, byVehicle, entries: fuel.length })
  }

  async function loadDriverStats() {
    const { data: drivers } = await supabase.from('drivers')
      .select('id,full_name,employee_id,performance_score,duty_status,branch:branches(name)')
      .eq('status', 'active').order('performance_score', { ascending: false })

    if (!drivers) return

    // Get trip counts per driver
    const { data: trips } = await supabase.from('trips')
      .select('driver_id,status,total_distance')
      .gte('planned_start', `${dateFrom}T00:00:00`)
      .lte('planned_start', `${dateTo}T23:59:59`)
      .not('driver_id', 'is', null)

    const tripsByDriver: Record<string, { total: number, completed: number, distance: number }> = {}
    trips?.forEach(t => {
      if (!t.driver_id) return
      if (!tripsByDriver[t.driver_id]) tripsByDriver[t.driver_id] = { total: 0, completed: 0, distance: 0 }
      tripsByDriver[t.driver_id].total++
      if (t.status === 'completed') {
        tripsByDriver[t.driver_id].completed++
        tripsByDriver[t.driver_id].distance += t.total_distance ?? 0
      }
    })

    setDriverStats(drivers.map(d => ({
      ...d,
      trips: tripsByDriver[d.id]?.total ?? 0,
      completed: tripsByDriver[d.id]?.completed ?? 0,
      distance: tripsByDriver[d.id]?.distance ?? 0,
    })))
  }

  async function loadFleetStats() {
    const { data: vehicles } = await supabase.from('vehicles')
      .select('id,vehicle_number,make,model,status,current_odometer,vehicle_type')
      .is('deleted_at', null).order('vehicle_number')

    if (!vehicles) return

    // Trip counts per vehicle
    const { data: trips } = await supabase.from('trips')
      .select('vehicle_id,status,total_distance')
      .gte('planned_start', `${dateFrom}T00:00:00`)
      .lte('planned_start', `${dateTo}T23:59:59`)
      .not('vehicle_id', 'is', null)

    const tripsByVehicle: Record<string, { total: number, distance: number }> = {}
    trips?.forEach(t => {
      if (!t.vehicle_id) return
      if (!tripsByVehicle[t.vehicle_id]) tripsByVehicle[t.vehicle_id] = { total: 0, distance: 0 }
      tripsByVehicle[t.vehicle_id].total++
      tripsByVehicle[t.vehicle_id].distance += t.total_distance ?? 0
    })

    // Fuel per vehicle
    const { data: fuel } = await supabase.from('fuel_entries')
      .select('vehicle_id,amount,litres')
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`)

    const fuelByVehicle: Record<string, { cost: number, litres: number }> = {}
    fuel?.forEach(f => {
      if (!f.vehicle_id) return
      if (!fuelByVehicle[f.vehicle_id]) fuelByVehicle[f.vehicle_id] = { cost: 0, litres: 0 }
      fuelByVehicle[f.vehicle_id].cost += f.amount ?? 0
      fuelByVehicle[f.vehicle_id].litres += f.litres ?? 0
    })

    setFleetStats(vehicles.map(v => ({
      ...v,
      trips: tripsByVehicle[v.id]?.total ?? 0,
      distance: tripsByVehicle[v.id]?.distance ?? 0,
      fuelCost: fuelByVehicle[v.id]?.cost ?? 0,
      fuelLitres: fuelByVehicle[v.id]?.litres ?? 0,
      costPerKm: (tripsByVehicle[v.id]?.distance ?? 0) > 0
        ? (fuelByVehicle[v.id]?.cost ?? 0) / tripsByVehicle[v.id]!.distance
        : null,
    })))
  }

  const TABS = [
    { key: 'trips', label: '📦 Trip Report' },
    { key: 'fuel', label: '⛽ Fuel Report' },
    { key: 'drivers', label: '👤 Driver Performance' },
    { key: 'fleet', label: '🚛 Fleet Utilization' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Performance insights across fleet, drivers, trips and fuel</p>
        </div>
      </div>

      {/* Date range */}
      <div className="card mb-5">
        <div className="card-body">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="form-label">From</label>
              <input type="date" className="form-control h-9" value={dateFrom} onChange={e => setDateFrom(e.target.value)}/>
            </div>
            <div>
              <label className="form-label">To</label>
              <input type="date" className="form-control h-9" value={dateTo} onChange={e => setDateTo(e.target.value)}/>
            </div>
            {[
              { label: 'Today', fn: () => { const t = new Date().toISOString().split('T')[0]; setDateFrom(t); setDateTo(t) } },
              { label: 'This Week', fn: () => { const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1); setDateFrom(mon.toISOString().split('T')[0]); setDateTo(d.toISOString().split('T')[0]) } },
              { label: 'This Month', fn: () => { const d = new Date(); setDateFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]); setDateTo(d.toISOString().split('T')[0]) } },
              { label: 'Last Month', fn: () => { const d = new Date(); const f = new Date(d.getFullYear(), d.getMonth() - 1, 1); const t = new Date(d.getFullYear(), d.getMonth(), 0); setDateFrom(f.toISOString().split('T')[0]); setDateTo(t.toISOString().split('T')[0]) } },
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

      {/* TRIP REPORT */}
      {!loading && tab === 'trips' && tripStats && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Trips', value: tripStats.total, color: 'text-gray-800' },
              { label: 'Completed', value: tripStats.completed, color: 'text-green-600' },
              { label: 'Completion Rate', value: `${tripStats.completionRate}%`, color: tripStats.completionRate >= 80 ? 'text-green-600' : 'text-amber-600' },
              { label: 'Total Distance', value: `${tripStats.totalDistance.toLocaleString()} km`, color: 'text-blue-600' },
            ].map((s, i) => (
              <div key={i} className="card"><div className="card-body">
                <div className={`text-[28px] font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-[12px] text-gray-400">{s.label}</div>
              </div></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card">
              <div className="card-header"><span className="card-title">Trips by Branch</span></div>
              <div className="card-body space-y-3">
                {Object.entries(tripStats.byBranch).sort(([, a]: any, [, b]: any) => b - a).map(([branch, count]: any) => (
                  <div key={branch}>
                    <div className="flex justify-between text-[13px] mb-1">
                      <span className="font-medium">{branch}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div className="h-2 bg-primary-600 rounded-full" style={{ width: `${(count / tripStats.total) * 100}%` }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">Trip Status Breakdown</span></div>
              <div className="card-body space-y-3">
                {[
                  { label: 'Completed', value: tripStats.completed, color: 'bg-green-500' },
                  { label: 'Cancelled', value: tripStats.cancelled, color: 'bg-gray-400' },
                  { label: 'In Progress', value: tripStats.inProgress, color: 'bg-blue-500' },
                  { label: 'Other', value: tripStats.total - tripStats.completed - tripStats.cancelled - tripStats.inProgress, color: 'bg-amber-400' },
                ].filter(s => s.value > 0).map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between text-[13px] mb-1">
                      <span className="font-medium">{s.label}</span>
                      <span className="font-bold">{s.value}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div className={`h-2 ${s.color} rounded-full`} style={{ width: `${(s.value / tripStats.total) * 100}%` }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FUEL REPORT */}
      {!loading && tab === 'fuel' && fuelStats && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Cost', value: `AED ${fuelStats.totalCost.toLocaleString('en', { minimumFractionDigits: 2 })}`, color: 'text-primary-700' },
              { label: 'Total Litres', value: `${fuelStats.totalLitres.toFixed(1)} L`, color: 'text-blue-600' },
              { label: 'Avg Efficiency', value: fuelStats.avgEfficiency ? `${fuelStats.avgEfficiency.toFixed(1)} km/L` : '—', color: 'text-green-600' },
              { label: 'Cost per Litre', value: `AED ${fuelStats.costPerLitre.toFixed(2)}`, color: 'text-gray-700' },
            ].map((s, i) => (
              <div key={i} className="card"><div className="card-body">
                <div className={`text-[22px] font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-[12px] text-gray-400">{s.label}</div>
              </div></div>
            ))}
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Fuel Cost by Vehicle</span></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Vehicle</th><th>Total Cost (AED)</th><th>Total Litres</th><th>Cost/Litre</th></tr></thead>
                <tbody>
                  {Object.entries(fuelStats.byVehicle).sort(([, a]: any, [, b]: any) => b.cost - a.cost).map(([vn, data]: any) => (
                    <tr key={vn}>
                      <td className="font-semibold">{vn}</td>
                      <td className="font-bold text-primary-700">AED {data.cost.toFixed(2)}</td>
                      <td>{data.litres.toFixed(1)} L</td>
                      <td>{data.litres > 0 ? `AED ${(data.cost / data.litres).toFixed(2)}` : '—'}</td>
                    </tr>
                  ))}
                  {Object.keys(fuelStats.byVehicle).length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-400">No fuel entries in this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DRIVER PERFORMANCE */}
      {!loading && tab === 'drivers' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Driver Performance</span></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Driver</th><th>Branch</th><th>Trips</th><th>Completed</th><th>Completion %</th><th>Distance</th><th>Score</th></tr></thead>
              <tbody>
                {driverStats.length === 0
                  ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">No drivers found</td></tr>
                  : driverStats.map(d => (
                    <tr key={d.id}>
                      <td><div className="font-semibold text-[13px]">{d.full_name}</div><div className="text-[11px] text-gray-400">{d.employee_id}</div></td>
                      <td className="text-[12px]">{d.branch?.name ?? '—'}</td>
                      <td className="font-bold">{d.trips}</td>
                      <td className="text-green-600 font-semibold">{d.completed}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-gray-100 rounded-full">
                            <div className="h-1.5 bg-green-500 rounded-full" style={{ width: `${d.trips > 0 ? (d.completed / d.trips) * 100 : 0}%` }}/>
                          </div>
                          <span className="text-[12px]">{d.trips > 0 ? Math.round((d.completed / d.trips) * 100) : 0}%</span>
                        </div>
                      </td>
                      <td className="text-[13px]">{d.distance > 0 ? `${d.distance.toLocaleString()} km` : '—'}</td>
                      <td>
                        <span className={`font-bold text-[14px] ${d.performance_score >= 90 ? 'text-green-600' : d.performance_score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                          {d.performance_score?.toFixed(0) ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FLEET UTILIZATION */}
      {!loading && tab === 'fleet' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Fleet Utilization</span></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Vehicle</th><th>Type</th><th>Status</th><th>Trips</th><th>Distance</th><th>Fuel Cost</th><th>Cost/km</th></tr></thead>
              <tbody>
                {fleetStats.length === 0
                  ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">No vehicles found</td></tr>
                  : fleetStats.map(v => (
                    <tr key={v.id}>
                      <td><div className="font-semibold text-[13px]">{v.vehicle_number}</div><div className="text-[11px] text-gray-400">{v.make} {v.model}</div></td>
                      <td className="text-[12px] capitalize">{v.vehicle_type ?? '—'}</td>
                      <td><span className={`badge text-[11px] ${v.status === 'available' ? 'bg-green-100 text-green-700' : v.status === 'assigned' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{v.status}</span></td>
                      <td className="font-bold">{v.trips}</td>
                      <td className="text-[13px]">{v.distance > 0 ? `${v.distance.toLocaleString()} km` : '—'}</td>
                      <td className="text-[13px]">{v.fuelCost > 0 ? `AED ${v.fuelCost.toFixed(0)}` : '—'}</td>
                      <td className="text-[13px]">{v.costPerKm ? `AED ${v.costPerKm.toFixed(2)}` : '—'}</td>
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
