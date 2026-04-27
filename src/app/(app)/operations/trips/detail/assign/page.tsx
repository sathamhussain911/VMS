'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatDate, expiryStatus, vehicleStatusColour } from '@/lib/utils'

export default function AssignTripPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const router = useRouter()
  const supabase = createClient()
  const [trip, setTrip] = useState<any>(null)
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [selectedDriver, setSelectedDriver] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('trips').select('*, branch:branches(name)').eq('id',id).single(),
      supabase.from('vehicles').select('id,vehicle_number,vehicle_type,make,model,status,mulkiya_expiry,insurance_expiry,branch:branches(name)').eq('status','available').is('deleted_at',null).order('vehicle_number'),
      supabase.from('drivers').select('id,full_name,employee_id,duty_status,performance_score,branch:branches(name)').eq('status','active').eq('duty_status','on_duty').order('full_name'),
    ]).then(([t,v,d]) => { setTrip(t.data); setVehicles(v.data??[]); setDrivers(d.data??[]); setPageLoading(false) })
  }, [id])

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if(!selectedVehicle||!selectedDriver){setError('Select both vehicle and driver');return}
    setLoading(true); setError('')
    const { data:{user} } = await supabase.auth.getUser()
    const { error:err } = await supabase.from('trips').update({ vehicle_id:selectedVehicle, driver_id:selectedDriver, status:'assigned' }).eq('id',id)
    if(err){setError(err.message);setLoading(false);return}
    await supabase.from('trip_events').insert({ trip_id:id, event_type:'assignment', from_status:trip?.status, to_status:'assigned', actor_id:user?.id })
    await supabase.from('vehicles').update({ status:'assigned' }).eq('id',selectedVehicle)
    router.push(`/operations/trips/detail?id=${id}`)
  }

  if(pageLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/></div>

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href={`/operations/trips/detail?id=${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Trip {trip?.trip_number}</Link>
          <div><h1 className="page-title">Assign Vehicle & Driver</h1><p className="page-subtitle">{trip?.branch?.name} · {formatDate(trip?.planned_start,'dd MMM HH:mm')}</p></div>
        </div>
      </div>

      {error && <div className="alert alert-red mb-4"><p className="text-sm text-red-700">{error}</p></div>}

      <form onSubmit={handleAssign} className="space-y-4">
        <div className="card">
          <div className="card-header"><span className="card-title">Select Vehicle</span><span className="text-[12px] text-gray-400">{vehicles.length} available</span></div>
          <div className="card-body">
            {vehicles.length===0?<div className="text-center py-6 text-amber-600 text-sm font-medium">⚠️ No available vehicles right now</div>
            :<div className="space-y-2 max-h-64 overflow-y-auto">
              {vehicles.map(v=>{
                const hasIssue=['expired','critical'].includes(expiryStatus(v.mulkiya_expiry))||['expired','critical'].includes(expiryStatus(v.insurance_expiry))
                return (
                  <label key={v.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedVehicle===v.id?'border-primary-500 bg-primary-50':'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="vehicle" value={v.id} checked={selectedVehicle===v.id} onChange={()=>setSelectedVehicle(v.id)} className="accent-primary-700"/>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[13.5px]">{v.vehicle_number}</span>
                        <span className={`badge ${vehicleStatusColour[v.status]} text-[11px]`}>{v.status}</span>
                        {hasIssue&&<span className="badge bg-red-100 text-red-700 text-[11px]">⚠ Doc Issue</span>}
                      </div>
                      <div className="text-[12px] text-gray-500">{v.make} {v.model} · {v.branch?.name}</div>
                    </div>
                  </label>
                )
              })}
            </div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Select Driver</span><span className="text-[12px] text-gray-400">{drivers.length} on duty</span></div>
          <div className="card-body">
            {drivers.length===0?<div className="text-center py-6 text-amber-600 text-sm font-medium">⚠️ No drivers on duty right now</div>
            :<div className="space-y-2 max-h-64 overflow-y-auto">
              {drivers.map(d=>(
                <label key={d.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedDriver===d.id?'border-primary-500 bg-primary-50':'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="driver" value={d.id} checked={selectedDriver===d.id} onChange={()=>setSelectedDriver(d.id)} className="accent-primary-700"/>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[13.5px]">{d.full_name}</span>
                      <span className="text-[12px] text-primary-700 font-bold">Score: {d.performance_score?.toFixed(0)??'—'}</span>
                    </div>
                    <div className="text-[12px] text-gray-500">{d.employee_id??'—'} · {d.branch?.name}</div>
                  </div>
                </label>
              ))}
            </div>}
          </div>
        </div>

        <div className="flex gap-3">
          <Link href={`/operations/trips/detail?id=${id}`} className="btn btn-secondary">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={loading||!selectedVehicle||!selectedDriver}>
            {loading?'Assigning…':'Confirm Assignment'}
          </button>
        </div>
      </form>
    </div>
  )
}
