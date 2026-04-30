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

  useEffect(() => {
    if (!id) { setLoading(false); return }
    supabase.from('trips')
      .select('*,branch:branches(name),vehicle:vehicles(id,vehicle_number,make,model),driver:drivers(id,full_name,mobile),requester:users(full_name),stops:trip_stops(*),events:trip_events(*,actor:users(full_name))')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setFetchError(error.message)
        setTrip(data)
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/></div>
  if (fetchError) return <div className="p-8 text-center text-red-400">Error: {fetchError}</div>
  if (!trip) return <div className="p-8 text-center text-gray-400">Trip not found. <Link href="/operations/trips" className="text-primary-700 underline">Back to trips</Link></div>

  const stops = (trip.stops ?? []).sort((a: any, b: any) => a.sequence - b.sequence)
  const events = (trip.events ?? []).sort((a: any, b: any) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
  const canAssign = ['requested', 'approved'].includes(trip.status)

  const STOP_STATUS: Record<string, string> = { delivered: 'bg-green-100 text-green-700', pending: 'bg-gray-100 text-gray-500', partial: 'bg-amber-100 text-amber-700', failed: 'bg-red-100 text-red-700' }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/operations/trips" className="text-gray-400 hover:text-gray-600 text-sm">← Trips</Link>
          <div><h1 className="page-title">{trip.trip_number}</h1><p className="page-subtitle">{trip.branch?.name} · {formatDate(trip.created_at)}</p></div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canAssign && <Link href={`/operations/trips/detail/assign?id=${id}`} className="btn btn-primary">Assign Vehicle & Driver</Link>}
          <span className={`badge ${tripStatusColour[trip.status]} text-[13px] px-4`}>{trip.status.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
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
                { label: 'Vehicle', value: trip.vehicle ? `${trip.vehicle.vehicle_number}` : null },
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

          <div className="card">
            <div className="card-header">
              <span className="card-title">Delivery Stops</span>
              <span className="text-[12px] text-gray-400">{stops.filter((s: any) => s.delivery_status === 'delivered').length}/{stops.length} delivered</span>
            </div>
            <div className="divide-y divide-gray-100">
              {stops.length === 0
                ? <div className="p-6 text-center text-gray-400 text-sm">No stops added</div>
                : stops.map((stop: any, i: number) => (
                  <div key={stop.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${stop.delivery_status === 'delivered' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                          {stop.delivery_status === 'delivered' ? '✓' : i + 1}
                        </div>
                        <span className="font-semibold text-[14px]">{stop.destination_name}</span>
                      </div>
                      <span className={`badge ${STOP_STATUS[stop.delivery_status]}`}>{stop.delivery_status}</span>
                    </div>
                    {stop.address && <div className="text-[12.5px] text-gray-500 ml-9">{stop.address}</div>}
                    <div className="flex gap-4 mt-1 ml-9 text-[12px] text-gray-400 flex-wrap">
                      {stop.contact_name && <span>👤 {stop.contact_name}</span>}
                      {stop.expected_arrival && <span>🕐 ETA {formatDate(stop.expected_arrival, 'HH:mm')}</span>}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

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
                        : <span className="capitalize">{ev.event_type}</span>}
                    </div>
                    {ev.actor?.full_name && <div className="text-[11.5px] text-gray-400">by {ev.actor.full_name}</div>}
                  </div>
                </div>
              ))}
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
