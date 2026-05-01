'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default function DriverFuelPage() {
  const supabase = createClient()
  const [driver, setDriver] = useState<any>(null)
  const [vehicle, setVehicle] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'log' | 'history'>('log')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/driver/login'; return }
      const { data: d } = await supabase.from('drivers')
        .select('id,full_name,employee_id').eq('auth_user_id', user.id).maybeSingle()
      if (!d) return
      setDriver(d)

      // Get assigned vehicle from active trip
      const { data: activeTrip } = await supabase.from('trips')
        .select('vehicle:vehicles(id,vehicle_number,make,model,current_odometer)')
        .eq('driver_id', d.id)
        .eq('status', 'in_progress')
        .maybeSingle()

      if (activeTrip?.vehicle) {
        setVehicle(activeTrip.vehicle)
      } else {
        // Try current_driver_id
        const { data: v } = await supabase.from('vehicles')
          .select('id,vehicle_number,make,model,current_odometer')
          .eq('current_driver_id', d.id).maybeSingle()
        setVehicle(v)
      }

      // Load fuel history
      const { data: hist } = await supabase.from('fuel_entries')
        .select('id,fuel_type,litres,amount,odometer,station_name,efficiency_kmpl,created_at')
        .eq('driver_id', d.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setHistory(hist ?? [])
      setPageLoading(false)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError('')
    const f = new FormData(e.currentTarget)
    const litres = parseFloat(f.get('litres') as string)
    const amount = parseFloat(f.get('amount') as string)
    const odometer = parseInt(f.get('odometer') as string)
    const station_name = f.get('station') as string

    if (!driver) { setError('Driver not found'); setLoading(false); return }

    // Need vehicle_id — if no vehicle, still allow with a warning
    let vehicle_id = vehicle?.id
    if (!vehicle_id) {
      // Try to find any vehicle the driver has used recently
      const { data: lastEntry } = await supabase.from('fuel_entries')
        .select('vehicle_id').eq('driver_id', driver.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      vehicle_id = lastEntry?.vehicle_id
    }

    if (!vehicle_id) { setError('No vehicle assigned. Contact your supervisor.'); setLoading(false); return }

    // Calculate efficiency if previous entry exists
    let efficiency_kmpl = null
    const { data: lastFuel } = await supabase.from('fuel_entries')
      .select('odometer,litres').eq('vehicle_id', vehicle_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (lastFuel && odometer > lastFuel.odometer && lastFuel.litres > 0) {
      const distance = odometer - lastFuel.odometer
      efficiency_kmpl = parseFloat((distance / litres).toFixed(2))
    }

    // Anomaly detection
    let anomaly_flag = false
    let anomaly_reason = null
    if (efficiency_kmpl && efficiency_kmpl < 3) { anomaly_flag = true; anomaly_reason = 'Very low efficiency (<3 km/L)' }
    if (litres > 200) { anomaly_flag = true; anomaly_reason = 'Unusually large fill (>200L)' }
    const cost_per_litre = amount / litres
    if (cost_per_litre > 5 || cost_per_litre < 1) { anomaly_flag = true; anomaly_reason = 'Unusual cost per litre' }

    const { error: err } = await supabase.from('fuel_entries').insert({
      vehicle_id,
      driver_id: driver.id,
      fuel_type: f.get('fuel_type'),
      litres, amount, odometer, station_name,
      efficiency_kmpl, anomaly_flag, anomaly_reason,
    })

    if (err) { setError(err.message); setLoading(false); return }

    // Update vehicle odometer
    if (vehicle_id && odometer > (vehicle?.current_odometer ?? 0)) {
      await supabase.from('vehicles').update({ current_odometer: odometer }).eq('id', vehicle_id)
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => { setSuccess(false); setTab('history'); }, 1500)
  }

  if (pageLoading) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/>
    </div>
  )

  if (success) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 text-center shadow-lg max-w-sm w-full">
        <div className="text-5xl mb-3">✅</div>
        <div className="font-bold text-[18px] text-green-700">Fuel Logged!</div>
        <div className="text-gray-400 text-sm mt-1">Loading history…</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", maxWidth: 430, margin: '0 auto' }}>
      <div className="bg-primary-800 px-4 pt-10 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/driver" className="text-white/70 text-sm">← Home</Link>
          <h1 className="text-white font-bold text-[18px]">⛽ Fuel</h1>
        </div>
        {vehicle && (
          <div className="bg-white/10 rounded-xl p-3 text-white">
            <div className="text-[11px] text-white/60">Your Vehicle</div>
            <div className="font-bold text-[15px]">{vehicle.vehicle_number}</div>
            <div className="text-[12px] text-white/70">{vehicle.make} {vehicle.model} · {vehicle.current_odometer?.toLocaleString()} km</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200">
        <button onClick={() => setTab('log')}
          className={`flex-1 py-3 text-[13px] font-semibold ${tab === 'log' ? 'text-primary-700 border-b-2 border-primary-700' : 'text-gray-400'}`}>
          Log Fuel
        </button>
        <button onClick={() => setTab('history')}
          className={`flex-1 py-3 text-[13px] font-semibold ${tab === 'history' ? 'text-primary-700 border-b-2 border-primary-700' : 'text-gray-400'}`}>
          History ({history.length})
        </button>
      </div>

      <div className="px-4 py-4">
        {tab === 'log' && (
          <>
            {!vehicle && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-[13px] text-amber-700">
                ⚠️ No active vehicle detected. Entry will be linked to your last used vehicle.
              </div>
            )}
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-[13px] text-red-700">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
                <div>
                  <label className="text-[12px] font-semibold text-gray-600 block mb-1">Fuel Type</label>
                  <select name="fuel_type" className="form-control" required>
                    <option value="diesel">Diesel</option>
                    <option value="petrol_special">Petrol Special (E-Plus)</option>
                    <option value="petrol_super">Petrol Super</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] font-semibold text-gray-600 block mb-1">Litres *</label>
                    <input name="litres" type="number" step="0.1" min="1" max="500" className="form-control" placeholder="65.0" required/>
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-gray-600 block mb-1">Amount (AED) *</label>
                    <input name="amount" type="number" step="0.01" min="1" className="form-control" placeholder="173.55" required/>
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-gray-600 block mb-1">Odometer Reading (km) *</label>
                  <input name="odometer" type="number" min={vehicle?.current_odometer ?? 0}
                    className="form-control" placeholder={vehicle?.current_odometer?.toString() ?? '0'} required/>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-gray-600 block mb-1">Fuel Station</label>
                  <input name="station" type="text" className="form-control" placeholder="ENOC, ADNOC, EMARAT…"/>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12px] text-amber-700">
                💡 Keep your receipt — required for claims above AED 300
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-primary-700 text-white font-bold py-3.5 rounded-xl text-[14px] disabled:opacity-60">
                {loading ? 'Saving…' : '⛽ Submit Fuel Entry'}
              </button>
            </form>
          </>
        )}

        {tab === 'history' && (
          <div className="space-y-2.5">
            {history.length === 0
              ? <div className="bg-white rounded-xl p-8 text-center text-gray-400">
                <div className="text-3xl mb-2">⛽</div>
                <div>No fuel entries yet</div>
              </div>
              : history.map(e => (
                <div key={e.id} className={`bg-white rounded-xl p-4 shadow-sm border ${e.anomaly_flag ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-[14px]">{e.litres?.toFixed(1)} L · AED {e.amount?.toFixed(2)}</div>
                      <div className="text-[12px] text-gray-500">{e.station_name ?? 'Station not recorded'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-gray-400">{formatDate(e.created_at, 'dd MMM')}</div>
                      {e.efficiency_kmpl && (
                        <div className={`text-[12px] font-bold mt-0.5 ${e.efficiency_kmpl < 5 ? 'text-red-600' : 'text-green-600'}`}>
                          {e.efficiency_kmpl.toFixed(1)} km/L
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[11.5px] text-gray-400">
                    <span>Odo: {e.odometer?.toLocaleString()} km</span>
                    <span className="capitalize">{e.fuel_type}</span>
                    {e.anomaly_flag && <span className="text-red-500 font-semibold">⚠ Anomaly</span>}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
      <div className="h-6"/>
    </div>
  )
}
