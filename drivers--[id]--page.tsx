'use client'

export function generateStaticParams() { return [] }
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, expiryStatus, expiryLabel, expiryStatusColour, driverStatusColour, tripStatusColour } from '@/lib/utils'

export default function DriverDetailPage() {
  const { id } = useParams<{id:string}>()
  const supabase = createClient()
  const [driver, setDriver] = useState<any>(null)
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('drivers').select('*, branch:branches(*)').eq('id',id).single(),
      supabase.from('trips').select('id,trip_number,status,planned_start,vehicle:vehicles(vehicle_number)').eq('driver_id',id).is('deleted_at',null).order('planned_start',{ascending:false}).limit(8),
    ]).then(([d,t]) => { setDriver(d.data); setTrips(t.data??[]); setLoading(false) })
  }, [id])

  if(loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/></div>
  if(!driver) return <div className="p-8 text-center text-gray-400">Driver not found</div>

  const score=driver.performance_score??0
  const scoreColour=score>=80?'text-primary-700':score>=60?'text-amber-600':'text-red-600'
  const docs=[{label:'Emirates ID',expiry:driver.eid_expiry,number:driver.eid_number},{label:'Driving License',expiry:driver.license_expiry,number:driver.license_number},{label:'Passport',expiry:driver.passport_expiry,number:driver.passport_number}]

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/fleet/drivers" className="text-gray-400 hover:text-gray-600 text-sm">← Drivers</Link>
          <div><h1 className="page-title">{driver.full_name}</h1><p className="page-subtitle">{driver.driver_code} · {driver.employee_id??'No ID'} · {driver.branch?.name}</p></div>
        </div>
        <span className={`badge ${driverStatusColour[driver.status]} text-[13px] px-4`}>{driver.status.replace('_',' ')}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <div className="card">
            <div className="card-header"><span className="card-title">Driver Information</span></div>
            <div className="card-body grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[{label:'Full Name',value:driver.full_name},{label:'Employee ID',value:driver.employee_id},{label:'Mobile',value:driver.mobile},{label:'Email',value:driver.email},{label:'Nationality',value:driver.nationality},{label:'Employment',value:driver.employment_type},{label:'Branch',value:driver.branch?.name},{label:'Joining Date',value:formatDate(driver.joining_date)},{label:'Duty Status',value:driver.duty_status?.replace('_',' ')}]
                .map((f,i)=><div key={i}><div className="text-[11.5px] text-gray-400 font-medium uppercase tracking-wide">{f.label}</div><div className="text-[13.5px] font-semibold text-gray-800 mt-0.5">{f.value??<span className="text-gray-300">—</span>}</div></div>)}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Recent Trips</span></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Trip #</th><th>Vehicle</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {trips.length===0?<tr><td colSpan={4} className="text-center py-6 text-gray-400">No trips yet</td></tr>
                  :trips.map((t:any)=>(
                    <tr key={t.id}>
                      <td><Link href={`/operations/trips/${t.id}`} className="font-mono text-[12px] bg-gray-100 px-1.5 py-0.5 rounded hover:bg-gray-200">{t.trip_number}</Link></td>
                      <td className="text-[13px]">{t.vehicle?.vehicle_number??'—'}</td>
                      <td className="font-mono text-[12px] text-gray-500">{formatDate(t.planned_start)}</td>
                      <td><span className={`badge ${tripStatusColour[t.status]}`}>{t.status.replace('_',' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div className="card">
            <div className="card-header"><span className="card-title">Performance Score</span></div>
            <div className="card-body text-center">
              <div className={`text-[56px] font-extrabold leading-none ${scoreColour}`}>{score.toFixed(0)}</div>
              <div className="text-gray-400 text-sm mb-4">out of 100 · Target ≥ 80</div>
              <div className="progress-bar h-3"><div className={`progress-fill h-full ${score>=80?'bg-primary-500':score>=60?'bg-amber':'bg-red-500'}`} style={{width:`${score}%`}}/></div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Document Status</span></div>
            <div className="card-body space-y-3">
              {docs.map((d,i)=>{
                const st=expiryStatus(d.expiry)
                return (
                  <div key={i} className={`rounded-lg p-3 border ${st==='expired'?'bg-red-50 border-red-200':st==='critical'?'bg-amber-50 border-amber-200':'bg-green-50 border-green-200'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-[13px]">{d.label}</span>
                      <span className={`badge ${expiryStatusColour[st]}`}>{expiryLabel(d.expiry)}</span>
                    </div>
                    {d.number&&<div className="font-mono text-[11.5px] text-gray-500">{d.number}</div>}
                    <div className="text-[11px] text-gray-400 mt-0.5">Expires: {formatDate(d.expiry)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
