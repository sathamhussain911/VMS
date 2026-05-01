'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

function DriverTripInner() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const router = useRouter()
  const supabase = createClient()
  const [trip, setTrip] = useState<any>(null)
  const [driver, setDriver] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [odometer, setOdometer] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadTrip() }, [id])

  async function loadTrip() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: t }, { data: d }] = await Promise.all([
      supabase.from('trips')
        .select('id,trip_number,status,planned_start,actual_start,actual_end,opening_odometer,closing_odometer,notes,vehicle:vehicles(id,vehicle_number,make,model,current_odometer),branch:branches(name),stops:trip_stops(*)')
        .eq('id', id)
        .maybeSingle(),
      user ? supabase.from('drivers').select('id,full_name').eq('auth_user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    ])
    if (t) setTrip(t)
    if (d) setDriver(d)
    setLoading(false)
  }

  async function startTrip() {
    if (!odometer.trim()) { setError('Please enter opening odometer reading'); return }
    const odoNum = parseInt(odometer)
    if (isNaN(odoNum) || odoNum < 0) { setError('Enter a valid odometer reading'); return }
    setError(''); setActionLoading('start')
    const { error: err } = await supabase.from('trips').update({
      status: 'in_progress',
      actual_start: new Date().toISOString(),
      opening_odometer: odoNum,
    }).eq('id', id)
    if (!err) {
      await supabase.from('trip_events').insert({ trip_id: id, event_type: 'status_change', from_status: 'assigned', to_status: 'in_progress' })
    }
    setActionLoading('')
    loadTrip()
  }

  async function markStop(stopId: string, status: 'delivered' | 'partial' | 'failed') {
    setActionLoading(stopId)
    await supabase.from('trip_stops').update({
      delivery_status: status,
      actual_arrival: new Date().toISOString(),
    }).eq('id', stopId)
    setActionLoading('')
    loadTrip()
  }

  async function completeTrip() {
    if (!odometer.trim()) { setError('Please enter closing odometer reading'); return }
    const odoNum = parseInt(odometer)
    if (isNaN(odoNum) || odoNum <= (trip.opening_odometer ?? 0)) {
      setError('Closing odometer must be greater than opening odometer')
      return
    }
    const pending = trip.stops?.filter((s: any) => s.delivery_status === 'pending') ?? []
    if (pending.length > 0) {
      setError(`${pending.length} stop${pending.length > 1 ? 's' : ''} not yet marked — please complete all stops first`)
      return
    }
    setError(''); setActionLoading('complete')
    const dist = odoNum - (trip.opening_odometer ?? 0)
    await supabase.from('trips').update({
      status: 'completed',
      actual_end: new Date().toISOString(),
      closing_odometer: odoNum,
      total_distance: dist > 0 ? dist : null,
    }).eq('id', id)
    await supabase.from('trip_events').insert({ trip_id: id, event_type: 'status_change', from_status: 'in_progress', to_status: 'completed' })
    // Update vehicle odometer
    if (trip.vehicle?.id && odoNum > (trip.vehicle.current_odometer ?? 0)) {
      await supabase.from('vehicles').update({ current_odometer: odoNum, status: 'available' }).eq('id', trip.vehicle.id)
    }
    router.push('/driver')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin mx-auto mb-2"/>
          <p className="text-gray-400 text-[13px]">Loading trip…</p>
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-4xl mb-3">🔍</div>
          <div className="font-semibold text-gray-700">Trip not found</div>
          <button onClick={() => router.push('/driver')} className="mt-4 btn btn-primary btn-sm">← Back Home</button>
        </div>
      </div>
    )
  }

  const stops = [...(trip.stops ?? [])].sort((a: any, b: any) => a.sequence - b.sequence)
  const doneStops = stops.filter((s: any) => s.delivery_status !== 'pending')
  const pendingStops = stops.filter((s: any) => s.delivery_status === 'pending')
  const progress = stops.length > 0 ? (doneStops.length / stops.length) * 100 : 0

  const headerBg = trip.status === 'in_progress' ? '#1d4ed8' : trip.status === 'completed' ? '#15803d' : '#14532d'

  return (
    <div className="min-h-screen bg-gray-100 pb-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div className="px-4 pt-10 pb-5" style={{ background: headerBg }}>
        <button onClick={() => router.back()} className="text-white/60 text-[13px] mb-3 flex items-center gap-1">
          ← Back
        </button>
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-white font-extrabold text-[22px]">{trip.trip_number}</div>
            <div className="text-white/70 text-[13px] mt-0.5">
              {trip.vehicle?.vehicle_number} — {trip.branch?.name}
            </div>
          </div>
          <span className="bg-white/20 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase">
            {trip.status.replace('_', ' ')}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 bg-white/10 rounded-xl p-3 text-center text-white mb-3">
          <div>
            <div className="text-white/60 text-[10px] mb-0.5">Planned</div>
            <div className="font-bold text-[14px]">{formatDate(trip.planned_start, 'HH:mm')}</div>
          </div>
          <div>
            <div className="text-white/60 text-[10px] mb-0.5">Stops</div>
            <div className="font-bold text-[14px]">{stops.length}</div>
          </div>
          <div>
            <div className="text-white/60 text-[10px] mb-0.5">Done</div>
            <div className="font-bold text-[14px]">{doneStops.length}</div>
          </div>
        </div>
        {/* Progress bar */}
        {stops.length > 0 && (
          <div className="h-1.5 bg-white/20 rounded-full">
            <div className="h-1.5 bg-white rounded-full transition-all duration-500" style={{ width: `${progress}%` }}/>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[13px] text-red-700 flex items-start gap-2">
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400">×</button>
          </div>
        )}

        {/* Start trip */}
        {(trip.status === 'assigned' || trip.status === 'approved') && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-[15px] mb-3">🚀 Start Trip</h3>
            <div className="mb-3">
              <label className="form-label text-[12px]">Opening Odometer (km) *</label>
              <input type="number" inputMode="numeric" className="form-control text-[16px]"
                placeholder={`Current: ${trip.vehicle?.current_odometer?.toLocaleString() ?? 'N/A'}`}
                value={odometer} onChange={e => { setOdometer(e.target.value); setError('') }}/>
            </div>
            <button onClick={startTrip} disabled={actionLoading === 'start' || !odometer}
              className="w-full font-bold py-3.5 rounded-xl text-[14px] text-white disabled:opacity-50 transition-opacity"
              style={{ background: '#15803d' }}>
              {actionLoading === 'start' ? '⏳ Starting…' : '🚀 Start Trip'}
            </button>
          </div>
        )}

        {/* Delivery stops */}
        {stops.length > 0 && (
          <div>
            <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-2.5">
              Delivery Stops ({doneStops.length}/{stops.length})
            </h3>
            {stops.map((stop: any) => {
              const isDone = stop.delivery_status !== 'pending'
              const isPartial = stop.delivery_status === 'partial'
              const isFailed = stop.delivery_status === 'failed'
              return (
                <div key={stop.id} className={`bg-white rounded-2xl p-4 mb-3 border shadow-sm ${isDone ? (isFailed ? 'border-red-200 bg-red-50' : isPartial ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50') : 'border-gray-100'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0
                        ${isDone ? (isFailed ? 'bg-red-500' : isPartial ? 'bg-amber-500' : 'bg-green-500') : 'bg-gray-300'}`}>
                        {isDone ? (isFailed ? '✗' : isPartial ? '~' : '✓') : stop.sequence}
                      </div>
                      <div>
                        <div className="font-semibold text-[14px] text-gray-800">{stop.destination_name}</div>
                        {stop.address && <div className="text-[11.5px] text-gray-400">{stop.address}</div>}
                      </div>
                    </div>
                    {isDone && (
                      <span className={`text-[10px] font-bold ${isFailed ? 'text-red-600' : isPartial ? 'text-amber-600' : 'text-green-600'}`}>
                        {stop.delivery_status.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {stop.contact_name && (
                    <div className="text-[12px] text-gray-500 ml-9 mb-2">📞 {stop.contact_name}{stop.contact_phone ? ` · ${stop.contact_phone}` : ''}</div>
                  )}
                  {stop.notes && (
                    <div className="text-[12px] text-blue-600 ml-9 mb-2">📝 {stop.notes}</div>
                  )}
                  {trip.status === 'in_progress' && stop.delivery_status === 'pending' && (
                    <div className="grid grid-cols-3 gap-2 mt-3 ml-9">
                      <button onClick={() => markStop(stop.id, 'delivered')} disabled={actionLoading === stop.id}
                        className="py-2 rounded-xl text-[12px] font-bold text-white disabled:opacity-50"
                        style={{ background: '#15803d' }}>
                        {actionLoading === stop.id ? '…' : '✓ Delivered'}
                      </button>
                      <button onClick={() => markStop(stop.id, 'partial')} disabled={actionLoading === stop.id}
                        className="py-2 rounded-xl text-[12px] font-bold text-white bg-amber-500 disabled:opacity-50">
                        ~ Partial
                      </button>
                      <button onClick={() => markStop(stop.id, 'failed')} disabled={actionLoading === stop.id}
                        className="py-2 rounded-xl text-[12px] font-bold text-white bg-red-500 disabled:opacity-50">
                        ✗ Failed
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Complete trip */}
        {trip.status === 'in_progress' && pendingStops.length === 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-200">
            <h3 className="font-bold text-[15px] text-green-700 mb-3">🏁 Complete Trip</h3>
            <div className="mb-3">
              <label className="form-label text-[12px]">Closing Odometer (km) *</label>
              <input type="number" inputMode="numeric" className="form-control text-[16px]"
                placeholder="Enter final odometer reading"
                value={odometer} onChange={e => { setOdometer(e.target.value); setError('') }}/>
              {trip.opening_odometer && (
                <div className="text-[11px] text-gray-400 mt-1">Opening was: {trip.opening_odometer.toLocaleString()} km</div>
              )}
            </div>
            <button onClick={completeTrip} disabled={actionLoading === 'complete' || !odometer}
              className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl text-[14px] disabled:opacity-50">
              {actionLoading === 'complete' ? '⏳ Completing…' : '🏁 Complete Trip'}
            </button>
          </div>
        )}

        {/* Pending stops warning */}
        {trip.status === 'in_progress' && pendingStops.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[13px] text-amber-700 text-center">
            {pendingStops.length} stop{pendingStops.length > 1 ? 's' : ''} remaining before you can complete the trip
          </div>
        )}

        {/* Completed summary */}
        {trip.status === 'completed' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <div className="text-green-700 font-bold text-[15px] mb-3">✅ Trip Completed</div>
            <div className="grid grid-cols-2 gap-3 text-center">
              {[
                { label: 'Distance', value: trip.total_distance ? `${trip.total_distance} km` : '—' },
                { label: 'Duration', value: trip.actual_start && trip.actual_end
                  ? `${Math.round((new Date(trip.actual_end).getTime() - new Date(trip.actual_start).getTime()) / 60000)} min` : '—' },
                { label: 'Completed', value: formatDate(trip.actual_end, 'HH:mm dd MMM') },
                { label: 'Stops Done', value: `${doneStops.length}/${stops.length}` },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-xl p-3">
                  <div className="text-[11px] text-gray-400">{s.label}</div>
                  <div className="font-bold text-[14px] text-green-700">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DriverTripDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/>
      </div>
    }>
      <DriverTripInner/>
    </Suspense>
  )
}
