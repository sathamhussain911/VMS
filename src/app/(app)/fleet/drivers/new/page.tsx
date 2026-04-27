'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function NewDriverPage() {
  const router = useRouter()
  const supabase = createClient()
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('branches').select('id,name').eq('status','active').order('name').then(r => setBranches(r.data ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const f = new FormData(e.currentTarget)
    const get = (k: string) => f.get(k) as string || null

    // Auto-generate driver code
    const { count } = await supabase.from('drivers').select('id', { count: 'exact', head: true })
    const driverCode = `DRV-${String((count ?? 0) + 1).padStart(4, '0')}`

    const { data, error: err } = await supabase.from('drivers').insert({
      driver_code:        driverCode,
      employee_id:        get('employee_id'),
      full_name:          get('full_name')!,
      mobile:             get('mobile'),
      alternate_mobile:   get('alternate_mobile'),
      email:              get('email'),
      date_of_birth:      get('date_of_birth'),
      nationality:        get('nationality'),
      eid_number:         get('eid_number'),
      eid_expiry:         get('eid_expiry'),
      license_number:     get('license_number'),
      license_class:      get('license_class'),
      license_issue_date: get('license_issue_date'),
      license_expiry:     get('license_expiry'),
      passport_number:    get('passport_number'),
      passport_expiry:    get('passport_expiry'),
      employment_type:    get('employment_type') ?? 'employee',
      branch_id:          get('branch_id')!,
      joining_date:       get('joining_date'),
      status:             'active',
      duty_status:        'off_duty',
      performance_score:  100,
      notes:              get('notes'),
    }).select().single()

    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/fleet/drivers/detail?id=${data.id}`)
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
          <Link href="/fleet/drivers" className="text-gray-400 hover:text-gray-600 text-sm">← Drivers</Link>
          <div>
            <h1 className="page-title">Add New Driver</h1>
            <p className="page-subtitle">Register a driver in the FFC driver roster</p>
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
        <div className="card-header"><span className="card-title">Driver Information</span></div>
        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section title="Personal Details" />
            <div>
              <label className="form-label">Full Name *</label>
              <input name="full_name" type="text" className="form-control" placeholder="Mohamed Al-Farsi" required/>
            </div>
            <div>
              <label className="form-label">Employee ID</label>
              <input name="employee_id" type="text" className="form-control" placeholder="EMP-1021"/>
            </div>
            <div>
              <label className="form-label">Nationality</label>
              <input name="nationality" type="text" className="form-control" placeholder="UAE, Pakistani, Indian…"/>
            </div>
            <div>
              <label className="form-label">Date of Birth</label>
              <input name="date_of_birth" type="date" className="form-control"/>
            </div>

            <Section title="Contact" />
            <div>
              <label className="form-label">Mobile Number *</label>
              <input name="mobile" type="tel" className="form-control" placeholder="+971 5X XXX XXXX" required/>
            </div>
            <div>
              <label className="form-label">Alternate Mobile</label>
              <input name="alternate_mobile" type="tel" className="form-control"/>
            </div>
            <div>
              <label className="form-label">Email</label>
              <input name="email" type="email" className="form-control"/>
            </div>

            <Section title="Employment" />
            <div>
              <label className="form-label">Employment Type</label>
              <select name="employment_type" className="form-control">
                <option value="employee">FFC Employee</option>
                <option value="contractor">Contractor</option>
              </select>
            </div>
            <div>
              <label className="form-label">Assigned Branch *</label>
              <select name="branch_id" className="form-control" required>
                <option value="">Select branch…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Joining Date</label>
              <input name="joining_date" type="date" className="form-control"/>
            </div>

            <Section title="Documents" />
            <div>
              <label className="form-label">Emirates ID Number *</label>
              <input name="eid_number" type="text" className="form-control" placeholder="784-XXXX-XXXXXXX-X" required/>
            </div>
            <div>
              <label className="form-label">Emirates ID Expiry *</label>
              <input name="eid_expiry" type="date" className="form-control" required/>
            </div>
            <div>
              <label className="form-label">Driving License Number *</label>
              <input name="license_number" type="text" className="form-control" placeholder="UAE-DL-XXXXX" required/>
            </div>
            <div>
              <label className="form-label">License Class</label>
              <input name="license_class" type="text" className="form-control" placeholder="Light Vehicle, Heavy Truck…"/>
            </div>
            <div>
              <label className="form-label">License Issue Date</label>
              <input name="license_issue_date" type="date" className="form-control"/>
            </div>
            <div>
              <label className="form-label">License Expiry *</label>
              <input name="license_expiry" type="date" className="form-control" required/>
            </div>
            <div>
              <label className="form-label">Passport Number</label>
              <input name="passport_number" type="text" className="form-control"/>
            </div>
            <div>
              <label className="form-label">Passport Expiry</label>
              <input name="passport_expiry" type="date" className="form-control"/>
            </div>

            <Section title="Notes" />
            <div className="col-span-2">
              <label className="form-label">Additional Notes</label>
              <textarea name="notes" className="form-control" rows={3}/>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
            <Link href="/fleet/drivers" className="btn btn-secondary">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Driver'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
