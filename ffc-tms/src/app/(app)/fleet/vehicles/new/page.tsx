'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function NewVehiclePage() {
  const router = useRouter()
  const supabase = createClient()
  const [branches, setBranches] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('branches').select('id,name').eq('status','active').order('name').then(r => setBranches(r.data ?? []))
    supabase.from('vendors').select('id,name').eq('type','rental').order('name').then(r => setVendors(r.data ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const f = new FormData(e.currentTarget)
    const get = (k: string) => f.get(k) as string || null

    const { data, error: err } = await supabase.from('vehicles').insert({
      vehicle_number:    get('vehicle_number')!,
      vehicle_code:      get('vehicle_code'),
      vin:               get('vin'),
      engine_number:     get('engine_number'),
      vehicle_type:      get('vehicle_type') ?? 'pickup',
      make:              get('make')!,
      model:             get('model')!,
      year:              get('year') ? parseInt(get('year')!) : null,
      capacity_kg:       get('capacity_kg') ? parseInt(get('capacity_kg')!) : null,
      color:             get('color'),
      ownership_type:    get('ownership_type') ?? 'owned',
      vendor_id:         get('vendor_id'),
      lease_start:       get('lease_start'),
      lease_end:         get('lease_end'),
      monthly_rental:    get('monthly_rental') ? parseFloat(get('monthly_rental')!) : null,
      branch_id:         get('branch_id')!,
      status:            'available',
      current_odometer:  get('current_odometer') ? parseInt(get('current_odometer')!) : 0,
      mulkiya_number:    get('mulkiya_number'),
      mulkiya_issue_date:get('mulkiya_issue_date'),
      mulkiya_expiry:    get('mulkiya_expiry'),
      insurance_policy:  get('insurance_policy'),
      insurance_expiry:  get('insurance_expiry'),
      salik_tag:         get('salik_tag'),
      gps_device_id:     get('gps_device_id'),
      gps_vendor:        get('gps_vendor'),
      gps_contract_expiry: get('gps_contract_expiry'),
      notes:             get('notes'),
    }).select().single()

    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/fleet/vehicles/detail?id=${data.id}`)
  }

  const Section = ({ title }: { title: string }) => (
    <div className="col-span-2 pt-2 pb-1 border-b border-gray-200 mb-1">
      <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">{title}</h3>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/fleet/vehicles" className="text-gray-400 hover:text-gray-600 text-sm">← Vehicles</Link>
          <div>
            <h1 className="page-title">Add New Vehicle</h1>
            <p className="page-subtitle">Register a vehicle in the FFC fleet</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-red mb-4">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 9v2m0 4h.01m-6.938 4h13.856"/></svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <div className="card-header"><span className="card-title">Vehicle Information</span></div>
        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section title="Identification" />
            <div>
              <label className="form-label">Registration Number (Plate) *</label>
              <input name="vehicle_number" type="text" className="form-control" placeholder="e.g. TXB-2201" required/>
            </div>
            <div>
              <label className="form-label">Internal Code</label>
              <input name="vehicle_code" type="text" className="form-control" placeholder="e.g. VEH-001"/>
            </div>
            <div>
              <label className="form-label">VIN / Chassis Number</label>
              <input name="vin" type="text" className="form-control"/>
            </div>
            <div>
              <label className="form-label">Engine Number</label>
              <input name="engine_number" type="text" className="form-control"/>
            </div>

            <Section title="Classification" />
            <div>
              <label className="form-label">Vehicle Type *</label>
              <select name="vehicle_type" className="form-control" required>
                <option value="pickup">Pickup Truck</option>
                <option value="van">Van</option>
                <option value="truck_medium">Medium Truck</option>
                <option value="truck_heavy">Heavy Truck</option>
                <option value="reefer">Reefer Truck</option>
                <option value="tanker">Tanker</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="form-label">Make *</label>
              <input name="make" type="text" className="form-control" placeholder="Toyota, Isuzu, Ford…" required/>
            </div>
            <div>
              <label className="form-label">Model *</label>
              <input name="model" type="text" className="form-control" placeholder="Hilux, NPR, Transit…" required/>
            </div>
            <div>
              <label className="form-label">Year</label>
              <input name="year" type="number" className="form-control" min="1990" max="2030" placeholder="2024"/>
            </div>
            <div>
              <label className="form-label">Capacity (kg)</label>
              <input name="capacity_kg" type="number" className="form-control" placeholder="1000"/>
            </div>
            <div>
              <label className="form-label">Color</label>
              <input name="color" type="text" className="form-control" placeholder="White"/>
            </div>

            <Section title="Ownership & Assignment" />
            <div>
              <label className="form-label">Ownership Type *</label>
              <select name="ownership_type" className="form-control">
                <option value="owned">Owned</option>
                <option value="rented">Rented</option>
                <option value="leased">Leased</option>
              </select>
            </div>
            <div>
              <label className="form-label">Rental Vendor</label>
              <select name="vendor_id" className="form-control">
                <option value="">— None —</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Lease Start</label>
              <input name="lease_start" type="date" className="form-control"/>
            </div>
            <div>
              <label className="form-label">Lease End</label>
              <input name="lease_end" type="date" className="form-control"/>
            </div>
            <div>
              <label className="form-label">Monthly Rental (AED)</label>
              <input name="monthly_rental" type="number" step="0.01" className="form-control"/>
            </div>
            <div>
              <label className="form-label">Assigned Branch *</label>
              <select name="branch_id" className="form-control" required>
                <option value="">Select branch…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Current Odometer (km)</label>
              <input name="current_odometer" type="number" className="form-control" defaultValue="0"/>
            </div>

            <Section title="Compliance Documents" />
            <div>
              <label className="form-label">Mulkiya Number</label>
              <input name="mulkiya_number" type="text" className="form-control"/>
            </div>
            <div>
              <label className="form-label">Mulkiya Issue Date</label>
              <input name="mulkiya_issue_date" type="date" className="form-control"/>
            </div>
            <div>
              <label className="form-label">Mulkiya Expiry *</label>
              <input name="mulkiya_expiry" type="date" className="form-control" required/>
            </div>
            <div>
              <label className="form-label">Insurance Policy #</label>
              <input name="insurance_policy" type="text" className="form-control"/>
            </div>
            <div>
              <label className="form-label">Insurance Expiry *</label>
              <input name="insurance_expiry" type="date" className="form-control" required/>
            </div>
            <div>
              <label className="form-label">Salik Tag Number</label>
              <input name="salik_tag" type="text" className="form-control"/>
            </div>

            <Section title="GPS / Telematics" />
            <div>
              <label className="form-label">GPS Device ID</label>
              <input name="gps_device_id" type="text" className="form-control"/>
            </div>
            <div>
              <label className="form-label">GPS Vendor</label>
              <input name="gps_vendor" type="text" className="form-control"/>
            </div>
            <div>
              <label className="form-label">GPS Contract Expiry</label>
              <input name="gps_contract_expiry" type="date" className="form-control"/>
            </div>

            <Section title="Notes" />
            <div className="col-span-2">
              <label className="form-label">Additional Notes</label>
              <textarea name="notes" className="form-control" rows={3}/>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
            <Link href="/fleet/vehicles" className="btn btn-secondary">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Vehicle'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
