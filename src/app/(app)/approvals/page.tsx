'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime } from '@/lib/utils'

export default function ApprovalsPage() {
  const supabase = createClient()
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'all'>('pending')
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [error, setError] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: appr }, { data: vehs }, { data: drvs }, { data: usrs }, { data: profile }] = await Promise.all([
      supabase.from('approvals').select('*,submitter:users!approvals_submitted_by_fkey(full_name),approver:users!approvals_assigned_to_fkey(full_name),vehicle:vehicles(vehicle_number),driver:drivers(full_name)').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('id,vehicle_number').is('deleted_at', null),
      supabase.from('drivers').select('id,full_name').eq('status', 'active'),
      supabase.from('users').select('id,full_name').eq('status', 'active'),
      user ? supabase.from('users').select('id,full_name').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    ])
    setApprovals(appr ?? [])
    setVehicles(vehs ?? [])
    setDrivers(drvs ?? [])
    setUsers(usrs ?? [])
    setCurrentUser(profile)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormLoading(true); setError('')
    const f = new FormData(e.currentTarget)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('approvals').insert({
      ref_number: '',
      approval_type: f.get('approval_type'),
      title: f.get('title'),
      description: f.get('description') || null,
      amount: f.get('amount') ? parseFloat(f.get('amount') as string) : null,
      priority: f.get('priority'),
      assigned_to: f.get('assigned_to') || null,
      related_vehicle_id: f.get('vehicle_id') || null,
      related_driver_id: f.get('driver_id') || null,
      due_by: f.get('due_by') || null,
      notes: f.get('notes') || null,
      submitted_by: user?.id,
    })
    if (err) { setError(err.message); setFormLoading(false); return }
    setShowForm(false); loadAll(); setFormLoading(false)
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected', reason?: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const update: any = { status }
    if (status === 'approved') { update.approved_by = user?.id; update.approved_at = new Date().toISOString() }
    if (status === 'rejected') { update.rejected_by = user?.id; update.rejected_at = new Date().toISOString(); update.rejection_reason = reason }
    await supabase.from('approvals').update(update).eq('id', id)
    loadAll()
  }

  const pending = approvals.filter(a => a.status === 'pending')
  const displayed = tab === 'pending' ? pending : approvals

  const TYPE_COLOR: Record<string, string> = {
    trip: 'bg-blue-100 text-blue-700',
    fuel_claim: 'bg-orange-100 text-orange-700',
    maintenance: 'bg-amber-100 text-amber-700',
    accident: 'bg-red-100 text-red-700',
    overtime: 'bg-purple-100 text-purple-700',
    other: 'bg-gray-100 text-gray-600',
  }

  const STATUS_COLOR: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }

  const PRIORITY_COLOR: Record<string, string> = {
    normal: 'bg-gray-100 text-gray-600',
    urgent: 'bg-amber-100 text-amber-700',
    critical: 'bg-red-100 text-red-700',
  }

  const overdueSLA = pending.filter(a => a.due_by && new Date(a.due_by) < new Date()).length
  const approvedToday = approvals.filter(a => a.status === 'approved' && a.approved_at && new Date(a.approved_at).toDateString() === new Date().toDateString()).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Approval Workflows</h1>
          <p className="page-subtitle">Multi-level approvals — Trips, Fuel Claims, Maintenance, Accidents, Overtime</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">+ New Request</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pending Action', value: pending.length, color: 'text-red-600', bg: 'bg-red-50 border-red-200', sub: overdueSLA > 0 ? `${overdueSLA} overdue SLA` : 'All within SLA' },
          { label: 'Approved Today', value: approvedToday, color: 'text-green-600', bg: 'bg-green-50 border-green-200', sub: 'Processed today' },
          { label: 'Total Pending', value: approvals.filter(a => a.status === 'pending').length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', sub: 'Awaiting decision' },
          { label: 'Total Requests', value: approvals.length, color: 'text-primary-700', bg: 'bg-gray-50 border-gray-200', sub: 'All time' },
        ].map((s, i) => (
          <div key={i} className={`card border ${s.bg}`}>
            <div className="card-body">
              <div className={`text-[28px] font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-[13px] font-medium text-gray-700">{s.label}</div>
              <div className="text-[11px] text-gray-400">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 w-fit">
        {[{ key: 'pending', label: `Pending (${pending.length})` }, { key: 'all', label: 'All Requests' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${tab === t.key ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Approvals list */}
      <div className="space-y-3">
        {loading
          ? <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/></div>
          : displayed.length === 0
            ? <div className="card"><div className="card-body text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">✅</div>
                <div className="font-medium">{tab === 'pending' ? 'No pending approvals' : 'No approval requests yet'}</div>
              </div></div>
            : displayed.map(a => (
              <div key={a.id} className={`card ${a.status === 'pending' && a.due_by && new Date(a.due_by) < new Date() ? 'border-red-300' : ''}`}>
                <div className="card-body">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-[12px] bg-gray-100 px-2 py-0.5 rounded">{a.ref_number}</span>
                        <span className={`badge text-[11px] ${TYPE_COLOR[a.approval_type]}`}>{a.approval_type.replace('_', ' ')}</span>
                        <span className={`badge text-[11px] ${PRIORITY_COLOR[a.priority]}`}>{a.priority}</span>
                        <span className={`badge text-[11px] ${STATUS_COLOR[a.status]}`}>{a.status}</span>
                        {a.status === 'pending' && a.due_by && new Date(a.due_by) < new Date() && (
                          <span className="badge text-[11px] bg-red-100 text-red-700 font-bold">⚠ OVERDUE</span>
                        )}
                      </div>
                      <div className="font-semibold text-[14px] text-gray-800">{a.title}</div>
                      {a.description && <div className="text-[13px] text-gray-500 mt-0.5">{a.description}</div>}
                      <div className="flex gap-4 mt-2 text-[12px] text-gray-400 flex-wrap">
                        {a.amount && <span className="font-semibold text-gray-700">AED {a.amount.toLocaleString('en', { minimumFractionDigits: 2 })}</span>}
                        <span>By: {a.submitter?.full_name ?? '—'}</span>
                        {a.approver?.full_name && <span>Assigned to: {a.approver.full_name}</span>}
                        {a.vehicle?.vehicle_number && <span>🚛 {a.vehicle.vehicle_number}</span>}
                        {a.driver?.full_name && <span>👤 {a.driver.full_name}</span>}
                        <span>{formatDateTime(a.created_at)}</span>
                        {a.due_by && <span className={new Date(a.due_by) < new Date() ? 'text-red-500 font-semibold' : ''}>Due: {formatDate(a.due_by)}</span>}
                      </div>
                      {a.status === 'rejected' && a.rejection_reason && (
                        <div className="mt-2 text-[12px] bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700">
                          Rejected: {a.rejection_reason}
                        </div>
                      )}
                    </div>
                    {a.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => updateStatus(a.id, 'approved')}
                          className="btn btn-primary btn-sm">✓ Approve</button>
                        <button onClick={() => setRejectingId(a.id)}
                          className="btn btn-secondary btn-sm text-red-600 border-red-200">✗ Reject</button>
                      </div>
                    )}
                    {rejectingId === a.id && (
                      <div className="mt-3 flex gap-2">
                        <input className="form-control text-[13px] flex-1" placeholder="Rejection reason *"
                          value={rejectReason} onChange={e => setRejectReason(e.target.value)}/>
                        <button onClick={() => { if (rejectReason.trim()) { updateStatus(a.id, 'rejected', rejectReason); setRejectingId(null); setRejectReason('') } }}
                          className="btn btn-sm bg-red-600 text-white px-3">Confirm</button>
                        <button onClick={() => { setRejectingId(null); setRejectReason('') }}
                          className="btn btn-secondary btn-sm">Cancel</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* New Request Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl my-4">
            <h3 className="font-bold text-[16px] mb-4">New Approval Request</h3>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-[13px] text-red-700">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Type *</label>
                  <select name="approval_type" className="form-control" required>
                    {['trip', 'fuel_claim', 'maintenance', 'accident', 'overtime', 'other'].map(t =>
                      <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="form-label">Priority *</label>
                  <select name="priority" className="form-control" required defaultValue="normal">
                    {['normal', 'urgent', 'critical'].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Title *</label>
                <input name="title" className="form-control" placeholder="Brief description of request" required />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea name="description" className="form-control" rows={3} placeholder="Detailed explanation…"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Amount (AED)</label>
                  <input name="amount" type="number" step="0.01" className="form-control" placeholder="0.00"/>
                </div>
                <div>
                  <label className="form-label">Due By</label>
                  <input name="due_by" type="datetime-local" className="form-control"/>
                </div>
              </div>
              <div>
                <label className="form-label">Assign To</label>
                <select name="assigned_to" className="form-control">
                  <option value="">Select approver…</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Vehicle</label>
                  <select name="vehicle_id" className="form-control">
                    <option value="">None</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Driver</label>
                  <select name="driver_id" className="form-control">
                    <option value="">None</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea name="notes" className="form-control" rows={2}/>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={formLoading} className="btn btn-primary flex-1">
                  {formLoading ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
