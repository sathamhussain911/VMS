'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, expiryStatus, expiryLabel, expiryStatusColour, tripStatusColour } from '@/lib/utils'

export default function DashboardPage() {
  const supabase = createClient()
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [trips, setTrips] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)

    // All queries in parallel — biggest speed win
    const [vRes, dRes, tRes, actRes] = await Promise.all([
      supabase.from('vehicles')
        .select('id,status,mulkiya_expiry,insurance_expiry,next_service_date')
        .is('deleted_at', null),
      supabase.from('drivers')
        .select('id,status,performance_score,duty_status')
        .eq('status', 'active'),
      supabase.from('trips')
        .select('id,trip_number,status,planned_start,branch:branches(name),vehicle:vehicles(vehicle_number),driver:drivers(full_name)')
        .gte('planned_start', `${today}T00:00:00`)
        .lte('planned_start', `${today}T23:59:59`)
        .is('deleted_at', null)
        .order('planned_start'),
      supabase.from('trips')
        .select('id,trip_number,status,planned_start,driver:drivers(full_name),vehicle:vehicles(vehicle_number)')
        .gte('planned_start', weekAgo.toISOString())
        .order('planned_start', { ascending: false })
        .limit(5),
    ])

    setVehicles(vRes.data ?? [])
    setDrivers(dRes.data ?? [])
    setTrips(tRes.data ?? [])
    setRecentActivity(actRes.data ?? [])
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(load, 120000)
    return () => clearInterval(interval)
  }, [load])

  // Computed metrics
  const active = vehicles.filter(v => v.status !== 'inactive')
  const available = vehicles.filter(v => v.status === 'available')
  const maintenance = vehicles.filter(v => v.status === 'maintenance')
  const fleetAvail = active.length > 0 ? Math.round((available.length / active.length) * 100) : 0
  const onDuty = drivers.filter(d => d.duty_status === 'on_duty' || d.duty_status === 'on_trip')
  const avgScore = drivers.length > 0
    ? Math.round(drivers.filter(d => d.performance_score != null).reduce((a, d) => a + d.performance_score, 0) / drivers.length)
    : 0
  const completed = trips.filter(t => t.status === 'completed')
  const inProgress = trips.filter(t => t.status === 'in_progress')
  const now = new Date()
  const in30 = new Date(); in30.setDate(now.getDate() + 30)
  const docAlerts = vehicles.filter(v =>
    (v.mulkiya_expiry && new Date(v.mulkiya_expiry) < in30) ||
    (v.insurance_expiry && new Date(v.insurance_expiry) < in30)
  )
  const expiredDocs = vehicles.filter(v =>
    (v.mulkiya_expiry && new Date(v.mulkiya_expiry) < now) ||
    (v.insurance_expiry && new Date(v.insurance_expiry) < now)
  )
  const serviceDue = vehicles.filter(v => v.next_service_date && new Date(v.next_service_date) <= in30)

  const METRICS = [
    {
      label: 'Total Vehicles', value: vehicles.length,
      sub: `${available.length} available · ${maintenance.length} maintenance`,
      colour: 'green', icon: '🚛',
      href: '/fleet/vehicles',
    },
    {
      label: 'Fleet Availability', value: `${fleetAvail}%`,
      sub: fleetAvail >= 85 ? '✓ Above target' : '⚠ Below 85% target',
      colour: fleetAvail >= 85 ? 'green' : 'red', icon: '📊',
      bar: fleetAvail,
    },
    {
      label: "Today's Trips", value: trips.length,
      sub: `${completed.length} done · ${inProgress.length} active`,
      colour: 'blue', icon: '📦',
      href: '/operations/trips',
    },
    {
      label: 'Active Drivers', value: drivers.length,
      sub: `${onDuty.length} on duty · Score: ${avgScore}`,
      colour: 'amber', icon: '👤',
      href: '/fleet/drivers',
    },
    {
      label: 'Doc Alerts', value: docAlerts.length,
      sub: expiredDocs.length > 0 ? `${expiredDocs.length} expired!` : '≤ 30 days',
      colour: expiredDocs.length > 0 ? 'red' : docAlerts.length > 0 ? 'amber' : 'green', icon: '📄',
      href: '/compliance/documents',
    },
    {
      label: 'Service Due', value: serviceDue.length,
      sub: serviceDue.length > 0 ? 'Needs scheduling' : 'All up to date',
      colour: serviceDue.length > 0 ? 'amber' : 'green', icon: '🔧',
      href: '/fleet/maintenance',
    },
  ]

  const STATUS_COLOUR: Record<string, string> = {
    requested: 'bg-gray-100 text-gray-600',
    approved: 'bg-purple-100 text-purple-700',
    assigned: 'bg-sky-100 text-sky-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
    delayed: 'bg-amber-100 text-amber-700',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Operations Dashboard</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            <span className="text-gray-300 mx-2">·</span>
            <span className="text-[12px] text-gray-400">Updated {lastRefresh.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn btn-secondary btn-sm">↻ Refresh</button>
          <Link href="/operations/trips/new" className="btn btn-primary">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 4v16m8-8H4"/></svg>
            New Trip
          </Link>
        </div>
      </div>

      {/* Critical alerts */}
      {!loading && expiredDocs.length > 0 && (
        <div className="alert alert-red mb-4">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <p className="text-[13px] text-red-700">
            <strong>{expiredDocs.length} document{expiredDocs.length > 1 ? 's' : ''} EXPIRED.</strong>{' '}
            Vehicles may not be legally operable.{' '}
            <Link href="/compliance/documents" className="underline font-bold">Review now →</Link>
          </p>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {METRICS.map((m, i) => {
          const card = (
            <div key={i} className={`metric-card ${m.colour} ${m.href ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="metric-label">{m.label}</span>
                <span className="text-[18px]">{m.icon}</span>
              </div>
              <span className="metric-value">{loading ? '…' : m.value}</span>
              {m.bar !== undefined && (
                <div className="progress-bar my-1.5">
                  <div className={`progress-fill ${m.bar >= 85 ? 'bg-primary-500' : m.bar >= 70 ? 'bg-amber-400' : 'bg-red-500'}`}
                    style={{ width: `${m.bar}%`, transition: 'width 0.8s ease' }}/>
                </div>
              )}
              <p className="text-[11.5px] text-gray-400 mt-1">{m.sub}</p>
            </div>
          )
          return m.href ? <Link key={i} href={m.href}>{card}</Link> : card
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 mb-5">
        {/* Today's trips */}
        <div className="xl:col-span-3 card">
          <div className="card-header">
            <span className="card-title">Today's Trip Activity</span>
            <Link href="/operations/trips" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          <div className="overflow-x-auto">
            {loading
              ? <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary-700/20 border-t-primary-700 rounded-full animate-spin mx-auto"/></div>
              : trips.length === 0
                ? <div className="p-10 text-center text-gray-400 text-sm">
                    <div className="text-3xl mb-2">📋</div>No trips scheduled for today
                  </div>
                : (
                  <table className="data-table">
                    <thead>
                      <tr><th>Trip #</th><th>Vehicle</th><th>Driver</th><th>Branch</th><th>Time</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {trips.map((t: any) => (
                        <tr key={t.id}>
                          <td>
                            <Link href={`/operations/trips/detail?id=${t.id}`}
                              className="font-mono text-[12px] bg-gray-100 px-1.5 py-0.5 rounded hover:bg-primary-100 hover:text-primary-700 transition-colors">
                              {t.trip_number}
                            </Link>
                          </td>
                          <td className="text-[13px]">{t.vehicle?.vehicle_number ?? <span className="text-gray-300">—</span>}</td>
                          <td className="text-[13px]">{t.driver?.full_name ?? <span className="text-amber-600 font-medium">Unassigned</span>}</td>
                          <td className="text-[12px] text-gray-500">{t.branch?.name ?? '—'}</td>
                          <td className="font-mono text-[12px] text-gray-500">{formatDate(t.planned_start, 'HH:mm')}</td>
                          <td><span className={`badge ${STATUS_COLOUR[t.status] ?? 'bg-gray-100 text-gray-500'}`}>{t.status.replace('_', ' ')}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
          </div>
        </div>

        {/* Doc expiry monitor */}
        <div className="xl:col-span-2 card">
          <div className="card-header">
            <span className="card-title">Document Expiry Monitor</span>
            <Link href="/compliance/documents" className="btn btn-ghost btn-sm">Manage →</Link>
          </div>
          <div className="card-body space-y-2.5 pt-3">
            {!loading && docAlerts.slice(0, 6).map((v: any) => {
              const mSt = expiryStatus(v.mulkiya_expiry)
              const iSt = expiryStatus(v.insurance_expiry)
              const worst = ['expired', 'critical', 'warning'].find(s => s === mSt || s === iSt)
              if (!worst) return null
              return (
                <div key={v.id} className={`rounded-lg p-3 border text-sm ${worst === 'expired' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`badge text-[10px] ${expiryStatusColour[worst]}`}>{worst.toUpperCase()}</span>
                    <span className="text-[11px] text-gray-500">Mulkiya: {expiryLabel(v.mulkiya_expiry)}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">Insurance: {expiryLabel(v.insurance_expiry)}</div>
                </div>
              )
            })}
            {!loading && docAlerts.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                <div className="text-3xl mb-2">✅</div>All documents valid
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick nav + activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Quick nav */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-3">
          {[
            { label: 'Vehicles', icon: '🚛', href: '/fleet/vehicles', count: vehicles.length, colour: 'green' },
            { label: 'Drivers', icon: '👤', href: '/fleet/drivers', count: drivers.length, colour: 'blue' },
            { label: 'Dispatch Board', icon: '📅', href: '/operations/dispatch', count: null, colour: 'purple' },
            { label: 'Approvals', icon: '✅', href: '/approvals', count: null, colour: 'amber' },
          ].map((item, i) => (
            <Link key={i} href={item.href}>
              <div className="card p-4 hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="font-bold text-[14px] text-gray-900">{item.label}</div>
                {item.count != null && (
                  <div className="text-[22px] font-extrabold text-primary-700">{loading ? '…' : item.count}</div>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Recent activity */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Activity</span>
            <span className="text-[11px] text-gray-400">Last 7 days</span>
          </div>
          <div className="divide-y divide-gray-50">
            {loading
              ? <div className="p-6 text-center"><div className="w-5 h-5 border-2 border-primary-700/20 border-t-primary-700 rounded-full animate-spin mx-auto"/></div>
              : recentActivity.length === 0
                ? <div className="p-6 text-center text-gray-400 text-[13px]">No recent activity</div>
                : recentActivity.map(t => (
                  <Link key={t.id} href={`/operations/trips/detail?id=${t.id}`}>
                    <div className="px-5 py-3 hover:bg-gray-50 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[12px] text-gray-600">{t.trip_number}</div>
                        <div className="text-[12px] text-gray-400 mt-0.5">
                          {t.driver?.full_name ?? 'Unassigned'} · {t.vehicle?.vehicle_number ?? '—'}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`badge text-[10px] ${STATUS_COLOUR[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                        <div className="text-[11px] text-gray-400 mt-1">{formatDate(t.planned_start, 'dd MMM')}</div>
                      </div>
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      </div>
    </div>
  )
}
