'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, expiryStatus, expiryLabel, expiryStatusColour } from '@/lib/utils'

export default function DocumentsPage() {
  const supabase = createClient()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'expired' | 'critical' | 'warning' | 'ok'>('all')
  const [entityFilter, setEntityFilter] = useState<'all' | 'vehicle' | 'driver'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => { loadDocs() }, [])

  async function loadDocs() {
    setLoading(true)
    const [{ data: vehicles }, { data: drivers }] = await Promise.all([
      supabase.from('vehicles')
        .select('id,vehicle_number,mulkiya_expiry,insurance_expiry,gps_contract_expiry,mulkiya_number,insurance_policy')
        .is('deleted_at', null).neq('status', 'inactive').order('vehicle_number'),
      supabase.from('drivers')
        .select('id,full_name,employee_id,eid_expiry,license_expiry,passport_expiry')
        .eq('status', 'active').order('full_name'),
    ])

    const all = [
      ...(vehicles ?? []).flatMap((v: any) => [
        { id: `${v.id}-m`, entity: v.vehicle_number, entityType: 'vehicle', docType: 'Mulkiya', docNumber: v.mulkiya_number, expiry: v.mulkiya_expiry, status: expiryStatus(v.mulkiya_expiry), href: `/fleet/vehicles/detail?id=${v.id}` },
        { id: `${v.id}-i`, entity: v.vehicle_number, entityType: 'vehicle', docType: 'Insurance', docNumber: v.insurance_policy, expiry: v.insurance_expiry, status: expiryStatus(v.insurance_expiry), href: `/fleet/vehicles/detail?id=${v.id}` },
        ...(v.gps_contract_expiry ? [{ id: `${v.id}-g`, entity: v.vehicle_number, entityType: 'vehicle', docType: 'GPS Contract', docNumber: null, expiry: v.gps_contract_expiry, status: expiryStatus(v.gps_contract_expiry), href: `/fleet/vehicles/detail?id=${v.id}` }] : []),
      ]),
      ...(drivers ?? []).flatMap((d: any) => [
        { id: `${d.id}-e`, entity: d.full_name, entityType: 'driver', docType: 'Emirates ID', docNumber: d.employee_id, expiry: d.eid_expiry, status: expiryStatus(d.eid_expiry), href: `/fleet/drivers/detail?id=${d.id}` },
        { id: `${d.id}-l`, entity: d.full_name, entityType: 'driver', docType: 'Driving License', docNumber: null, expiry: d.license_expiry, status: expiryStatus(d.license_expiry), href: `/fleet/drivers/detail?id=${d.id}` },
        ...(d.passport_expiry ? [{ id: `${d.id}-p`, entity: d.full_name, entityType: 'driver', docType: 'Passport', docNumber: null, expiry: d.passport_expiry, status: expiryStatus(d.passport_expiry), href: `/fleet/drivers/detail?id=${d.id}` }] : []),
      ]),
    ]

    // Sort: expired first, then critical, warning, ok, unknown
    const order = { expired: 0, critical: 1, warning: 2, ok: 3, unknown: 4 }
    all.sort((a, b) => (order[a.status as keyof typeof order] ?? 4) - (order[b.status as keyof typeof order] ?? 4))
    setDocs(all)
    setLoading(false)
  }

  const counts = {
    all: docs.length,
    expired: docs.filter(d => d.status === 'expired').length,
    critical: docs.filter(d => d.status === 'critical').length,
    warning: docs.filter(d => d.status === 'warning').length,
    ok: docs.filter(d => d.status === 'ok').length,
  }

  const filtered = docs.filter(d => {
    if (filter !== 'all' && d.status !== filter) return false
    if (entityFilter !== 'all' && d.entityType !== entityFilter) return false
    if (search && !d.entity.toLowerCase().includes(search.toLowerCase()) && !d.docType.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const FILTER_TABS = [
    { key: 'all', label: 'All', count: counts.all, color: 'bg-gray-100 text-gray-700' },
    { key: 'expired', label: 'Expired', count: counts.expired, color: 'bg-red-100 text-red-700' },
    { key: 'critical', label: 'Critical (≤30d)', count: counts.critical, color: 'bg-amber-100 text-amber-700' },
    { key: 'warning', label: 'Warning (≤60d)', count: counts.warning, color: 'bg-yellow-100 text-yellow-700' },
    { key: 'ok', label: 'Valid', count: counts.ok, color: 'bg-green-100 text-green-700' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Documents & Expiry</h1>
          <p className="page-subtitle">Track all vehicle and driver document expiries</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Expired', count: counts.expired, color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: '🔴' },
          { label: 'Critical ≤30d', count: counts.critical, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: '🟠' },
          { label: 'Warning ≤60d', count: counts.warning, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', icon: '🟡' },
          { label: 'Valid', count: counts.ok, color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: '🟢' },
        ].map((s, i) => (
          <div key={i} className={`card border ${s.bg}`}>
            <div className="card-body">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`text-[28px] font-extrabold ${s.color}`}>{s.count}</div>
              <div className="text-[12px] text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts for expired/critical */}
      {(counts.expired > 0 || counts.critical > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
          <div className="font-bold text-red-700 text-[14px] mb-2">⚠️ Action Required</div>
          {docs.filter(d => d.status === 'expired' || d.status === 'critical').slice(0, 5).map(d => (
            <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-red-100 last:border-0">
              <div>
                <span className="font-semibold text-[13px] text-red-800">{d.entity}</span>
                <span className="text-[12px] text-red-600 ml-2">— {d.docType}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-red-600">{d.expiry ? formatDate(d.expiry) : 'No date'}</span>
                <Link href={d.href} className="btn btn-secondary btn-sm text-[11px]">Update →</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTER_TABS.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key as any)}
            className={`badge cursor-pointer text-[12px] px-3 py-1 ${filter === tab.key ? tab.color + ' ring-2 ring-offset-1 ring-gray-400' : 'bg-gray-100 text-gray-500'}`}>
            {tab.label} ({tab.count})
          </button>
        ))}
        <div className="flex gap-2 ml-2">
          <button onClick={() => setEntityFilter('all')} className={`badge cursor-pointer text-[12px] ${entityFilter === 'all' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>All</button>
          <button onClick={() => setEntityFilter('vehicle')} className={`badge cursor-pointer text-[12px] ${entityFilter === 'vehicle' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>🚛 Vehicles</button>
          <button onClick={() => setEntityFilter('driver')} className={`badge cursor-pointer text-[12px] ${entityFilter === 'driver' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>👤 Drivers</button>
        </div>
        <input className="form-control h-8 w-48 text-[12px]" placeholder="Search…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Documents table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Document Registry</span>
          <span className="text-[12px] text-gray-400">{filtered.length} documents</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Entity</th><th>Type</th><th>Document</th><th>Doc Number</th><th>Expiry Date</th><th>Days Left</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading…</td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">No documents match filter</td></tr>
                  : filtered.map(doc => {
                    const daysLeft = doc.expiry
                      ? Math.ceil((new Date(doc.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      : null
                    return (
                      <tr key={doc.id} className={doc.status === 'expired' ? 'bg-red-50' : doc.status === 'critical' ? 'bg-amber-50' : ''}>
                        <td>
                          <div className="font-semibold text-[13px]">{doc.entity}</div>
                          <div className="text-[11px] text-gray-400 capitalize">{doc.entityType}</div>
                        </td>
                        <td className="text-[13px]">{doc.docType}</td>
                        <td className="text-[12px] text-gray-500">{doc.docType}</td>
                        <td className="text-[12px] font-mono">{doc.docNumber ?? '—'}</td>
                        <td className="text-[13px]">{doc.expiry ? formatDate(doc.expiry) : <span className="text-gray-300">Not set</span>}</td>
                        <td className="text-[13px]">
                          {daysLeft === null ? '—'
                            : daysLeft < 0 ? <span className="text-red-600 font-bold">{Math.abs(daysLeft)}d overdue</span>
                              : <span className={daysLeft <= 30 ? 'text-red-600 font-bold' : daysLeft <= 60 ? 'text-amber-600 font-semibold' : 'text-gray-600'}>{daysLeft}d</span>}
                        </td>
                        <td><span className={`badge text-[11px] ${expiryStatusColour[doc.status]}`}>{expiryLabel(doc.expiry)}</span></td>
                        <td><Link href={doc.href} className="btn btn-secondary btn-sm text-[12px]">Update</Link></td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
