'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function DriverFuelPage() {
  const router = useRouter()
  const supabase = createClient()
  const [driver, setDriver] = useState<any>(null)
  const [vehicle, setVehicle] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/driver/login'; return }
      const { data: d } = await supabase.from('drivers').select('id,full_name').eq('auth_user_id', user.id).single()
      if (!d) return
      setDriver(d)
      const { data: v } = await supabase.from('vehicles').select('id,vehicle_number,make,model,current_odometer').eq('current_driver_id', d.id).maybeSingle()
      setVehicle(v)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const f = new FormData(e.currentTarget)

    const litres = parseFloat(f.get('litres') as string)
    const amount = parseFloat(f.get('amount') as string)
    const odometer = parseInt(f.get('odometer') as string)

    if (!driver || !vehicle) { setError('No vehicle assigned. Contact your supervisor.'); setLoading(false); return }

    const { error: err } = await supabase.from('fuel_entries').insert({
      vehicle_id:  vehicle.id,
      driver_id:   driver.id,
      fuel_type:   f.get('fuel_type'),
      litres,
      amount,
      odometer,
      station_vendor_id: null,
      // anomaly_flag calculated server-side in Phase 2
    })

    if (err) { setError(err.message); setLoading(false); return }

    // Update vehicle odometer
    if (odometer > (vehicle.current_odometer ?? 0)) {
      await supabase.from('vehicles').update({ current_odometer: odometer }).eq('id', vehicle.id)
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => router.push('/driver'), 1500)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-lg max-w-sm w-full">
          <div className="text-5xl mb-3">✅</div>
          <div className="font-bold text-[18px] text-green-700">Fuel Logged!</div>
          <div className="text-gray-400 text-sm mt-1">Redirecting to home…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-primary-800 px-4 pt-10 pb-5">
        <div className="flex items-center gap-3">
          <Link href="/driver" className="text-white/70 text-sm">← Home</Link>
          <h1 className="text-white font-bold text-[18px]">Log Fuel Entry</h1>
        </div>
      </div>

      <div className="px-4 py-4">
        {vehicle ? (
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 mb-4">
            <div className="text-[12px] text-primary-600 font-medium">Your Vehicle</div>
            <div className="font-bold text-primary-800">{vehicle.vehicle_number} — {vehicle.make} {vehicle.model}</div>
            <div className="text-[12px] text-primary-600">Current odometer: {vehicle.current_odometer?.toLocaleString()} km</div>
          </div>
        ) : (
          <div className="alert alert-amber mb-4">
            <span className="text-sm text-amber-700">No vehicle assigned. Contact your supervisor.</span>
          </div>
        )}

        {error && <div className="alert alert-red mb-4"><p className="text-sm text-red-700">{error}</p></div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <div>
              <label className="form-label">Fuel Type</label>
              <select name="fuel_type" className="form-control" required>
                <option value="diesel">Diesel</option>
                <option value="petrol_e_plus">Petrol Special (E-Plus)</option>
                <option value="petrol_super">Petrol Super</option>
              </select>
            </div>
            <div>
              <label className="form-label">Litres Filled *</label>
              <input name="litres" type="number" step="0.1" min="1" max="500" className="form-control" placeholder="65.0" required/>
            </div>
            <div>
              <label className="form-label">Total Amount (AED) *</label>
              <input name="amount" type="number" step="0.01" min="1" className="form-control" placeholder="173.55" required/>
            </div>
            <div>
              <label className="form-label">Odometer Reading (km) *</label>
              <input name="odometer" type="number" min={vehicle?.current_odometer ?? 0}
                className="form-control" placeholder={vehicle?.current_odometer?.toString()} required/>
            </div>
            <div>
              <label className="form-label">Fuel Station</label>
              <input name="station" type="text" className="form-control" placeholder="ENOC Abu Dhabi, ADNOC Al Ain…"/>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12px] text-amber-700">
            💡 Please upload your receipt photo below (required for claims above AED 300)
          </div>

          <button type="submit" className="w-full bg-primary-700 text-white font-bold py-3.5 rounded-xl text-[14px] disabled:opacity-60"
            disabled={loading || !vehicle}>
            {loading ? 'Saving…' : '⛽ Submit Fuel Entry'}
          </button>
        </form>
      </div>
    </div>
  )
}
