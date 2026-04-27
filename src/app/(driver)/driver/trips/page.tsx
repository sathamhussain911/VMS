'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export default function DriverTripsPage() {
  const supabase = createClient()
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'active'|'completed'>('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/driver/login'; return }
      const { data: driver } = await supabase.from('drivers').select('id').eq('auth_user_id', user.id).single()
      if (!driver) return
      const { data } = await supabase.from('trips')
        .select('id,trip_number,status,planned_start,vehicle:vehicles(vehicle_number),branch:branches(name),stops:trip_stops(id,delivery_status)')
        .eq('driver_id', driver.id)
        .not('status','eq','cancelled')
        .order('planned_start', { ascending: false })
        .limit(50)
      setTrips(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const STATUS_BG: Record<string, string> = {
    in_progress:'bg-blue-500', assigned:'bg-sky-500', completed:'bg-green-500',
    delayed:'bg-amber-500', requested:'bg-gray-400', approved:'bg-gray-500',
  }

  const filtered = filter === 'active'
    ? trips.filter(t => ['assigned','in_progress','delayed'].includes(t.status))
    : filter === 'completed'
    ? trips.filter(t => t.status === 'completed')
    : trips

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-primary-800 px-4 pt-10 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/driver" className="text-white/70 text-sm">← Home</Link>
          <h1 className="text-white font-bold text-[18px]">My Trips</h1>
        </div>
        <div className="flex gap-2">
          {(['all','active','completed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${filter===f?'bg-white text-primary-700':'bg-white/10 text-white'}`}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-2.5 pb-20">
        {loading ? (
          Array(3).fill(0).map((_,i) => <div key={i} className="skeleton h-24 rounded-xl"/>)
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400">
            <div className="text-3xl mb-2">📋</div>
            <div>No {filter !== 'all' ? filter : ''} trips found</div>
          </div>
        ) : (
          filtered.map(t => {
            const done = t.stops?.filter((s:any)=>s.delivery_status==='delivered').length ?? 0
            const total = t.stops?.length ?? 0
            return (
              <Link href={`/driver/trips/detail?id=${t.id}`} key={t.id}>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-[12px] bg-gray-100 px-2 py-0.5 rounded">{t.trip_number}</span>
                    <span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BG[t.status]??'bg-gray-400'}`}>
                      {t.status.replace('_',' ')}
                    </span>
                  </div>
                  <div className="font-semibold text-[13.5px]">{t.vehicle?.vehicle_number ?? '—'} — {t.branch?.name}</div>
                  <div className="text-[12px] text-gray-500 mt-0.5">{formatDate(t.planned_start,'dd MMM yyyy · HH:mm')}</div>
                  {total > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="progress-bar flex-1 h-1">
                        <div className={`progress-fill h-full ${t.status==='completed'?'bg-green-500':'bg-blue-500'}`}
                          style={{width:`${total>0?(done/total)*100:0}%`}}/>
                      </div>
                      <span className="text-[11px] text-gray-400">{done}/{total} stops</span>
                    </div>
                  )}
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 grid grid-cols-4 py-2" style={{maxWidth:430,margin:'0 auto'}}>
        {[{icon:'🏠',label:'Home',href:'/driver'},{icon:'🗺️',label:'Trips',href:'/driver/trips'},{icon:'⛽',label:'Fuel',href:'/driver/fuel'},{icon:'👤',label:'Profile',href:'/driver/profile'}]
          .map(item=>(
            <Link key={item.href} href={item.href} className="flex flex-col items-center py-1">
              <span className="text-[20px]">{item.icon}</span>
              <span className="text-[10px] text-gray-500">{item.label}</span>
            </Link>
          ))}
      </div>
    </div>
  )
}
