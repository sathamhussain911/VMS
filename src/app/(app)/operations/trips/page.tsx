'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, tripStatusColour, priorityColour } from '@/lib/utils'

export default function TripsPage() {
  const supabase = createClient()
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => { loadTrips() }, [date])

  async function loadTrips() {
    setLoading(true)
    let query = supabase.from('trips')
      .select('id,trip_number,status,priority,planned_start,planned_end,branch:branches(name),vehicle:vehicles(vehicle_number),driver:drivers(full_name)')
      .is('deleted_at', null)
      .order('planned_start', { ascending: false })

    // Only filter by date if one is selected
    if (date) {
      query = query
        .gte('planned_start', `${date}T00:00:00`)
        .lte('planned_start', `${date}T23:59:59`)
    }

    const { data } = await query
    setTrips(data ?? [])
    setLoading(false)
  }

  const filtered = statusFilter ? trips.filter(t => t.status === statusFilter) : trips
  const statusCounts = trips.reduce((acc: any, t: any) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc }, {})

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Trips & Delivery</h1>
          <p className="page-subtitle">Full lifecycle — Requested → Assigned → In Progress → Completed</p>
        </div>
        <Link href="/operations/trips/new" className="btn btn-primary">+ New Trip Request</Link>
      </div>

      {/* Status filter badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(statusCounts).map(([s, c]: any) => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`badge cursor-pointer ${tripStatusColour[s]} ${statusFilter === s ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}>
            {s.replace('_', ' ')} ({c})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="form-control h-9 w-auto" placeholder="Filter by date"/>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-control h-9 w-auto">
          <option value="">All Statuses</option>
          {['requested', 'approved', 'assigned', 'in_progress', 'completed', 'delayed', 'cancelled'].map(s =>
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          )}
        </select>
        <button onClick={() => { setStatusFilter(''); setDate(''); }} className="btn btn-secondary btn-sm">
          Show All
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Trip #</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Branch</th>
                <th>Planned Start</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading trips…</td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">No trips found</td></tr>
                  : filtered.map((t: any) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/operations/trips/detail?id=${t.id}`}
                          className="font-mono text-[12px] bg-gray-100 px-1.5 py-0.5 rounded hover:bg-gray-200">
                          {t.trip_number}
                        </Link>
                      </td>
                      <td className="text-[13px]">{t.vehicle?.vehicle_number ?? <span className="text-gray-400">—</span>}</td>
                      <td className="text-[13px]">{t.driver?.full_name ?? <span className="text-gray-400">—</span>}</td>
                      <td className="text-[13px]">{t.branch?.name ?? '—'}</td>
                      <td>
                        <div className="text-[12.5px]">{formatDate(t.planned_start, 'HH:mm')}</div>
                        <div className="text-[11px] text-gray-400">{formatDate(t.planned_start, 'dd MMM')}</div>
                      </td>
                      <td><span className={`badge ${priorityColour[t.priority]}`}>{t.priority}</span></td>
                      <td><span className={`badge ${tripStatusColour[t.status]}`}>{t.status.replace('_', ' ')}</span></td>
                      <td className="flex gap-1.5">
                        <Link href={`/operations/trips/detail?id=${t.id}`} className="btn btn-secondary btn-sm">View</Link>
                        {['requested', 'approved'].includes(t.status) &&
                          <Link href={`/operations/trips/detail/assign?id=${t.id}`} className="btn btn-primary btn-sm">Assign</Link>
                        }
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
