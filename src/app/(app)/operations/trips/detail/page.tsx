'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime, tripStatusColour, priorityColour } from '@/lib/utils'

function TripDetailPageInner() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const supabase = createClient()
  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [showAddStop, setShowAddStop] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [newStop, setNewStop] = useState({ destination_name: '', address: '', contact_name: '', contact_phone: '', expected_arrival: '' })

  useEffect(() => { if (id) loadTrip() }, [id])

  async function loadTrip() {
    const { data, error } = await supabase.from('trips')
      .select('*,branch:branches(name),vehicle:vehicles(id,vehicle_number,make,model),driver:drivers(id,full_name,mobile),stops:trip_stops(*),events:trip_events(*)')
      .eq('id', id).maybeSingle()
    if (error) setFetchError(error.message)
    if (data) {
      // Fetch requester separately to avoid ambiguous FK
      let requesterName = null
      if (data.requester_id) {
        const { data: u } = await supabase.from('users').select('full_name').eq('id', data.requester_id).maybeSingle()
        requesterName = u?.full_name
      }
      setTrip({ ...data, requester: { full_name: requesterName } })
    }
    setLoading(false)
  }

  async function updateStatus(newStatus: string, extra: Record<string, any> = {}) {
    setActionLoading(newStatus)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('trips').update({ status: newStatus, ...extra }).eq('id', id)
    await supabase.from('trip_events').insert({
      trip_id: id, event_type: 'status_change',
      from_status: trip.status, to_status: newStatus, actor_id: user?.id
    })
    loadTrip(); setActionLoading('')
  }

  async function cancelTrip() {
    if (!cancelReason.trim()) { alert('Enter a cancellation reason'); return }
    setActionLoading('cancel')
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('trips').update({
      status: 'cancelled', cancel_reason: cancelReason,
      cancelled_at: new Date().toISOString(), cancelled_by: user?.id
    }).eq('id', id)
    if (trip.vehicle_id) await supabase.from('vehicles').update({ status: 'available' }).eq('id', trip.vehicle_id)
    await supabase.from('trip_events').insert({
      trip_id: id, event_type: 'status_change',
      from_status: trip.status, to_status: 'cancelled', actor_id: user?.id, notes: cancelReason
    })
    setShowCancel(false); loadTrip(); setActionLoading('')
  }

  async function addStop() {
    if (!newStop.destination_name) { alert('Enter destination name'); return }
    setActionLoading('addstop')
    const maxSeq = Math.max(0, ...(trip.stops ?? []).map((s: any) => s.sequence))
    await supabase.from('trip_stops').insert({
      trip_id: id, sequence: maxSeq + 1,
      destination_name: newStop.destination_name,
      address: newStop.address || null,
      contact_name: newStop.contact_name || null,
      contact_phone: newStop.contact_phone || null,
      expected_arrival: newStop.expected_arrival || null,
    })
    setNewStop({ destination_name: '', address: '', contact_name: '', contact_phone: '', expected_arrival: '' })
    setShowAddStop(false); loadTrip(); setActionLoading('')
  }

  async function deleteStop(stopId: string) {
    if (!confirm('Remove this stop?')) return
    await supabase.from('trip_stops').delete().eq('id', stopId)
    loadTrip()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/></div>
  if (fetchError) return <div className="p-8 text-center text-red-400">Error: {fetchError}</div>
  if (!trip) return <div className="p-8 text-center text-gray-400">Trip not found. <Link href="/operations/trips" className="text-primary-700 underline">Back to trips</Link></div>

  const stops = (trip.stops ?? []).sort((a: any, b: any) => a.sequence - b.sequence)
  const events = (trip.events ?? []).sort((a: any, b: any) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
  const STOP_STATUS: Record<string, string> = { delivered: 'bg-green-100 text-green-700', pending: 'bg-gray-100 text-gray-600', partial: 'bg-amber-100 text-amber-700', failed: 'bg-red-100 text-red-700' }

  const canApprove = trip.status === 'requested'
  const canAssign = ['requested', 'approved'].includes(trip.status)
  const canCancel = !['completed', 'cancelled'].includes(trip.status)
  const canAddStop = !['completed', 'cancelled'].includes(trip.status)

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/operations/trips" className="text-gray-400 hover:text-gray-600 text-sm">← Trips</Link>
          <div>
            <h1 className="page-title">{trip.trip_number}</h1>
            <p className="page-subtitle">{trip.branch?.name} · {formatDate(trip.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {canApprove && (
            <button onClick={() => updateStatus('approved')} disabled={actionLoading === 'approved'}
              className="btn btn-primary">
              {actionLoading === 'approved' ? 'Approving…' : '✓ Approve'}
            </button>
          )}
          {canAssign && (
            <Link href={`/operations/trips/detail/assign?id=${id}`} className="btn btn-secondary">
              Assign Vehicle & Driver
            </Link>
          )}
          {canCancel && (
            <button onClick={() => setShowCancel(true)} className="btn btn-secondary text-red-600 border-red-200 hover:bg-red-50">
              Cancel Trip
            </button>
          )}
          <span className={`badge ${tripStatusColour[trip.status]} text-[13px] px-4`}>
            {trip.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-[16px] mb-1">Cancel Trip</h3>
            <p className="text-[13px] text-gray-500 mb-4">This will release the vehicle and driver</p>
            <textarea className="form-control mb-4" rows={3} placeholder="Reason for cancellation *"
              value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => setShowCancel(false)} className="btn btn-secondary flex-1">Keep Trip</button>
              <button onClick={cancelTrip} disabled={actionLoading === 'cancel'}
                className="btn flex-1 bg-red-600 text-white hover:bg-red-700">
                {actionLoading === 'cancel' ? 'Cancelling…' : 'Cancel Trip'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">

          {/* Trip Details */}
          <div className="card">
            <div className="card-header"><span className="card-title">Trip Details</span></div>
            <div className="card-body grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Trip Number', value: trip.trip_number },
                { label: 'Branch', value: trip.branch?.name },
                { label: 'Priority', value: <span className={`badge ${priorityColour[trip.priority]}`}>{trip.priority}</span> },
                { label: 'Planned Start', value: formatDateTime(trip.planned_start) },
                { label: 'Planned End', value: formatDateTime(trip.planned_end) },
                { label: 'Actual Start', value: formatDateTime(trip.actual_start) },
                { label: 'Actual End', value: formatDateTime(trip.actual_end) },
                { label: 'Vehicle', value: trip.vehicle ? trip.vehicle.vehicle_number : null },
                { label: 'Driver', value: trip.driver?.full_name },
                { label: 'Requested By', value: trip.requester?.full_name },
                { label: 'Opening Odo', value: trip.opening_odometer ? `${trip.opening_odometer.toLocaleString()} km` : null },
                { label: 'Closing Odo', value: trip.closing_odometer ? `${trip.closing_odometer.toLocaleString()} km` : null },
                { label: 'Distance', value: trip.total_distance ? `${trip.total_distance.toLocaleString()} km` : null },
                { label: 'Cargo', value: trip.cargo_description },
                { label: 'Weight', value: trip.cargo_weight_kg ? `${trip.cargo_weight_kg} kg` : null },
              ].map((f, i) => (
                <div key={i}>
                  <div className="text-[11.5px] text-gray-400 font-medium uppercase tracking-wide">{f.label}</div>
                  <div className="text-[13.5px] font-semibold text-gray-800 mt-0.5">{f.value ?? <span className="text-gray-300">—</span>}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Cancellation info */}
          {trip.status === 'cancelled' && trip.cancel_reason && (
            <div className="card border-red-200">
              <div className="card-body">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </div>
                  <div>
                    <div className="font-semibold text-red-700 text-[13.5px]">Trip Cancelled</div>
                    <div className="text-[13px] text-gray-600 mt-0.5">{trip.cancel_reason}</div>
                    <div className="text-[12px] text-gray-400 mt-1">{formatDateTime(trip.cancelled_at)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Stops */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Delivery Stops</span>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-gray-400">{stops.filter((s: any) => s.delivery_status === 'delivered').length}/{stops.length} delivered</span>
                {canAddStop && (
                  <button onClick={() => setShowAddStop(!showAddStop)}
                    className="btn btn-secondary btn-sm text-[12px]">
                    + Add Stop
                  </button>
                )}
              </div>
            </div>

            {/* Add Stop Form */}
            {showAddStop && (
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h4 className="font-semibold text-[13px] mb-3">New Stop</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <input className="form-control" placeholder="Destination name *"
                      value={newStop.destination_name} onChange={e => setNewStop(p => ({ ...p, destination_name: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <input className="form-control" placeholder="Address"
                      value={newStop.address} onChange={e => setNewStop(p => ({ ...p, address: e.target.value }))} />
                  </div>
                  <input className="form-control" placeholder="Contact name"
                    value={newStop.contact_name} onChange={e => setNewStop(p => ({ ...p, contact_name: e.target.value }))} />
                  <input className="form-control" placeholder="Contact phone"
                    value={newStop.contact_phone} onChange={e => setNewStop(p => ({ ...p, contact_phone: e.target.value }))} />
                  <div className="col-span-2">
                    <label className="text-[12px] text-gray-500 block mb-1">Expected Arrival (optional)</label>
                    <input type="datetime-local" className="form-control"
                      value={newStop.expected_arrival} onChange={e => setNewStop(p => ({ ...p, expected_arrival: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setShowAddStop(false)} className="btn btn-secondary btn-sm">Cancel</button>
                  <button onClick={addStop} disabled={actionLoading === 'addstop'} className="btn btn-primary btn-sm">
                    {actionLoading === 'addstop' ? 'Adding…' : 'Add Stop'}
                  </button>
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-100">
              {stops.length === 0
                ? <div className="p-6 text-center text-gray-400 text-sm">No stops added yet</div>
                : stops.map((stop: any, i: number) => (
                  <div key={stop.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${stop.delivery_status === 'delivered' ? 'bg-green-500 text-white' : stop.delivery_status === 'failed' ? 'bg-red-500 text-white' : stop.delivery_status === 'partial' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                          {stop.delivery_status === 'delivered' ? '✓' : stop.delivery_status === 'failed' ? '✗' : stop.delivery_status === 'partial' ? '~' : i + 1}
                        </div>
                        <div>
                          <span className="font-semibold text-[14px]">{stop.destination_name}</span>
                          {stop.address && <div className="text-[12px] text-gray-500">{stop.address}</div>}
                          {stop.contact_name && <div className="text-[12px] text-gray-500">📞 {stop.contact_name} {stop.contact_phone}</div>}
                          {stop.expected_arrival && <div className="text-[12px] text-gray-400">ETA {formatDateTime(stop.expected_arrival)}</div>}
                          {stop.actual_arrival && <div className="text-[12px] text-green-600">Arrived {formatDateTime(stop.actual_arrival)}</div>}
                          {stop.notes && <div className="text-[12px] text-gray-500 italic mt-1">"{stop.notes}"</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${STOP_STATUS[stop.delivery_status]}`}>{stop.delivery_status}</span>
                        {canAddStop && trip.status !== 'in_progress' && (
                          <button onClick={() => deleteStop(stop.id)} className="text-gray-300 hover:text-red-400 text-[18px] leading-none">×</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">

          {/* Vehicle & Driver Card */}
          <div className="card">
            <div className="card-header"><span className="card-title">Assignment</span></div>
            <div className="card-body space-y-4">
              <div>
                <div className="text-[11.5px] text-gray-400 uppercase tracking-wide font-medium mb-1">Vehicle</div>
                {trip.vehicle ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h1m6-1l2-2h1m-7 0h4m-4 0a2 2 0 100 0"/></svg>
                    </div>
                    <div>
                      <div className="font-semibold text-[13.5px]">{trip.vehicle.vehicle_number}</div>
                      <div className="text-[12px] text-gray-500">{trip.vehicle.make} {trip.vehicle.model}</div>
                    </div>
                  </div>
                ) : <span className="text-gray-400 text-[13px]">Not assigned</span>}
              </div>
              <div>
                <div className="text-[11.5px] text-gray-400 uppercase tracking-wide font-medium mb-1">Driver</div>
                {trip.driver ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    </div>
                    <div>
                      <div className="font-semibold text-[13.5px]">{trip.driver.full_name}</div>
                      <div className="text-[12px] text-gray-500">{trip.driver.mobile}</div>
                    </div>
                  </div>
                ) : <span className="text-gray-400 text-[13px]">Not assigned</span>}
              </div>
              {canAssign && (
                <Link href={`/operations/trips/detail/assign?id=${id}`} className="btn btn-secondary w-full justify-center text-[13px]">
                  {trip.vehicle ? 'Reassign' : 'Assign Vehicle & Driver'}
                </Link>
              )}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="card">
            <div className="card-header"><span className="card-title">Activity Timeline</span></div>
            <div className="card-body">
              {events.length === 0
                ? <div className="text-center py-6 text-gray-400 text-sm">No events recorded</div>
                : events.map((ev: any, i: number) => (
                  <div key={ev.id} className="flex gap-3 pb-4 relative">
                    {i < events.length - 1 && <div className="absolute left-[7px] top-4 bottom-0 w-px bg-gray-200"/>}
                    <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 mt-1 z-10 ${ev.event_type === 'status_change' ? 'bg-blue-500' : 'bg-primary-500'}`}/>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-mono text-gray-400">{formatDate(ev.occurred_at, 'dd MMM HH:mm')}</div>
                      <div className="text-[13px] text-gray-700 mt-0.5">
                        {ev.event_type === 'status_change'
                          ? <><span className="font-semibold capitalize">{ev.to_status?.replace('_', ' ')}</span>{ev.from_status && ` ← ${ev.from_status.replace('_', ' ')}`}</>
                          : <span className="capitalize">{ev.event_type.replace('_', ' ')}</span>}
                      </div>
                      {ev.notes && <div className="text-[12px] text-gray-400 italic">"{ev.notes}"</div>}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TripDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/></div>}>
      <TripDetailPageInner />
    </Suspense>
  )
}
