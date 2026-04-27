'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export default function DriverTripPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const router = useRouter()
  const supabase = createClient()
  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [odometer, setOdometer] = useState('')
  const [actionLoading, setActionLoading] = useState('')

  useEffect(() => { loadTrip() }, [id])

  async function loadTrip() {
    const { data } = await supabase.from('trips')
      .select('*, stops:trip_stops(*), vehicle:vehicles(vehicle_number,make,model,current_odometer), branch:branches(name)')
      .eq('id',id).single()
    if(data) setTrip(data)
    setLoading(false)
  }

  async function startTrip() {
    if(!odometer){alert('Enter opening odometer reading');return}
    setActionLoading('start')
    await supabase.from('trips').update({ status:'in_progress', actual_start:new Date().toISOString(), opening_odometer:parseInt(odometer) }).eq('id',id)
    await supabase.from('trip_events').insert({ trip_id:id, event_type:'status_change', from_status:'assigned', to_status:'in_progress' })
    loadTrip(); setActionLoading('')
  }

  async function markDelivered(stopId:string) {
    setActionLoading(stopId)
    await supabase.from('trip_stops').update({ delivery_status:'delivered', actual_arrival:new Date().toISOString() }).eq('id',stopId)
    loadTrip(); setActionLoading('')
  }

  async function completeTrip() {
    if(!odometer){alert('Enter closing odometer reading');return}
    const pending=trip.stops.filter((s:any)=>s.delivery_status==='pending')
    if(pending.length>0){alert(`${pending.length} stop(s) not yet delivered`);return}
    setActionLoading('complete')
    await supabase.from('trips').update({ status:'completed', actual_end:new Date().toISOString(), closing_odometer:parseInt(odometer) }).eq('id',id)
    await supabase.from('trip_events').insert({ trip_id:id, event_type:'status_change', from_status:'in_progress', to_status:'completed' })
    router.push('/driver'); setActionLoading('')
  }

  if(loading) return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/></div>
  if(!trip) return <div className="p-4 text-center text-gray-400">Trip not found</div>

  const pendingStops=trip.stops?.filter((s:any)=>s.delivery_status==='pending')??[]
  const doneStops=trip.stops?.filter((s:any)=>s.delivery_status==='delivered')??[]
  const bgColour=trip.status==='in_progress'?'bg-blue-600':trip.status==='completed'?'bg-green-600':'bg-primary-800'

  return (
    <div className="min-h-screen bg-gray-100" style={{fontFamily:"'Plus Jakarta Sans',sans-serif",maxWidth:430,margin:'0 auto'}}>
      <div className={`px-4 pt-10 pb-5 ${bgColour}`}>
        <button onClick={()=>router.back()} className="text-white/70 text-[13px] mb-3 flex items-center gap-1">← Back</button>
        <div className="flex justify-between items-start">
          <div><div className="text-white font-extrabold text-[20px]">{trip.trip_number}</div><div className="text-white/70 text-[13px] mt-0.5">{trip.vehicle?.vehicle_number} — {trip.branch?.name}</div></div>
          <span className="bg-white/20 text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase">{trip.status.replace('_',' ')}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 bg-white/10 rounded-xl p-3 text-center">
          <div><div className="text-white/60 text-[10px]">Planned</div><div className="text-white text-[14px] font-bold">{formatDate(trip.planned_start,'HH:mm')}</div></div>
          <div><div className="text-white/60 text-[10px]">Stops</div><div className="text-white text-[14px] font-bold">{trip.stops?.length??0}</div></div>
          <div><div className="text-white/60 text-[10px]">Done</div><div className="text-white text-[14px] font-bold">{doneStops.length}</div></div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {trip.status==='assigned'&&(
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-[14px] mb-3">Start Trip</h3>
            <div className="mb-3"><label className="form-label text-[12px]">Opening Odometer (km) *</label><input type="number" className="form-control" placeholder={`Current: ${trip.vehicle?.current_odometer?.toLocaleString()}`} value={odometer} onChange={e=>setOdometer(e.target.value)}/></div>
            <button onClick={startTrip} disabled={actionLoading==='start'} className="w-full bg-primary-700 text-white font-bold py-3 rounded-xl text-[14px] disabled:opacity-60">{actionLoading==='start'?'Starting…':'🚀 Start Trip'}</button>
          </div>
        )}

        <div>
          <h3 className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2">Delivery Stops</h3>
          {(trip.stops??[]).sort((a:any,b:any)=>a.sequence-b.sequence).map((stop:any)=>(
            <div key={stop.id} className={`bg-white rounded-xl p-4 mb-2.5 border shadow-sm ${stop.delivery_status==='delivered'?'border-green-200 bg-green-50':'border-gray-100'}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${stop.delivery_status==='delivered'?'bg-green-500':'bg-gray-300'}`}>{stop.delivery_status==='delivered'?'✓':stop.sequence}</div>
                  <span className="font-semibold text-[13.5px]">{stop.destination_name}</span>
                </div>
                {stop.delivery_status==='delivered'&&<span className="text-green-600 text-[11px] font-bold">DELIVERED</span>}
              </div>
              {stop.address&&<div className="text-[12px] text-gray-500 mb-1 ml-8">{stop.address}</div>}
              {stop.contact_name&&<div className="text-[12px] text-gray-500 mb-2 ml-8">📞 {stop.contact_name} {stop.contact_phone}</div>}
              {trip.status==='in_progress'&&stop.delivery_status==='pending'&&(
                <button onClick={()=>markDelivered(stop.id)} disabled={actionLoading===stop.id} className="w-full mt-3 bg-primary-700 text-white font-bold py-2.5 rounded-xl text-[13px] disabled:opacity-60">{actionLoading===stop.id?'Marking…':'📷 Mark Delivered'}</button>
              )}
            </div>
          ))}
        </div>

        {trip.status==='in_progress'&&pendingStops.length===0&&(
          <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200">
            <h3 className="font-bold text-[14px] mb-3">Complete Trip</h3>
            <div className="mb-3"><label className="form-label text-[12px]">Closing Odometer (km) *</label><input type="number" className="form-control" placeholder="Enter closing reading" value={odometer} onChange={e=>setOdometer(e.target.value)}/></div>
            <button onClick={completeTrip} disabled={actionLoading==='complete'} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-[14px] disabled:opacity-60">{actionLoading==='complete'?'Completing…':'✅ Complete Trip'}</button>
          </div>
        )}

        {trip.status==='completed'&&(
          <div className="bg-green-50 rounded-xl p-5 text-center border border-green-200">
            <div className="text-4xl mb-2">✅</div>
            <div className="font-bold text-green-700 text-[16px]">Trip Completed!</div>
            <div className="text-[13px] text-green-600 mt-1">{formatDate(trip.actual_end,'HH:mm')}</div>
          </div>
        )}
        <div className="h-4"/>
      </div>
    </div>
  )
}
