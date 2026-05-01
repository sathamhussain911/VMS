'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export default function MaintenancePage() {
  const supabase = createClient()
  const [records, setRecords] = useState<any[]>([])
  const [breakdowns, setBreakdowns] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'records' | 'breakdowns' | 'schedule'>('records')
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: recs }, { data: bdowns }, { data: vehs }] = await Promise.all([
      supabase.from('maintenance_records')
        .select('*,vehicle:vehicles(vehicle_number,make,model)')
        .order('service_date', { ascending: false }).limit(100),
      supabase.from('breakdown_reports')
        .select('*,vehicle:vehicles(vehicle_number),driver:drivers(full_name)')
        .order('reported_at', { ascending: false }).limit(50),
      supabase.from('vehicles')
        .select('id,vehicle_number,make,model,status,current_odometer,next_service_date,next_service_km')
        .is('deleted_at', null).order('vehicle_number'),
    ])
    setRecords(recs ?? [])
    setBreakdowns(bdowns ?? [])
    setVehicles(vehs ?? [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormLoading(true); setError('')
    const f = new FormData(e.currentTarget)
    const { data: { user } } = await supabase.auth.getUser()

    const { error: err } = await supabase.from('maintenance_records').insert({
      vehicle_id: f.get('vehicle_id'),
      maintenance_type: f.get('maintenance_type'),
      title: f.get('title'),
      description: f.get('description') || null,
      workshop_name: f.get('workshop_name') || null,
      cost: f.get('cost') ? parseFloat(f.get('cost') as string) : null,
      odometer_at_service: f.get('odometer') ? parseInt(f.get('odometer') as string) : null,
      service_date: f.get('service_date'),
      next_service_date: f.get('next_service_date') || null,
      next_service_km: f.get('next_service_km') ? parseInt(f.get('next_service_km') as string) : null,
      invoice_number: f.get('invoice_number') || null,
      status: f.get('status'),
      notes: f.get('notes') || null,
      created_by: user?.id,
    })

    if (err) { setError(err.message); setFormLoading(false); return }

    // Update vehicle next service date if provided
    const vehicleId = f.get('vehicle_id') as string
    const nextDate = f.get('next_service_date') as string
    const nextKm = f.get('next_service_km') as string
    if (vehicleId && (nextDate || nextKm)) {
      await supabase.from('vehicles').update({
        next_service_date: nextDate || null,
        next_service_km: nextKm ? parseInt(nextKm) : null,
        last_service_date: f.get('service_date'),
      }).eq('id', vehicleId)
    }

    setShowForm(false); loadAll(); setFormLoading(false)
  }

  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolveNotes, setResolveNotes] = useState('')

  async function resolveBreakdown(id: string) {
    if (!resolveNotes.trim()) return
    await supabase.from('breakdown_reports').update({
      status: 'resolved', resolved_at: new Date().toISOString(), resolution_notes: resolveNotes
    }).eq('id', id)
    setResolvingId(null); setResolveNotes(''); loadAll()
  }

  const TYPE_COLOUR: Record<string, string> = {
    routine: 'bg-blue-100 text-blue-700',
    repair: 'bg-orange-100 text-orange-700',
    tyre: 'bg-gray-100 text-gray-700',
    battery: 'bg-yellow-100 text-yellow-700',
    ac: 'bg-cyan-100 text-cyan-700',
    body: 'bg-purple-100 text-purple-700',
    inspection: 'bg-green-100 text-green-700',
    other: 'bg-gray-100 text-gray-600',
  }

  const SEVERITY_COLOUR: Record<string, string> = {
    minor: 'bg-yellow-100 text-yellow-700',
    major: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  }

  // Vehicles due for service
  const today = new Date()
  const dueSoon = vehicles.filter(v => {
    if (!v.next_service_date) return false
    const days = Math.ceil((new Date(v.next_service_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return days <= 14
  })

  const openBreakdowns = breakdowns.filter(b => b.status !== 'resolved')

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance</h1>
          <p className="page-subtitle">Service records, breakdowns and scheduled maintenance</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">+ Log Maintenance</button>
      </div>

      {/* Alert banners */}
      {openBreakdowns.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <div className="font-bold text-red-700">{openBreakdowns.length} Open Breakdown{openBreakdowns.length > 1 ? 's' : ''}</div>
            <div className="text-[13px] text-red-600">
              {openBreakdowns.slice(0, 2).map(b => `${b.vehicle?.vehicle_number} — ${b.severity}`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {dueSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-center gap-3">
          <span className="text-2xl">🔧</span>
          <div>
            <div className="font-bold text-amber-700">{dueSoon.length} Vehicle{dueSoon.length > 1 ? 's' : ''} Due for Service</div>
            <div className="text-[13px] text-amber-600">
              {dueSoon.slice(0, 3).map(v => `${v.vehicle_number} (${formatDate(v.next_service_date, 'dd MMM')})`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 w-fit">
        {(['records', 'breakdowns', 'schedule'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold capitalize transition-all ${tab === t ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
            {t} {t === 'breakdowns' && openBreakdowns.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{openBreakdowns.length}</span>}
          </button>
        ))}
      </div>

      {/* Maintenance Records */}
      {tab === 'records' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Service Records</span>
            <span className="text-[12px] text-gray-400">{records.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Vehicle</th><th>Type</th><th>Title</th><th>Workshop</th><th>Cost (AED)</th><th>Next Service</th><th>Status</th></tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading…</td></tr>
                  : records.length === 0
                    ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">No maintenance records yet</td></tr>
                    : records.map(r => (
                      <tr key={r.id}>
                        <td className="text-[12px]">{formatDate(r.service_date, 'dd MMM yyyy')}</td>
                        <td className="font-semibold text-[13px]">{r.vehicle?.vehicle_number}</td>
                        <td><span className={`badge ${TYPE_COLOUR[r.maintenance_type]} text-[11px]`}>{r.maintenance_type}</span></td>
                        <td className="text-[13px]">{r.title}</td>
                        <td className="text-[12px]">{r.workshop_name ?? '—'}</td>
                        <td className="font-semibold text-[13px]">{r.cost ? `AED ${r.cost.toLocaleString()}` : '—'}</td>
                        <td className="text-[12px]">{r.next_service_date ? formatDate(r.next_service_date, 'dd MMM yyyy') : '—'}</td>
                        <td><span className={`badge text-[11px] ${r.status === 'completed' ? 'bg-green-100 text-green-700' : r.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span></td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Breakdowns */}
      {tab === 'breakdowns' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Breakdown Reports</span></div>
          <div className="divide-y divide-gray-100">
            {breakdowns.length === 0
              ? <div className="p-8 text-center text-gray-400">No breakdown reports</div>
              : breakdowns.map(b => (
                <div key={b.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-[14px]">{b.vehicle?.vehicle_number}</div>
                      <div className="text-[12px] text-gray-500">{b.driver?.full_name} · {formatDate(b.reported_at, 'dd MMM HH:mm')}</div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className={`badge ${SEVERITY_COLOUR[b.severity]} text-[11px]`}>{b.severity}</span>
                      <span className={`badge text-[11px] ${b.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{b.status}</span>
                    </div>
                  </div>
                  <div className="text-[13px] text-gray-700">{b.description}</div>
                  {b.location && <div className="text-[12px] text-gray-400 mt-1">📍 {b.location}</div>}
                  {b.resolution_notes && <div className="text-[12px] text-green-700 mt-1">✓ {b.resolution_notes}</div>}
                  {b.status !== 'resolved' && (
                    resolvingId === b.id ? (
                      <div className="mt-3 space-y-2">
                        <input className="form-control text-[13px]" placeholder="Resolution notes *"
                          value={resolveNotes} onChange={e => setResolveNotes(e.target.value)}/>
                        <div className="flex gap-2">
                          <button onClick={() => { setResolvingId(null); setResolveNotes('') }}
                            className="btn btn-secondary btn-sm flex-1">Cancel</button>
                          <button onClick={() => resolveBreakdown(b.id)}
                            className="btn btn-sm flex-1 bg-green-600 text-white">Confirm</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setResolvingId(b.id)}
                        className="mt-3 btn btn-secondary btn-sm text-green-700 border-green-200">
                        Mark Resolved
                      </button>
                    )
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Schedule */}
      {tab === 'schedule' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Service Schedule</span></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Vehicle</th><th>Current Odo</th><th>Last Service</th><th>Next Service Date</th><th>Next Service KM</th><th>Status</th></tr>
              </thead>
              <tbody>
                {vehicles.map(v => {
                  const daysUntil = v.next_service_date
                    ? Math.ceil((new Date(v.next_service_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                    : null
                  const isOverdue = daysUntil !== null && daysUntil < 0
                  const isDueSoon = daysUntil !== null && daysUntil >= 0 && daysUntil <= 14
                  return (
                    <tr key={v.id} className={isOverdue ? 'bg-red-50' : isDueSoon ? 'bg-amber-50' : ''}>
                      <td className="font-semibold text-[13px]">{v.vehicle_number}</td>
                      <td className="text-[13px] font-mono">{v.current_odometer?.toLocaleString()} km</td>
                      <td className="text-[12px]">{v.last_service_date ? formatDate(v.last_service_date, 'dd MMM yyyy') : '—'}</td>
                      <td className="text-[13px]">
                        {v.next_service_date ? (
                          <span className={isOverdue ? 'text-red-600 font-bold' : isDueSoon ? 'text-amber-600 font-semibold' : ''}>
                            {formatDate(v.next_service_date, 'dd MMM yyyy')}
                            {daysUntil !== null && <span className="text-[11px] ml-1">({isOverdue ? `${Math.abs(daysUntil)}d overdue` : `in ${daysUntil}d`})</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="text-[13px]">{v.next_service_km ? `${v.next_service_km.toLocaleString()} km` : '—'}</td>
                      <td>
                        {isOverdue ? <span className="badge bg-red-100 text-red-700 text-[11px]">Overdue</span>
                          : isDueSoon ? <span className="badge bg-amber-100 text-amber-700 text-[11px]">Due Soon</span>
                            : v.next_service_date ? <span className="badge bg-green-100 text-green-700 text-[11px]">OK</span>
                              : <span className="badge bg-gray-100 text-gray-400 text-[11px]">Not Set</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Maintenance Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl my-4">
            <h3 className="font-bold text-[16px] mb-4">Log Maintenance Record</h3>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-[13px] text-red-700">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="form-label">Vehicle *</label>
                <select name="vehicle_id" className="form-control" required>
                  <option value="">Select vehicle…</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number} — {v.make} {v.model}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Type *</label>
                  <select name="maintenance_type" className="form-control" required>
                    {['routine', 'repair', 'tyre', 'battery', 'ac', 'body', 'inspection', 'other'].map(t =>
                      <option key={t} value={t} className="capitalize">{t}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="form-label">Status *</label>
                  <select name="status" className="form-control" required defaultValue="completed">
                    {['scheduled', 'in_progress', 'completed'].map(s =>
                      <option key={s} value={s} className="capitalize">{s}</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Title *</label>
                <input name="title" className="form-control" placeholder="e.g. Engine oil change, Tyre replacement" required/>
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea name="description" className="form-control" rows={2} placeholder="Details of work done…"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Workshop</label>
                  <input name="workshop_name" className="form-control" placeholder="Workshop name"/>
                </div>
                <div>
                  <label className="form-label">Cost (AED)</label>
                  <input name="cost" type="number" step="0.01" className="form-control" placeholder="0.00"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Service Date *</label>
                  <input name="service_date" type="date" className="form-control"
                    defaultValue={new Date().toISOString().split('T')[0]} required/>
                </div>
                <div>
                  <label className="form-label">Odometer at Service</label>
                  <input name="odometer" type="number" className="form-control" placeholder="km"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Next Service Date</label>
                  <input name="next_service_date" type="date" className="form-control"/>
                </div>
                <div>
                  <label className="form-label">Next Service KM</label>
                  <input name="next_service_km" type="number" className="form-control" placeholder="km"/>
                </div>
              </div>
              <div>
                <label className="form-label">Invoice Number</label>
                <input name="invoice_number" className="form-control" placeholder="INV-001"/>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea name="notes" className="form-control" rows={2}/>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={formLoading} className="btn btn-primary flex-1">
                  {formLoading ? 'Saving…' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
