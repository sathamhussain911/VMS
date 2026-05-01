'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export default function FinesAccidentsPage() {
  const supabase = createClient()
  const [fines, setFines] = useState<any[]>([])
  const [accidents, setAccidents] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'fines' | 'accidents'>('fines')
  const [showFineForm, setShowFineForm] = useState(false)
  const [showAccidentForm, setShowAccidentForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: f }, { data: a }, { data: v }, { data: d }] = await Promise.all([
      supabase.from('traffic_fines').select('*,vehicle:vehicles(vehicle_number,make,model),driver:drivers(full_name)').order('fine_date', { ascending: false }),
      supabase.from('accident_reports').select('*,vehicle:vehicles(vehicle_number,make,model),driver:drivers(full_name)').order('accident_date', { ascending: false }),
      supabase.from('vehicles').select('id,vehicle_number,make,model').is('deleted_at', null),
      supabase.from('drivers').select('id,full_name').eq('status', 'active'),
    ])
    setFines(f ?? [])
    setAccidents(a ?? [])
    setVehicles(v ?? [])
    setDrivers(d ?? [])
    setLoading(false)
  }

  async function submitFine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setFormLoading(true); setError('')
    const f = new FormData(e.currentTarget)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('traffic_fines').insert({
      fine_number: '',
      vehicle_id: f.get('vehicle_id'),
      driver_id: f.get('driver_id') || null,
      fine_type: f.get('fine_type'),
      violation: f.get('violation'),
      fine_amount: parseFloat(f.get('fine_amount') as string),
      fine_date: f.get('fine_date'),
      due_date: f.get('due_date') || null,
      source: f.get('source') || 'RTA',
      location: f.get('location') || null,
      notes: f.get('notes') || null,
      created_by: user?.id,
    })
    if (err) { setError(err.message); setFormLoading(false); return }
    setShowFineForm(false); loadAll(); setFormLoading(false)
  }

  async function submitAccident(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setFormLoading(true); setError('')
    const f = new FormData(e.currentTarget)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('accident_reports').insert({
      report_number: '',
      vehicle_id: f.get('vehicle_id'),
      driver_id: f.get('driver_id') || null,
      accident_date: f.get('accident_date'),
      accident_time: f.get('accident_time') || null,
      location: f.get('location') || null,
      description: f.get('description'),
      severity: f.get('severity'),
      fault: f.get('fault'),
      injuries: f.get('injuries') === 'true',
      injury_details: f.get('injury_details') || null,
      police_report: f.get('police_report') || null,
      insurance_claim: f.get('insurance_claim') || null,
      repair_cost: f.get('repair_cost') ? parseFloat(f.get('repair_cost') as string) : null,
      notes: f.get('notes') || null,
      created_by: user?.id,
    })
    if (err) { setError(err.message); setFormLoading(false); return }
    setShowAccidentForm(false); loadAll(); setFormLoading(false)
  }

  async function markFinePaid(id: string) {
    await supabase.from('traffic_fines').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    loadAll()
  }

  async function resolveAccident(id: string) {
    await supabase.from('accident_reports').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id)
    loadAll()
  }

  const unpaidFines = fines.filter(f => f.status === 'unpaid')
  const totalUnpaid = unpaidFines.reduce((s, f) => s + (f.fine_amount ?? 0), 0)
  const openAccidents = accidents.filter(a => a.status !== 'resolved' && a.status !== 'closed')
  const totalRepairCost = accidents.reduce((s, a) => s + (a.repair_cost ?? 0), 0)

  const SEVERITY_COLOR: Record<string, string> = {
    minor: 'bg-yellow-100 text-yellow-700',
    moderate: 'bg-amber-100 text-amber-700',
    major: 'bg-orange-100 text-orange-700',
    total_loss: 'bg-red-100 text-red-700',
  }

  const STATUS_COLOR: Record<string, string> = {
    unpaid: 'bg-red-100 text-red-700',
    paid: 'bg-green-100 text-green-700',
    disputed: 'bg-amber-100 text-amber-700',
    waived: 'bg-gray-100 text-gray-500',
    reported: 'bg-red-100 text-red-700',
    under_investigation: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-500',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fines & Accident Management</h1>
          <p className="page-subtitle">Traffic fines, accident reports, insurance claims & driver impact tracking</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFineForm(true)} className="btn btn-secondary">+ Log Fine</button>
          <button onClick={() => setShowAccidentForm(true)} className="btn btn-primary">+ Report Accident</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Unpaid Fines', value: unpaidFines.length, color: 'text-red-600', sub: `AED ${totalUnpaid.toFixed(2)} outstanding` },
          { label: 'Open Accidents', value: openAccidents.length, color: 'text-amber-600', sub: 'Under investigation' },
          { label: 'Total Fines (All)', value: fines.length, color: 'text-blue-600', sub: `AED ${fines.reduce((s, f) => s + (f.fine_amount ?? 0), 0).toFixed(2)}` },
          { label: 'Repair Costs', value: `AED ${totalRepairCost.toFixed(0)}`, color: 'text-primary-700', sub: `${accidents.length} accident records` },
        ].map((s, i) => (
          <div key={i} className="card"><div className="card-body">
            <div className={`text-[26px] font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-[13px] font-medium text-gray-700">{s.label}</div>
            <div className="text-[11px] text-gray-400">{s.sub}</div>
          </div></div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 w-fit">
        <button onClick={() => setTab('fines')} className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${tab === 'fines' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
          Traffic Fines {unpaidFines.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unpaidFines.length}</span>}
        </button>
        <button onClick={() => setTab('accidents')} className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${tab === 'accidents' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
          Accident Reports {openAccidents.length > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{openAccidents.length}</span>}
        </button>
      </div>

      {/* FINES TABLE */}
      {tab === 'fines' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Traffic Fines</span>
            <span className="text-[12px] text-gray-400">{fines.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Ref</th><th>Vehicle</th><th>Driver</th><th>Violation</th><th>Amount</th><th>Date</th><th>Due</th><th>Source</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={10} className="text-center py-10 text-gray-400">Loading…</td></tr>
                  : fines.length === 0
                    ? <tr><td colSpan={10} className="text-center py-10 text-gray-400">No fines recorded</td></tr>
                    : fines.map(f => (
                      <tr key={f.id} className={f.status === 'unpaid' ? 'bg-red-50/50' : ''}>
                        <td className="font-mono text-[12px]">{f.fine_number}</td>
                        <td className="font-semibold text-[13px]">{f.vehicle?.vehicle_number ?? '—'}</td>
                        <td className="text-[13px]">{f.driver?.full_name ?? '—'}</td>
                        <td className="text-[13px]">{f.violation}</td>
                        <td className="font-bold text-[13px] text-red-600">AED {f.fine_amount?.toFixed(2)}</td>
                        <td className="text-[12px]">{formatDate(f.fine_date)}</td>
                        <td className="text-[12px]">{f.due_date ? formatDate(f.due_date) : '—'}</td>
                        <td className="text-[12px]">{f.source}</td>
                        <td><span className={`badge text-[11px] ${STATUS_COLOR[f.status]}`}>{f.status}</span></td>
                        <td>
                          {f.status === 'unpaid' && (
                            <button onClick={() => markFinePaid(f.id)} className="btn btn-secondary btn-sm text-green-700 border-green-200 text-[12px]">Mark Paid</button>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ACCIDENTS TABLE */}
      {tab === 'accidents' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Accident Reports</span>
            <span className="text-[12px] text-gray-400">{accidents.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Ref</th><th>Vehicle</th><th>Driver</th><th>Date</th><th>Location</th><th>Severity</th><th>Fault</th><th>Repair Cost</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={10} className="text-center py-10 text-gray-400">Loading…</td></tr>
                  : accidents.length === 0
                    ? <tr><td colSpan={10} className="text-center py-10 text-gray-400">No accidents recorded</td></tr>
                    : accidents.map(a => (
                      <tr key={a.id}>
                        <td className="font-mono text-[12px]">{a.report_number}</td>
                        <td className="font-semibold text-[13px]">{a.vehicle?.vehicle_number ?? '—'}</td>
                        <td className="text-[13px]">{a.driver?.full_name ?? '—'}</td>
                        <td className="text-[12px]">{formatDate(a.accident_date)}</td>
                        <td className="text-[12px]">{a.location ?? '—'}</td>
                        <td><span className={`badge text-[11px] ${SEVERITY_COLOR[a.severity]}`}>{a.severity.replace('_', ' ')}</span></td>
                        <td className="text-[12px] capitalize">{a.fault?.replace('_', ' ') ?? '—'}</td>
                        <td className="text-[13px]">{a.repair_cost ? `AED ${a.repair_cost.toFixed(0)}` : '—'}</td>
                        <td><span className={`badge text-[11px] ${STATUS_COLOR[a.status]}`}>{a.status.replace('_', ' ')}</span></td>
                        <td>
                          {a.status !== 'resolved' && a.status !== 'closed' && (
                            <button onClick={() => resolveAccident(a.id)} className="btn btn-secondary btn-sm text-[12px]">Resolve</button>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fine Form Modal */}
      {showFineForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl my-4">
            <h3 className="font-bold text-[16px] mb-4">Log Traffic Fine</h3>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-[13px] text-red-700">{error}</div>}
            <form onSubmit={submitFine} className="space-y-3">
              <div>
                <label className="form-label">Vehicle *</label>
                <select name="vehicle_id" className="form-control" required>
                  <option value="">Select vehicle…</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number} — {v.make} {v.model}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Driver</label>
                <select name="driver_id" className="form-control">
                  <option value="">Unknown / Not assigned</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Fine Type *</label>
                  <select name="fine_type" className="form-control" required>
                    {['traffic', 'parking', 'salik', 'other'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Source</label>
                  <select name="source" className="form-control">
                    {['RTA', 'Dubai Police', 'Abu Dhabi Police', 'Sharjah Police', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Violation *</label>
                <input name="violation" className="form-control" placeholder="e.g. Speeding, Signal jumping…" required/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Amount (AED) *</label>
                  <input name="fine_amount" type="number" step="0.01" className="form-control" required/>
                </div>
                <div>
                  <label className="form-label">Fine Date *</label>
                  <input name="fine_date" type="date" className="form-control" defaultValue={new Date().toISOString().split('T')[0]} required/>
                </div>
              </div>
              <div>
                <label className="form-label">Due Date</label>
                <input name="due_date" type="date" className="form-control"/>
              </div>
              <div>
                <label className="form-label">Location</label>
                <input name="location" className="form-control" placeholder="Where the fine was issued"/>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea name="notes" className="form-control" rows={2}/>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowFineForm(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={formLoading} className="btn btn-primary flex-1">{formLoading ? 'Saving…' : 'Log Fine'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Accident Form Modal */}
      {showAccidentForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl my-4">
            <h3 className="font-bold text-[16px] mb-4">Report Accident</h3>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-[13px] text-red-700">{error}</div>}
            <form onSubmit={submitAccident} className="space-y-3">
              <div>
                <label className="form-label">Vehicle *</label>
                <select name="vehicle_id" className="form-control" required>
                  <option value="">Select vehicle…</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number} — {v.make} {v.model}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Driver</label>
                <select name="driver_id" className="form-control">
                  <option value="">Unknown</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Date *</label>
                  <input name="accident_date" type="date" className="form-control" defaultValue={new Date().toISOString().split('T')[0]} required/>
                </div>
                <div>
                  <label className="form-label">Time</label>
                  <input name="accident_time" type="time" className="form-control"/>
                </div>
              </div>
              <div>
                <label className="form-label">Location</label>
                <input name="location" className="form-control" placeholder="Where did it happen?"/>
              </div>
              <div>
                <label className="form-label">Description *</label>
                <textarea name="description" className="form-control" rows={3} placeholder="What happened?" required/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Severity *</label>
                  <select name="severity" className="form-control" required>
                    {['minor', 'moderate', 'major', 'total_loss'].map(s => <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Fault</label>
                  <select name="fault" className="form-control">
                    {['under_investigation', 'our_fault', 'third_party', 'shared', 'natural'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Injuries?</label>
                  <select name="injuries" className="form-control">
                    <option value="false">No injuries</option>
                    <option value="true">Yes — injuries</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Repair Cost (AED)</label>
                  <input name="repair_cost" type="number" step="0.01" className="form-control"/>
                </div>
              </div>
              <div>
                <label className="form-label">Police Report #</label>
                <input name="police_report" className="form-control" placeholder="Police report number"/>
              </div>
              <div>
                <label className="form-label">Insurance Claim #</label>
                <input name="insurance_claim" className="form-control" placeholder="Insurance claim reference"/>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea name="notes" className="form-control" rows={2}/>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAccidentForm(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={formLoading} className="btn btn-primary flex-1">{formLoading ? 'Saving…' : 'Submit Report'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
