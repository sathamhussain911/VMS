'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, vehicleStatusColour, tripStatusColour } from '@/lib/utils'

const TIME_SLOTS = ['06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21']

export default function DispatchPage() {
  const supabase = createClient()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadBoard() }, [date])

  async function loadBoard() {
    setLoading(true)
    const [vRes, dRes, tRes] = await Promise.all([
      supabase.from('vehicles').select('id,vehicle_number,vehicle_type,make,model,status,branch:branches(name)').neq('status','inactive').is('deleted_at',null).order('vehicle_number'),
      supabase.from('drivers').select('id,full_name,duty_status,performance_score,branch:branches(name)').eq('status','active').order('full_name'),
      supabase.from('trips').select('id,trip_number,status,planned_start,planned_end,vehicle_id,driver_id,cargo_description,branch:branches(name),vehicles(vehicle_number),drivers(full_name)')
        .gte('planned_start',`${date}T00:00:00`).lte('planned_start',`${date}T23:59:59`).not('status','in','(cancelled)').is('deleted_at',null),
    ])
    setVehicles(vRes.data??[]); setDrivers(dRes.data??[]); setTrips(tRes.data??[])
    setLoading(false)
  }

  const pending = trips.filter(t=>['requested','approved'].includes(t.status))
  const assigned = trips.filter(t=>!['requested','approved','cancelled'].includes(t.status))

  const TRIP_COLOUR:Record<string,string> = {
    in_progress:'bg-blue-100 text-blue-800 border-blue-200',
    assigned:'bg-sky-100 text-sky-800 border-sky-200',
    completed:'bg-green-100 text-green-800 border-green-200',
    delayed:'bg-amber-100 text-amber-800 border-amber-200',
  }

  function tripsAtHour(vehicleId:string, hour:number) {
    return assigned.filter((t:any) => {
      if(t.vehicle_id!==vehicleId) return false
      const start=new Date(t.planned_start)
      const end=t.planned_end?new Date(t.planned_end):new Date(start.getTime()+4*3600000)
      return start.getHours()<=hour && end.getHours()>hour
    })
  }

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Dispatch Planning Board</h1><p className="page-subtitle">{formatDate(date,'EEEE dd MMM yyyy')}</p></div>
        <div className="flex gap-2 items-center">
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="form-control h-9 w-auto"/>
          <Link href="/operations/trips/new" className="btn btn-primary">+ New Trip</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[{label:'Available Vehicles',value:vehicles.filter(v=>v.status==='available').length,colour:'blue'},
          {label:'Drivers On Duty',value:drivers.filter(d=>d.duty_status==='on_duty').length,colour:'amber'},
          {label:'Trips Dispatched',value:assigned.length,colour:'green'},
          {label:'Pending Dispatch',value:pending.length,colour:pending.length>0?'red':'green'}]
          .map((m,i)=><div key={i} className={`metric-card ${m.colour}`}><span className="metric-label">{m.label}</span><span className="metric-value">{loading?'…':m.value}</span></div>)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <div className="xl:col-span-1 card">
          <div className="card-header"><span className="card-title">Pending Requests</span>{pending.length>0&&<span className="badge bg-red-100 text-red-700">{pending.length}</span>}</div>
          <div className="divide-y divide-gray-100">
            {loading?<div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
            :pending.length===0?<div className="p-6 text-center text-gray-400 text-sm">All dispatched ✓</div>
            :pending.map((t:any)=>(
              <div key={t.id} className="p-3.5 hover:bg-gray-50">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-[12px] bg-gray-100 px-1.5 py-0.5 rounded">{t.trip_number}</span>
                  <span className={`badge ${tripStatusColour[t.status]}`}>{t.status}</span>
                </div>
                <div className="text-[12.5px] text-gray-600 mb-1">{t.branch?.name}</div>
                <div className="text-[12px] text-gray-400 mb-2">{formatDate(t.planned_start,'HH:mm')} · {t.cargo_description?.slice(0,25)??'—'}</div>
                <Link href={`/operations/trips/detail/assign?id=${t.id}`} className="btn btn-primary btn-sm w-full justify-center">Assign →</Link>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-3 card overflow-x-auto">
          <div className="card-header"><span className="card-title">Vehicle Timeline — 06:00 to 22:00</span></div>
          <div style={{minWidth:900}}>
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-bold text-gray-500 border border-gray-200 w-44">Vehicle</th>
                  {TIME_SLOTS.map(h=><th key={h} className="px-1 py-2 font-bold text-gray-400 border border-gray-200 text-center w-12">{h}:00</th>)}
                </tr>
              </thead>
              <tbody>
                {loading?<tr><td colSpan={TIME_SLOTS.length+1} className="text-center py-10 text-gray-400">Loading…</td></tr>
                :vehicles.map(v=>(
                  <tr key={v.id}>
                    <td className="px-3 py-2 border border-gray-200 bg-gray-50">
                      <div className="font-semibold text-[12.5px]">{v.vehicle_number}</div>
                      <div className="text-[10.5px] text-gray-400">{v.make} {v.model}</div>
                      <span className={`badge mt-0.5 text-[10px] ${vehicleStatusColour[v.status]}`}>{v.status}</span>
                    </td>
                    {TIME_SLOTS.map(h=>{
                      const hour=parseInt(h)
                      const hTrips=tripsAtHour(v.id,hour)
                      return (
                        <td key={h} className="border border-gray-200 p-0.5 align-top">
                          {hTrips.map((t:any)=>(
                            <Link key={t.id} href={`/operations/trips/detail?id=${t.id}`}>
                              <div className={`rounded p-1 text-[10px] font-semibold mb-0.5 border ${TRIP_COLOUR[t.status]??'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                <div>{t.trip_number}</div>
                                <div className="font-normal opacity-70">{(t.drivers?.full_name??'').split(' ')[0]}</div>
                              </div>
                            </Link>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
