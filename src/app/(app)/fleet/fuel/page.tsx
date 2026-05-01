'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export default function FuelManagementPage() {
  const supabase = createClient()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ vehicle: '', driver: '', from: '', to: '' })
  const [stats, setStats] = useState({ total_cost: 0, total_litres: 0, avg_efficiency: 0, entries_count: 0 })

  useEffect(() => { loadEntries() }, [])

  async function loadEntries() {
    setLoading(true)
    let query = supabase.from('fuel_entries')
      .select(`
        id, fuel_type, litres, amount, odometer, station_name,
        efficiency_kmpl, anomaly_flag, anomaly_reason, created_at, notes,
        vehicle:vehicles(vehicle_number, make, model),
        driver:drivers(full_name, employee_id)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (filter.vehicle) query = query.ilike('vehicles.vehicle_number', `%${filter.vehicle}%`)
    if (filter.from) query = query.gte('created_at', `${filter.from}T00:00:00`)
    if (filter.to) query = query.lte('created_at', `${filter.to}T23:59:59`)

    const { data } = await query
    const list = data ?? []
    setEntries(list)

    // Calculate stats
    const total_cost = list.reduce((s, e) => s + (e.amount ?? 0), 0)
    const total_litres = list.reduce((s, e) => s + (e.litres ?? 0), 0)
    const efficiencies = list.filter(e => e.efficiency_kmpl).map(e => e.efficiency_kmpl)
    const avg_efficiency = efficiencies.length ? efficiencies.reduce((s, e) => s + e, 0) / efficiencies.length : 0
    setStats({ total_cost, total_litres, avg_efficiency, entries_count: list.length })
    setLoading(false)
  }

  const anomalies = entries.filter(e => e.anomaly_flag)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fuel Management</h1>
          <p className="page-subtitle">Track fuel consumption, costs and efficiency across the fleet</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Cost', value: `AED ${stats.total_cost.toLocaleString('en', { minimumFractionDigits: 2 })}`, color: 'text-primary-700', icon: '💰' },
          { label: 'Total Litres', value: `${stats.total_litres.toLocaleString('en', { minimumFractionDigits: 1 })} L`, color: 'text-blue-700', icon: '⛽' },
          { label: 'Avg Efficiency', value: stats.avg_efficiency ? `${stats.avg_efficiency.toFixed(1)} km/L` : '—', color: 'text-green-700', icon: '📊' },
          { label: 'Anomalies', value: anomalies.length.toString(), color: anomalies.length > 0 ? 'text-red-700' : 'text-gray-400', icon: '⚠️' },
        ].map((s, i) => (
          <div key={i} className="card">
            <div className="card-body">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`text-[22px] font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-[12px] text-gray-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Anomaly alert */}
      {anomalies.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <div className="text-2xl">⚠️</div>
          <div>
            <div className="font-bold text-red-700 text-[14px]">{anomalies.length} Fuel Anomaly{anomalies.length > 1 ? 'ies' : ''} Detected</div>
            <div className="text-[13px] text-red-600 mt-1">
              {anomalies.slice(0, 3).map(a => (
                <div key={a.id}>• {a.vehicle?.vehicle_number} — {a.anomaly_reason}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-5">
        <div className="card-body">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <input className="form-control" placeholder="Vehicle number"
              value={filter.vehicle} onChange={e => setFilter(p => ({ ...p, vehicle: e.target.value }))} />
            <input className="form-control" placeholder="Driver name"
              value={filter.driver} onChange={e => setFilter(p => ({ ...p, driver: e.target.value }))} />
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">From</label>
              <input type="date" className="form-control"
                value={filter.from} onChange={e => setFilter(p => ({ ...p, from: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">To</label>
              <input type="date" className="form-control"
                value={filter.to} onChange={e => setFilter(p => ({ ...p, to: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={loadEntries} className="btn btn-primary btn-sm">Apply Filters</button>
            <button onClick={() => { setFilter({ vehicle: '', driver: '', from: '', to: '' }); loadEntries() }} className="btn btn-secondary btn-sm">Reset</button>
          </div>
        </div>
      </div>

      {/* Fuel entries table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Fuel Entries</span>
          <span className="text-[12px] text-gray-400">{entries.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Fuel Type</th>
                <th>Litres</th>
                <th>Amount (AED)</th>
                <th>Odometer</th>
                <th>Efficiency</th>
                <th>Station</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={10} className="text-center py-10 text-gray-400">Loading…</td></tr>
                : entries.length === 0
                  ? <tr><td colSpan={10} className="text-center py-10 text-gray-400">No fuel entries found</td></tr>
                  : entries.map(e => (
                    <tr key={e.id} className={e.anomaly_flag ? 'bg-red-50' : ''}>
                      <td className="text-[12px]">{formatDate(e.created_at, 'dd MMM yyyy')}</td>
                      <td className="font-semibold text-[13px]">{e.vehicle?.vehicle_number ?? '—'}</td>
                      <td className="text-[13px]">{e.driver?.full_name ?? '—'}</td>
                      <td><span className="badge bg-blue-100 text-blue-700 text-[11px]">{e.fuel_type}</span></td>
                      <td className="text-[13px]">{e.litres?.toFixed(1)} L</td>
                      <td className="font-semibold text-[13px]">AED {e.amount?.toFixed(2)}</td>
                      <td className="text-[12px] font-mono">{e.odometer?.toLocaleString()} km</td>
                      <td className="text-[13px]">
                        {e.efficiency_kmpl
                          ? <span className={`font-semibold ${e.efficiency_kmpl < 5 ? 'text-red-600' : e.efficiency_kmpl > 10 ? 'text-green-600' : 'text-gray-700'}`}>
                            {e.efficiency_kmpl.toFixed(1)} km/L
                          </span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="text-[12px]">{e.station_name ?? '—'}</td>
                      <td>
                        {e.anomaly_flag
                          ? <span className="badge bg-red-100 text-red-700 text-[11px]" title={e.anomaly_reason}>⚠ Anomaly</span>
                          : <span className="badge bg-green-100 text-green-700 text-[11px]">✓ Normal</span>}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
