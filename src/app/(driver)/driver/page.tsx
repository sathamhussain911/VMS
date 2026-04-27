'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import type { Driver, Trip } from '@/types'

export default function DriverPortalPage() {
  const supabase = createClient()
  const [driver, setDriver] = useState<Driver | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/driver/login'; return }

      const { data: driverData } = await supabase
        .from('drivers')
        .select('*, branch:branches(name)')
        .eq('auth_user_id', user.id)
        .single()

      if (!driverData) { window.location.href = '/driver/login'; return }
      setDriver(driverData as any)

      const today = new Date().toISOString().split('T')[0]
      const { data: tripsData } = await supabase
        .from('trips')
        .select('*, stops:trip_stops(*), vehicle:vehicles(vehicle_number,make,model), branch:branches(name)')
        .eq('driver_id', driverData.id)
        .gte('planned_start', `${today}T00:00:00`)
        .lte('planned_start', `${today}T23:59:59`)
        .not('status', 'in', ['cancelled'])
        .order('planned_start')

      setTrips((tripsData ?? []) as any[])
      setLoading(false)
    }
    load()
  }, [])

  const STATUS_BG: Record<string, string> = {
    in_progress: 'bg-blue-500',
    assigned: 'bg-sky-500',
    completed: 'bg-green-500',
    delayed: 'bg-amber-500',
    requested: 'bg-gray-400',
  }

  const completed = trips.filter(t => t.status === 'completed').length
  const active = trips.find(t => t.status === 'in_progress')

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3"/>
          <p className="text-primary-300">Loading your trips…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", maxWidth: 430, margin: '0 auto' }}>
      {/* Header */}
      <div className="bg-primary-800 px-4 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center font-bold text-white text-sm">
            FFC
          </div>
          <div>
            <div className="text-white font-bold text-[15px]">
              {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening'}, {driver?.full_name.split(' ')[0]}
            </div>
            <div className="text-primary-300 text-[11px]">Driver Portal · {driver?.employee_id}</div>
          </div>
        </div>
        {/* Summary bar */}
        <div className="bg-white/10 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-primary-300 text-[10px] font-medium">Today</div>
            <div className="text-white text-[22px] font-extrabold">{trips.length}</div>
          </div>
          <div>
            <div className="text-primary-300 text-[10px] font-medium">Done</div>
            <div className="text-white text-[22px] font-extrabold">{completed}</div>
          </div>
          <div>
            <div className="text-primary-300 text-[10px] font-medium">Score</div>
            <div className="text-primary-300 text-[22px] font-extrabold">{driver?.performance_score?.toFixed(0) ?? '—'}</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Active trip banner */}
        {active && (
          <Link href={`/driver/trips/detail?id=${active.id}`}>
            <div className="bg-blue-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wide opacity-75">Active Trip</span>
                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">In Progress</span>
              </div>
              <div className="text-[16px] font-bold">{active.trip_number}</div>
              <div className="text-[13px] opacity-80 mt-0.5">{(active as any).vehicle?.vehicle_number} · {(active as any).branch?.name}</div>
              <div className="mt-3 bg-white/10 rounded-lg p-2.5 text-[12px]">
                Tap to manage stops & delivery →
              </div>
            </div>
          </Link>
        )}

        {/* Trip list */}
        <div>
          <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2">Today&apos;s Trips</h2>
          {trips.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400">
              <div className="text-4xl mb-2">📋</div>
              <div className="font-medium">No trips assigned today</div>
            </div>
          ) : (
            trips.map(t => (
              <Link href={`/driver/trips/detail?id=${t.id}`} key={t.id}>
                <div className="bg-white rounded-xl p-4 mb-2.5 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-[12px] bg-gray-100 px-2 py-0.5 rounded text-gray-700">{t.trip_number}</span>
                    <span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BG[t.status] ?? 'bg-gray-400'}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-[13.5px] font-semibold text-gray-800">{(t as any).vehicle?.vehicle_number} — {(t as any).branch?.name}</div>
                  <div className="text-[12px] text-gray-500 mt-1">
                    {formatDate(t.planned_start, 'HH:mm')} · {(t as any).stops?.length ?? 0} stop{(t as any).stops?.length !== 1 ? 's' : ''}
                  </div>
                  <div className="mt-2.5 flex justify-between items-center">
                    <div className="progress-bar flex-1 mr-3 h-1">
                      <div className={`progress-fill h-full ${t.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: t.status === 'completed' ? '100%' : t.status === 'in_progress' ? '50%' : '10%' }}/>
                    </div>
                    <span className="text-primary-700 text-[12px] font-semibold">View →</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/driver/fuel">
              <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
                <div className="text-2xl mb-1">⛽</div>
                <div className="text-[13px] font-semibold text-gray-800">Log Fuel</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Add fuel entry</div>
              </div>
            </Link>
            <button className="bg-red-50 rounded-xl p-4 text-center border border-red-100 w-full">
              <div className="text-2xl mb-1">🚨</div>
              <div className="text-[13px] font-semibold text-red-700">Report Issue</div>
              <div className="text-[11px] text-red-400 mt-0.5">Breakdown / accident</div>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 grid grid-cols-4 py-2"
        style={{ maxWidth: 430, margin: '0 auto' }}>
        {[
          { icon: '🏠', label: 'Home', href: '/driver' },
          { icon: '🗺️', label: 'Trips', href: '/driver/trips' },
          { icon: '⛽', label: 'Fuel', href: '/driver/fuel' },
          { icon: '👤', label: 'Profile', href: '/driver/profile' },
        ].map(item => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center py-1">
            <span className="text-[20px]">{item.icon}</span>
            <span className="text-[10px] text-gray-500 font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="h-16"/>
    </div>
  )
}
