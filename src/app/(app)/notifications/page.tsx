'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, expiryStatus } from '@/lib/utils'

export default function NotificationsPage() {
  const supabase = createClient()
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAlerts() }, [])

  async function loadAlerts() {
    setLoading(true)
    const now = new Date()
    const in30 = new Date(); in30.setDate(now.getDate() + 30)
    const in60 = new Date(); in60.setDate(now.getDate() + 60)

    const [{ data: vehicles }, { data: drivers }, { data: openBreakdowns }, { data: pendingTrips }, { data: maintenance }] = await Promise.all([
      supabase.from('vehicles').select('id,vehicle_number,mulkiya_expiry,insurance_expiry,gps_contract_expiry,next_service_date').is('deleted_at', null),
      supabase.from('drivers').select('id,full_name,eid_expiry,license_expiry,passport_expiry').eq('status', 'active'),
      supabase.from('breakdown_reports').select('id,vehicle:vehicles(vehicle_number),severity,reported_at').eq('status', 'reported'),
      supabase.from('trips').select('id,trip_number,planned_start,branch:branches(name)').eq('status', 'requested').order('planned_start'),
      supabase.from('maintenance_records').select('id,title,vehicle:vehicles(vehicle_number),next_service_date').not('next_service_date', 'is', null).lte('next_service_date', in30.toISOString().split('T')[0]),
    ])

    const newAlerts: any[] = []

    // Document expiry alerts
    vehicles?.forEach(v => {
      ;[
        { type: 'Mulkiya', expiry: v.mulkiya_expiry },
        { type: 'Insurance', expiry: v.insurance_expiry },
        { type: 'GPS Contract', expiry: v.gps_contract_expiry },
      ].forEach(doc => {
        const s = expiryStatus(doc.expiry)
        if (s === 'expired' || s === 'critical') {
          newAlerts.push({
            id: `${v.id}-${doc.type}`,
            type: s === 'expired' ? 'danger' : 'warning',
            category: 'document',
            title: `${doc.type} ${s === 'expired' ? 'Expired' : 'Expiring Soon'}`,
            message: `${v.vehicle_number} — ${doc.type} ${s === 'expired' ? 'has expired' : `expires ${formatDate(doc.expiry)}`}`,
            time: doc.expiry,
            link: `/fleet/vehicles/detail?id=${v.id}`,
          })
        }
      })
      // Service due
      if (v.next_service_date) {
        const days = Math.ceil((new Date(v.next_service_date).getTime() - now.getTime()) / 86400000)
        if (days <= 14) {
          newAlerts.push({
            id: `svc-${v.id}`,
            type: days < 0 ? 'danger' : 'warning',
            category: 'maintenance',
            title: `Service ${days < 0 ? 'Overdue' : 'Due Soon'}`,
            message: `${v.vehicle_number} — service due ${formatDate(v.next_service_date)}`,
            time: v.next_service_date,
            link: `/fleet/maintenance`,
          })
        }
      }
    })

    drivers?.forEach(d => {
      ;[
        { type: 'Emirates ID', expiry: d.eid_expiry },
        { type: 'Driving License', expiry: d.license_expiry },
        { type: 'Passport', expiry: d.passport_expiry },
      ].forEach(doc => {
        const s = expiryStatus(doc.expiry)
        if (s === 'expired' || s === 'critical') {
          newAlerts.push({
            id: `${d.id}-${doc.type}`,
            type: s === 'expired' ? 'danger' : 'warning',
            category: 'document',
            title: `Driver ${doc.type} ${s === 'expired' ? 'Expired' : 'Expiring'}`,
            message: `${d.full_name} — ${doc.type} ${s === 'expired' ? 'expired' : `expires ${formatDate(doc.expiry)}`}`,
            time: doc.expiry,
            link: `/fleet/drivers/detail?id=${d.id}`,
          })
        }
      })
    })

    // Breakdown alerts
    openBreakdowns?.forEach(b => {
      newAlerts.push({
        id: `bd-${b.id}`,
        type: b.severity === 'critical' ? 'danger' : 'warning',
        category: 'breakdown',
        title: `${b.severity === 'critical' ? 'Critical' : ''} Breakdown Reported`,
        message: `${b.vehicle?.vehicle_number} — breakdown reported ${formatDate(b.reported_at, 'HH:mm dd MMM')}`,
        time: b.reported_at,
        link: `/fleet/maintenance`,
      })
    })

    // Pending trip requests
    pendingTrips?.forEach(t => {
      newAlerts.push({
        id: `trip-${t.id}`,
        type: 'info',
        category: 'trip',
        title: 'Trip Awaiting Approval',
        message: `${t.trip_number} — ${t.branch?.name} — planned ${formatDate(t.planned_start, 'HH:mm dd MMM')}`,
        time: t.planned_start,
        link: `/operations/trips/detail?id=${t.id}`,
      })
    })

    // Sort by severity
    const severityOrder = { danger: 0, warning: 1, info: 2 }
    newAlerts.sort((a, b) => (severityOrder[a.type as keyof typeof severityOrder] ?? 2) - (severityOrder[b.type as keyof typeof severityOrder] ?? 2))
    setAlerts(newAlerts)
    setLoading(false)
  }

  const TYPE_STYLE: Record<string, { bg: string, border: string, icon: string, badge: string }> = {
    danger: { bg: 'bg-red-50', border: 'border-red-200', icon: '🔴', badge: 'bg-red-100 text-red-700' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: '🟠', badge: 'bg-amber-100 text-amber-700' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: '🔵', badge: 'bg-blue-100 text-blue-700' },
  }

  const CATEGORY_LABEL: Record<string, string> = {
    document: 'Document', maintenance: 'Maintenance', breakdown: 'Breakdown', trip: 'Trip',
  }

  const danger = alerts.filter(a => a.type === 'danger').length
  const warning = alerts.filter(a => a.type === 'warning').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications & Alerts</h1>
          <p className="page-subtitle">System-wide alerts requiring your attention</p>
        </div>
        <button onClick={loadAlerts} className="btn btn-secondary">↻ Refresh</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card border-red-200 bg-red-50"><div className="card-body">
          <div className="text-[28px] font-extrabold text-red-600">{danger}</div>
          <div className="text-[12px] text-red-500">Critical Alerts</div>
        </div></div>
        <div className="card border-amber-200 bg-amber-50"><div className="card-body">
          <div className="text-[28px] font-extrabold text-amber-600">{warning}</div>
          <div className="text-[12px] text-amber-500">Warnings</div>
        </div></div>
        <div className="card"><div className="card-body">
          <div className="text-[28px] font-extrabold text-gray-700">{alerts.length}</div>
          <div className="text-[12px] text-gray-400">Total Alerts</div>
        </div></div>
      </div>

      {loading && <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/></div>}

      {!loading && alerts.length === 0 && (
        <div className="card">
          <div className="card-body text-center py-16">
            <div className="text-5xl mb-4">✅</div>
            <div className="font-bold text-[18px] text-gray-700">All Clear!</div>
            <div className="text-gray-400 text-[13px] mt-1">No alerts or notifications at this time</div>
          </div>
        </div>
      )}

      {!loading && alerts.length > 0 && (
        <div className="space-y-2.5">
          {alerts.map(alert => {
            const style = TYPE_STYLE[alert.type]
            return (
              <div key={alert.id} className={`rounded-xl border p-4 ${style.bg} ${style.border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{style.icon}</span>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-[14px] text-gray-800">{alert.title}</span>
                        <span className={`badge text-[10px] ${style.badge}`}>{CATEGORY_LABEL[alert.category]}</span>
                      </div>
                      <div className="text-[13px] text-gray-600">{alert.message}</div>
                    </div>
                  </div>
                  {alert.link && (
                    <a href={alert.link} className="btn btn-secondary btn-sm text-[12px] flex-shrink-0">
                      View →
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
