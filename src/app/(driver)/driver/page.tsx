'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export default function DriverHomePage() {
  const supabase = createClient()
  const [driver, setDriver] = useState<any>(null)
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [breakdownLoading, setBreakdownLoading] = useState(false)
  const [breakdownSuccess, setBreakdownSuccess] = useState(false)

  // Online/offline detection
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/driver/login'; return }

    const { data: d } = await supabase.from('drivers')
      .select('id,full_name,employee_id,performance_score,duty_status')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!d) { window.location.href = '/driver/login'; return }
    setDriver(d)

    // Load active + upcoming trips — not just today
    const { data: tripsData } = await supabase.from('trips')
      .select('id,trip_number,status,planned_start,vehicle:vehicles(vehicle_number),stops:trip_stops(id,delivery_status)')
      .eq('driver_id', d.id)
      .not('status', 'in', '("cancelled","completed")')
      .order('planned_start', { ascending: true })
      .limit(10)

    // Also get last 3 completed
    const { data: recentDone } = await supabase.from('trips')
      .select('id,trip_number,status,planned_start,vehicle:vehicles(vehicle_number)')
      .eq('driver_id', d.id)
      .eq('status', 'completed')
      .order('planned_start', { ascending: false })
      .limit(3)

    setTrips([...(tripsData ?? []), ...(recentDone ?? [])])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function submitBreakdown(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBreakdownLoading(true)
    const f = new FormData(e.currentTarget)

    // Find active trip's vehicle
    const activeTrip = trips.find(t => t.status === 'in_progress')

    const { error } = await supabase.from('breakdown_reports').insert({
      vehicle_id: activeTrip?.vehicle_id ?? null,
      driver_id: driver?.id,
      description: f.get('description') as string,
      severity: f.get('severity') as string,
      location: f.get('location') as string || null,
    })

    setBreakdownLoading(false)
    if (!error) {
      setBreakdownSuccess(true)
      setShowBreakdown(false)
      setTimeout(() => setBreakdownSuccess(false), 3000)
    }
  }

  const activeTrip = trips.find(t => t.status === 'in_progress')
  const assignedTrips = trips.filter(t => t.status === 'assigned' || t.status === 'approved')
  const completedTrips = trips.filter(t => t.status === 'completed')
  const completedToday = trips.filter(t => t.status === 'completed' && new Date(t.planned_start).toDateString() === new Date().toDateString()).length

  const STATUS_BG: Record<string, string> = {
    in_progress: 'bg-blue-500',
    assigned: 'bg-sky-500',
    approved: 'bg-purple-500',
    completed: 'bg-green-500',
    delayed: 'bg-amber-500',
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#14532d' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3"/>
          <p className="text-white/60 text-[13px]">Loading your portal…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-center text-[12px] font-semibold py-1.5 px-4">
          📡 Offline — changes will sync when reconnected
        </div>
      )}

      {/* Breakdown success */}
      {breakdownSuccess && (
        <div className="bg-green-500 text-white text-center text-[13px] font-semibold py-2.5 px-4">
          ✅ Breakdown reported — supervisor notified
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-10 pb-5" style={{ background: '#14532d' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
              <img src="/ffc-logo.png" alt="FFC" className="w-full h-full object-cover"/>
            </div>
            <div>
              <div className="text-white font-bold text-[15px]">
                {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening'},{' '}
                {driver?.full_name?.split(' ')[0]}
              </div>
              <div className="text-[11px]" style={{ color: '#86efac' }}>Driver Portal · {driver?.employee_id}</div>
            </div>
          </div>
          <button onClick={load} className="text-white/50 text-[20px] active:rotate-180 transition-transform">↻</button>
        </div>

        {/* Stats bar */}
        <div className="rounded-xl p-3 grid grid-cols-3 gap-2 text-center" style={{ background: 'rgba(255,255,255,.1)' }}>
          <div>
            <div className="text-[10px] font-medium" style={{ color: '#86efac' }}>Assigned</div>
            <div className="text-white text-[22px] font-extrabold">{assignedTrips.length + (activeTrip ? 1 : 0)}</div>
          </div>
          <div>
            <div className="text-[10px] font-medium" style={{ color: '#86efac' }}>Done Today</div>
            <div className="text-white text-[22px] font-extrabold">{completedToday}</div>
          </div>
          <div>
            <div className="text-[10px] font-medium" style={{ color: '#86efac' }}>Score</div>
            <div className="text-[22px] font-extrabold" style={{ color: (driver?.performance_score ?? 100) >= 80 ? '#86efac' : '#fbbf24' }}>
              {driver?.performance_score?.toFixed(0) ?? '100'}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Active trip banner */}
        {activeTrip && (
          <Link href={`/driver/trips/detail?id=${activeTrip.id}`}>
            <div className="bg-blue-600 rounded-2xl p-4 text-white shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wide opacity-70">🚗 Active Trip</span>
                <span className="bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full animate-pulse">In Progress</span>
              </div>
              <div className="text-[18px] font-extrabold">{activeTrip.trip_number}</div>
              <div className="text-[13px] opacity-80 mt-0.5">{activeTrip.vehicle?.vehicle_number}</div>
              {/* Stop progress */}
              {activeTrip.stops?.length > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] opacity-70 mb-1">
                    <span>Stops Progress</span>
                    <span>{activeTrip.stops.filter((s: any) => s.delivery_status === 'delivered').length}/{activeTrip.stops.length}</span>
                  </div>
                  <div className="h-1.5 bg-white/20 rounded-full">
                    <div className="h-1.5 bg-white rounded-full transition-all"
                      style={{ width: `${(activeTrip.stops.filter((s: any) => s.delivery_status === 'delivered').length / activeTrip.stops.length) * 100}%` }}/>
                  </div>
                </div>
              )}
              <div className="mt-3 bg-white/10 rounded-xl p-2.5 text-[12px] font-medium text-center">
                Tap to manage stops & delivery →
              </div>
            </div>
          </Link>
        )}

        {/* Assigned trips */}
        {assignedTrips.length > 0 && (
          <div>
            <h2 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-2.5">Upcoming Trips</h2>
            {assignedTrips.map(t => (
              <Link href={`/driver/trips/detail?id=${t.id}`} key={t.id}>
                <div className="bg-white rounded-2xl p-4 mb-2.5 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="font-mono text-[12px] bg-gray-100 px-2 py-0.5 rounded text-gray-600">{t.trip_number}</span>
                    <span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BG[t.status] ?? 'bg-gray-400'}`}>
                      {t.status}
                    </span>
                  </div>
                  <div className="font-semibold text-[14px] text-gray-800">{t.vehicle?.vehicle_number ?? 'No vehicle'}</div>
                  <div className="text-[12px] text-gray-400 mt-0.5">
                    {formatDate(t.planned_start, 'HH:mm · dd MMM')} · {t.stops?.length ?? 0} stop{t.stops?.length !== 1 ? 's' : ''}
                  </div>
                  <div className="mt-2 text-[12px] font-semibold text-blue-600">Tap to start →</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* No trips */}
        {!activeTrip && assignedTrips.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
            <div className="text-4xl mb-2">📋</div>
            <div className="font-semibold text-gray-600">No active trips</div>
            <div className="text-[12px] mt-1">Your next trip will appear here</div>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <h2 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-2.5">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/driver/fuel">
              <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100 active:scale-[0.97] transition-transform">
                <div className="text-2xl mb-1.5">⛽</div>
                <div className="text-[13px] font-bold text-gray-800">Log Fuel</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Add fuel entry</div>
              </div>
            </Link>
            <button onClick={() => setShowBreakdown(true)}
              className="bg-red-50 rounded-2xl p-4 text-center border border-red-100 w-full active:scale-[0.97] transition-transform">
              <div className="text-2xl mb-1.5">🚨</div>
              <div className="text-[13px] font-bold text-red-700">Report Issue</div>
              <div className="text-[11px] text-red-400 mt-0.5">Breakdown / accident</div>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Link href="/driver/trips">
              <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100 active:scale-[0.97] transition-transform">
                <div className="text-2xl mb-1.5">🗺️</div>
                <div className="text-[13px] font-bold text-gray-800">All Trips</div>
                <div className="text-[11px] text-gray-400 mt-0.5">View history</div>
              </div>
            </Link>
            <Link href="/driver/profile">
              <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100 active:scale-[0.97] transition-transform">
                <div className="text-2xl mb-1.5">📊</div>
                <div className="text-[13px] font-bold text-gray-800">My Stats</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Performance history</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent completed */}
        {completedTrips.length > 0 && (
          <div>
            <h2 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-2.5">Recently Completed</h2>
            {completedTrips.map(t => (
              <Link href={`/driver/trips/detail?id=${t.id}`} key={t.id}>
                <div className="bg-white rounded-xl p-3.5 mb-2 border border-gray-100 opacity-70">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-mono text-[12px] text-gray-500">{t.trip_number}</span>
                      <div className="text-[11px] text-gray-400">{t.vehicle?.vehicle_number} · {formatDate(t.planned_start, 'dd MMM')}</div>
                    </div>
                    <span className="text-green-600 text-[11px] font-bold">✓ Done</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 grid grid-cols-4 py-2 z-50"
        style={{ maxWidth: 430, margin: '0 auto', left: '50%', transform: 'translateX(-50%)', width: '100%' }}>
        {[
          { icon: '🏠', label: 'Home', href: '/driver', active: true },
          { icon: '🗺️', label: 'Trips', href: '/driver/trips', active: false },
          { icon: '⛽', label: 'Fuel', href: '/driver/fuel', active: false },
          { icon: '👤', label: 'Profile', href: '/driver/profile', active: false },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="flex flex-col items-center py-1 gap-0.5">
            <span className="text-[20px]">{item.icon}</span>
            <span className={`text-[10px] font-medium ${item.active ? 'text-primary-700' : 'text-gray-400'}`}>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Breakdown Report Modal */}
      {showBreakdown && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full p-5 animate-slide-up" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[16px] text-red-700">🚨 Report Issue</h3>
              <button onClick={() => setShowBreakdown(false)} className="text-gray-400 text-[22px] leading-none">×</button>
            </div>
            <form onSubmit={submitBreakdown} className="space-y-3">
              <div>
                <label className="form-label text-[12px]">Severity *</label>
                <select name="severity" className="form-control" required>
                  <option value="minor">Minor — Can continue trip</option>
                  <option value="major">Major — Need assistance</option>
                  <option value="critical">Critical — Cannot move vehicle</option>
                </select>
              </div>
              <div>
                <label className="form-label text-[12px]">Description *</label>
                <textarea name="description" className="form-control" rows={3}
                  placeholder="What happened? Describe the issue clearly…" required
                  style={{ resize: 'none' }}/>
              </div>
              <div>
                <label className="form-label text-[12px]">Your Location</label>
                <input name="location" className="form-control" placeholder="Street name, area, landmark…"/>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12px] text-amber-700">
                ⚠️ Your supervisor will be notified immediately. Stay safe and turn on hazard lights.
              </div>
              <button type="submit" disabled={breakdownLoading}
                className="w-full bg-red-600 text-white font-bold py-3.5 rounded-xl text-[14px] disabled:opacity-60">
                {breakdownLoading ? 'Sending…' : '🚨 Send Alert'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
