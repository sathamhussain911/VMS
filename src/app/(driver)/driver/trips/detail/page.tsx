'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

function DriverTripPageInner() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const router = useRouter()
  const supabase = createClient()
  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [odometer, setOdometer] = useState('')
  const [closingOdo, setClosingOdo] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [stopNotes, setStopNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => { loadTrip() }, [id])

  async function loadTrip() {
    const { data } = await supabase.from('trips')
      .select('*, stops:trip_stops(*), vehicle:vehicles(vehicle_number,make,model,current_odometer), branch:branches(name)')
      .eq('id', id).maybeSingle()
    if (data) setTrip(data)
    setLoading(false)
  }

  async function startTrip() {
    if (!odometer) { setError('Enter opening odometer reading'); return }
    setActionLoading('start'); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('trips').update({
      status: 'in_progress',
      actual_start: new Date().toISOString(),
      opening_odometer: parseInt(odometer)
    }).eq('id', id)
    if (err) { setError(err.message); setActionLoading(''); return }
    await supabase.from('vehicles').update({ status: 'assigned' }).eq('id', trip.vehicle_id)
    await supabase.from('trip_events').insert({
      trip_id: id, event_type: 'status_change',
      from_status: 'assigned', to_status: 'in_progress', actor_id: user?.id
    })
    loadTrip(); setActionLoading('')
  }

  async function markStop(stopId: string, status: 'delivered' | 'failed' | 'partial') {
    setActionLoading(stopId); setError('')
    await supabase.from('trip_stops').update({
      delivery_status: status,
      actual_arrival: new Date().toISOString(),
      notes: stopNotes[stopId] || null
    }).eq('id', stopId)
    loadTrip(); setActionLoading('')
  }

  async function completeTrip() {
    if (!closingOdo) { setError('Enter closing odometer reading'); return }
    const odo = parseInt(closingOdo)
    if (trip.opening_odometer && odo < trip.opening_odometer) {
      setError('Closing odometer must be greater than opening odometer'); return
    }
    const pending = (trip.stops ?? []).filter((s: any) => s.delivery_status === 'pending')
    if (pending.length > 0) {
      setError(`${pending.length} stop(s) still pending — mark them as delivered, partial or failed first`)
      return
    }
    setActionLoading('complete'); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('trips').update({
      status: 'completed',
      actual_end: new Date().toISOString(),
      closing_odometer: odo
    }).eq('id', id)
    await supabase.from('vehicles').update({
      status: 'available',
      current_odometer: odo
    }).eq('id', trip.vehicle_id)
    await supabase.from('drivers').update({ duty_status: 'on_duty' }).eq('id', trip.driver_id)
    await supabase.from('trip_events').insert({
      trip_id: id, event_type: 'status_change',
      from_status: 'in_progress', to_status: 'completed', actor_id: user?.id
    })
    router.push('/driver')
    setActionLoading('')
  }

  if (loading) return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/></div>
  if (!trip) return <div className="p-4 text-center text-gray-400">Trip not found</div>

  const stops = (trip.stops ?? []).sort((a: any, b: any) => a.sequence - b.sequence)
  const pendingStops = stops.filter((s: any) => s.delivery_status === 'pending')
  const doneStops = stops.filter((s: any) => s.delivery_status !== 'pending')
  const bgColour = trip.status === 'in_progress' ? 'bg-blue-600' : trip.status === 'completed' ? 'bg-green-600' : 'bg-primary-800'

  return (
    <div className="min-h-screen bg-gray-100" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", maxWidth: 430, margin: '0 auto' }}>
      {/* Header */}
      <div className={`px-4 pt-10 pb-5 ${bgColour}`}>
        <button onClick={() => router.back()} className="text-white/70 text-[13px] mb-3 flex items-center gap-1">← Back</button>
        <div className="flex justify-between items-start">
          <div>
            <div className="text-white font-extrabold text-[20px]">{trip.trip_number}</div>
            <div className="text-white/70 text-[13px] mt-0.5">{trip.vehicle?.vehicle_number} — {trip.branch?.name}</div>
          </div>
          <span className="bg-white/20 text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase">{trip.status.replace('_', ' ')}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 bg-white/10 rounded-xl p-3 text-center">
          <div><div className="text-white/60 text-[10px]">Planned</div><div className="text-white text-[14px] font-bold">{formatDate(trip.planned_start, 'HH:mm')}</div></div>
          <div><div className="text-white/60 text-[10px]">Stops</div><div className="text-white text-[14px] font-bold">{stops.length}</div></div>
          <div><div className="text-white/60 text-[10px]">Done</div><div className="text-white text-[14px] font-bold">{doneStops.length}</div></div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-[13px]">{error}</div>}

        {/* Start Trip */}
        {trip.status === 'assigned' && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-[15px] mb-1">Ready to Start?</h3>
            <p className="text-[12px] text-gray-400 mb-3">Record your opening odometer before departing</p>
            <div className="mb-3">
              <label className="text-[12px] font-semibold text-gray-600 block mb-1">Opening Odometer (km) *</label>
              <input type="number" className="form-control" placeholder={`Vehicle shows: ${trip.vehicle?.current_odometer?.toLocaleString() ?? '—'} km`}
                value={odometer} onChange={e => setOdometer(e.target.value)} />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 text-[12px] text-amber-700">
              ⚠️ Make sure the odometer reading matches the vehicle dashboard
            </div>
            <button onClick={startTrip} disabled={actionLoading === 'start'}
              className="w-full bg-primary-700 text-white font-bold py-3 rounded-xl text-[14px] disabled:opacity-60">
              {actionLoading === 'start' ? 'Starting…' : '🚀 Start Trip'}
            </button>
          </div>
        )}

        {/* Trip Info when in progress */}
        {trip.status === 'in_progress' && trip.opening_odometer && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex justify-between items-center">
            <div className="text-[12px] text-blue-700">
              <div className="font-bold">Trip Started</div>
              <div>{formatDate(trip.actual_start, 'HH:mm dd MMM')}</div>
            </div>
            <div className="text-right text-[12px] text-blue-700">
              <div className="font-bold">Opening Odo</div>
              <div>{trip.opening_odometer?.toLocaleString()} km</div>
            </div>
          </div>
        )}

        {/* Delivery Stops */}
        {stops.length > 0 && (
          <div>
            <h3 className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2">Delivery Stops</h3>
            {stops.map((stop: any) => (
              <div key={stop.id} className={`bg-white rounded-xl p-4 mb-2.5 border shadow-sm ${stop.delivery_status === 'delivered' ? 'border-green-200 bg-green-50' : stop.delivery_status === 'failed' ? 'border-red-200 bg-red-50' : stop.delivery_status === 'partial' ? 'border-amber-200 bg-amber-50' : 'border-gray-100'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white ${stop.delivery_status === 'delivered' ? 'bg-green-500' : stop.delivery_status === 'failed' ? 'bg-red-500' : stop.delivery_status === 'partial' ? 'bg-amber-500' : 'bg-gray-300'}`}>
                      {stop.delivery_status === 'delivered' ? '✓' : stop.delivery_status === 'failed' ? '✗' : stop.delivery_status === 'partial' ? '~' : stop.sequence}
                    </div>
                    <div>
                      <div className="font-semibold text-[13.5px]">{stop.destination_name}</div>
                      {stop.address && <div className="text-[11.5px] text-gray-500">{stop.address}</div>}
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold uppercase ${stop.delivery_status === 'delivered' ? 'text-green-600' : stop.delivery_status === 'failed' ? 'text-red-600' : stop.delivery_status === 'partial' ? 'text-amber-600' : 'text-gray-400'}`}>
                    {stop.delivery_status}
                  </span>
                </div>

                {stop.contact_name && (
                  <div className="text-[12px] text-gray-500 mb-2 ml-9">📞 {stop.contact_name} {stop.contact_phone}</div>
                )}
                {stop.expected_arrival && (
                  <div className="text-[12px] text-gray-500 mb-2 ml-9">🕐 ETA {formatDate(stop.expected_arrival, 'HH:mm')}</div>
                )}
                {stop.actual_arrival && (
                  <div className="text-[12px] text-green-600 mb-2 ml-9">✅ Arrived {formatDate(stop.actual_arrival, 'HH:mm')}</div>
                )}

                {trip.status === 'in_progress' && stop.delivery_status === 'pending' && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      className="w-full text-[12px] border border-gray-200 rounded-lg p-2 resize-none"
                      rows={2} placeholder="Notes (optional)..."
                      value={stopNotes[stop.id] || ''}
                      onChange={e => setStopNotes(prev => ({ ...prev, [stop.id]: e.target.value }))}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => markStop(stop.id, 'delivered')} disabled={actionLoading === stop.id}
                        className="bg-green-600 text-white font-bold py-2 rounded-xl text-[12px] disabled:opacity-60">
                        ✓ Delivered
                      </button>
                      <button onClick={() => markStop(stop.id, 'partial')} disabled={actionLoading === stop.id}
                        className="bg-amber-500 text-white font-bold py-2 rounded-xl text-[12px] disabled:opacity-60">
                        ~ Partial
                      </button>
                      <button onClick={() => markStop(stop.id, 'failed')} disabled={actionLoading === stop.id}
                        className="bg-red-500 text-white font-bold py-2 rounded-xl text-[12px] disabled:opacity-60">
                        ✗ Failed
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* No stops — can still complete */}
        {trip.status === 'in_progress' && stops.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[13px] text-blue-700 text-center">
            No delivery stops — complete trip when done
          </div>
        )}

        {/* Complete Trip */}
        {trip.status === 'in_progress' && pendingStops.length === 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200">
            <h3 className="font-bold text-[15px] mb-1">Complete Trip</h3>
            <p className="text-[12px] text-gray-400 mb-3">All stops done — record closing odometer</p>
            <div className="mb-3">
              <label className="text-[12px] font-semibold text-gray-600 block mb-1">Closing Odometer (km) *</label>
              <input type="number" className="form-control" placeholder={`Must be ≥ ${trip.opening_odometer?.toLocaleString() ?? '0'} km`}
                value={closingOdo} onChange={e => setClosingOdo(e.target.value)} />
            </div>
            {closingOdo && trip.opening_odometer && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 mb-3 text-[12px] text-green-700">
                Distance: {(parseInt(closingOdo) - trip.opening_odometer).toLocaleString()} km
              </div>
            )}
            <button onClick={completeTrip} disabled={actionLoading === 'complete'}
              className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-[14px] disabled:opacity-60">
              {actionLoading === 'complete' ? 'Completing…' : '✅ Complete Trip'}
            </button>
          </div>
        )}

        {/* Completed state */}
        {trip.status === 'completed' && (
          <div className="bg-green-50 rounded-xl p-5 text-center border border-green-200">
            <div className="text-4xl mb-2">✅</div>
            <div className="font-bold text-green-700 text-[16px]">Trip Completed!</div>
            <div className="text-[13px] text-green-600 mt-1">{formatDate(trip.actual_end, 'HH:mm dd MMM')}</div>
            {trip.total_distance && (
              <div className="text-[13px] text-green-600 mt-1">Distance: {trip.total_distance.toLocaleString()} km</div>
            )}
          </div>
        )}
        <div className="h-6"/>
      </div>
    </div>
  )
}

export default function DriverTripPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/></div>}>
      <DriverTripPageInner />
    </Suspense>
  )
}
