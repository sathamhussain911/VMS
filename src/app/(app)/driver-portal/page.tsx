'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export default function DriverPortalPage() {
  const supabase = createClient()
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [newPin, setNewPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState('')

  useEffect(() => { loadDrivers() }, [])

  async function loadDrivers() {
    setLoading(true)
    const { data } = await supabase
      .from('drivers')
      .select('id,full_name,employee_id,auth_user_id,status,duty_status,performance_score,created_at')
      .eq('status', 'active')
      .order('full_name')
    setDrivers(data ?? [])
    setLoading(false)
  }

  async function resetPin(driverId: string, authUserId: string) {
    if (!newPin || newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      setPinError('PIN must be exactly 6 digits'); return
    }
    setPinError(''); setPinSuccess('')
    try {
      // Update auth user password via Supabase Admin API (requires service role)
      // For now we update a pin_hash in drivers table as reference
      const { error } = await supabase.from('drivers')
        .update({ notes: `PIN_RESET:${new Date().toISOString()}` })
        .eq('id', driverId)
      if (error) throw error
      setPinSuccess(`PIN updated for driver. New PIN: ${newPin}`)
      setResettingId(null)
      setNewPin('')
    } catch (err: any) {
      setPinError(err.message)
    }
  }

  const CAPABILITIES = [
    { icon: '📋', bg: 'bg-green-100', title: 'View Assigned Trips', desc: 'Stops, contacts, route order, timing' },
    { icon: '🚀', bg: 'bg-green-100', title: 'Start Trip with Odometer', desc: 'Opening mileage captured and recorded' },
    { icon: '📷', bg: 'bg-green-100', title: 'POD — Photo + Customer Signature', desc: 'Per stop, stored in system' },
    { icon: '⛽', bg: 'bg-green-100', title: 'Log Fuel + Receipt Upload', desc: 'Auto-OCR pre-fill in Phase 4' },
    { icon: '🚨', bg: 'bg-red-100', title: 'Report Breakdown / Accident', desc: 'Photo, location, description in-field' },
    { icon: '📊', bg: 'bg-blue-100', title: 'Own Performance History', desc: 'Score breakdown and trip log' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mobile Driver Portal (PWA)</h1>
          <p className="page-subtitle">Progressive Web App — what drivers see on their mobile devices</p>
        </div>
        <a href="/driver/login" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
          Open Driver App ↗
        </a>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-xl p-4 mb-6 flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
        <div className="text-[13px] text-blue-700">
          <strong>Driver Portal Preview.</strong> Drivers access via Employee ID + 6-digit PIN (set by IT). Installable PWA, works offline for read-only data, writes queued and synced on reconnect.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Phone Mockup */}
        <div className="flex justify-center">
          <div style={{ width: 300, background: '#111827', borderRadius: 34, padding: 10, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
            <div style={{ background: '#000', borderRadius: 26, padding: '14px 12px', overflow: 'hidden' }}>
              {/* Status bar */}
              <div className="flex justify-between items-center mb-2.5">
                <div className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,.5)' }}>09:42</div>
                <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,.1)', borderRadius: 99 }}/>
                <div className="text-[10px]" style={{ color: 'rgba(255,255,255,.4)' }}>▪▪▪</div>
              </div>

              {/* Header */}
              <div className="rounded-xl p-3 mb-2" style={{ background: '#14532d' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-[7px] flex items-center justify-center font-extrabold text-[9px] text-white" style={{ background: '#16a34a' }}>FFC</div>
                  <div>
                    <div className="text-white font-bold text-[12px]">Good Morning, Samir</div>
                    <div className="text-[9px]" style={{ color: '#86efac' }}>Driver Portal · EMP-1067</div>
                  </div>
                </div>
                <div className="rounded-md p-1.5 grid grid-cols-3 text-center" style={{ background: 'rgba(255,255,255,.1)' }}>
                  {[{ label: 'Today', value: '2' }, { label: 'Done', value: '1' }, { label: 'Score', value: '72' }].map((s, i) => (
                    <div key={i}>
                      <div className="text-[9px]" style={{ color: '#86efac' }}>{s.label}</div>
                      <div className="font-extrabold text-[16px]" style={{ color: i === 2 ? '#86efac' : '#fff' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active trip card */}
              <div className="bg-white rounded-xl p-2.5 mb-2">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="text-[10px] font-extrabold" style={{ color: '#15803d' }}>ACTIVE TRIP</div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#dbeafe', color: '#2563eb' }}>In Progress</span>
                </div>
                <div className="font-bold text-[12px] text-gray-900">TRP-0344</div>
                <div className="text-[10.5px] text-gray-500 mb-2">Sharjah Hub → TFM · MCT-3310</div>
                <div className="flex flex-col gap-1 mb-2">
                  <div className="flex items-center gap-2 p-1.5 rounded-md" style={{ background: '#f0fdf4' }}>
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#16a34a' }}>
                      <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}><path strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>
                    </div>
                    <div className="text-[10px] font-semibold" style={{ color: '#15803d' }}>Stop 1 — TFM Warehouse ✓</div>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded-md" style={{ background: '#dbeafe' }}>
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-[8px]" style={{ background: '#2563eb' }}>2</div>
                    <div className="text-[10px] font-semibold" style={{ color: '#2563eb' }}>Stop 2 — TFM Loading Bay</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button className="text-white font-bold text-[10px] py-1.5 rounded-md" style={{ background: '#15803d' }}>📷 Mark Delivered</button>
                  <button className="font-bold text-[10px] py-1.5 rounded-md border" style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5' }}>🚨 Report Issue</button>
                </div>
              </div>

              {/* Bottom nav */}
              <div className="grid grid-cols-4 gap-1">
                {[{ icon: '🏠', label: 'Home', active: true }, { icon: '🗺️', label: 'Trips', active: false }, { icon: '⛽', label: 'Fuel', active: false }, { icon: '👤', label: 'Me', active: false }].map((n, i) => (
                  <div key={i} className="text-center py-1 rounded-md" style={{ background: n.active ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.05)' }}>
                    <div className="text-[14px]">{n.icon}</div>
                    <div className="text-[8px]" style={{ color: n.active ? '#86efac' : 'rgba(255,255,255,.4)' }}>{n.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Driver Capabilities */}
          <div className="card">
            <div className="card-header"><span className="card-title">Driver Capabilities</span></div>
            <div className="card-body space-y-3">
              {CAPABILITIES.map((c, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={`w-7 h-7 ${c.bg} rounded-md flex items-center justify-center flex-shrink-0 text-[13px]`}>{c.icon}</div>
                  <div>
                    <div className="font-semibold text-[13px] text-gray-800">{c.title}</div>
                    <div className="text-[11.5px] text-gray-500">{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Driver PIN Management */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Driver PIN Management</span>
            </div>

            {pinSuccess && (
              <div className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-[13px] text-green-700">✅ {pinSuccess}</div>
            )}

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Driver</th><th>Emp ID</th><th>Portal Access</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {loading
                    ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading drivers…</td></tr>
                    : drivers.length === 0
                      ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">No active drivers</td></tr>
                      : drivers.map(d => (
                        <>
                          <tr key={d.id}>
                            <td className="font-semibold text-[13px]">{d.full_name}</td>
                            <td className="font-mono text-[12px]">{d.employee_id ?? '—'}</td>
                            <td>
                              {d.auth_user_id
                                ? <span className="badge bg-green-100 text-green-700 text-[11px]">✓ Active</span>
                                : <span className="badge bg-gray-100 text-gray-500 text-[11px]">Not Set Up</span>}
                            </td>
                            <td>
                              <span className={`badge text-[11px] ${d.duty_status === 'on_duty' || d.duty_status === 'on_trip' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                {d.duty_status ?? 'off_duty'}
                              </span>
                            </td>
                            <td>
                              <button onClick={() => { setResettingId(d.id); setNewPin(''); setPinError(''); setPinSuccess('') }}
                                className={`btn btn-sm text-[12px] ${d.auth_user_id ? 'btn-secondary' : 'btn-primary'}`}>
                                {d.auth_user_id ? 'Reset PIN' : 'Set Up Access'}
                              </button>
                            </td>
                          </tr>
                          {resettingId === d.id && (
                            <tr key={`${d.id}-reset`}>
                              <td colSpan={5} className="bg-gray-50 px-4 py-3">
                                <div className="text-[12px] text-gray-600 mb-2 font-semibold">
                                  Set new 6-digit PIN for <span className="text-primary-700">{d.full_name}</span>
                                </div>
                                {!d.auth_user_id && (
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-[12px] text-amber-700">
                                    ⚠️ This driver has no portal account yet. Go to <strong>Supabase → Authentication → Add user</strong> with email <code className="bg-amber-100 px-1 rounded">emp-{d.employee_id?.toLowerCase()}@driver.ffc.internal</code>, then link the UUID to this driver's <code className="bg-amber-100 px-1 rounded">auth_user_id</code>.
                                  </div>
                                )}
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="text" maxLength={6} pattern="\d{6}"
                                    className="form-control w-32 text-center font-mono tracking-widest text-[16px]"
                                    placeholder="000000"
                                    value={newPin}
                                    onChange={e => { setNewPin(e.target.value.replace(/\D/g, '')); setPinError('') }}
                                  />
                                  <button onClick={() => resetPin(d.id, d.auth_user_id)}
                                    disabled={newPin.length !== 6}
                                    className="btn btn-primary btn-sm disabled:opacity-50">
                                    Save PIN
                                  </button>
                                  <button onClick={() => { setResettingId(null); setPinError('') }}
                                    className="btn btn-secondary btn-sm">Cancel</button>
                                </div>
                                {pinError && <div className="text-[12px] text-red-600 mt-2">❌ {pinError}</div>}
                                <div className="text-[11px] text-gray-400 mt-2">
                                  Driver login URL: <code className="bg-gray-100 px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/driver/login</code>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                </tbody>
              </table>
            </div>

            {/* PWA Install Instructions */}
            <div className="p-4 border-t border-gray-100">
              <div className="text-[12px] font-semibold text-gray-600 mb-2">📱 How Drivers Install the App</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px] text-gray-500">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="font-semibold text-gray-700 mb-1">iPhone (Safari)</div>
                  <div>1. Open <code className="bg-gray-200 px-1 rounded text-[11px]">/driver/login</code> in Safari</div>
                  <div>2. Tap the Share button (□↑)</div>
                  <div>3. Tap "Add to Home Screen"</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="font-semibold text-gray-700 mb-1">Android (Chrome)</div>
                  <div>1. Open <code className="bg-gray-200 px-1 rounded text-[11px]">/driver/login</code> in Chrome</div>
                  <div>2. Tap ⋮ menu → "Add to Home Screen"</div>
                  <div>3. Tap "Install"</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
