'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewTripPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(e.currentTarget)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }

    // Get user profile for branch
    const { data: profile } = await supabase.from('users').select('branch_id').eq('id', user.id).single()

    const { data, error: err } = await supabase.from('trips').insert({
      requester_id: user.id,
      branch_id: form.get('branch_id') as string || profile?.branch_id,
      vehicle_type_needed: form.get('vehicle_type') as string || 'any',
      priority: form.get('priority') as string || 'normal',
      planned_start: `${form.get('planned_date')}T${form.get('planned_time')}:00`,
      planned_end: form.get('planned_end_date') ? `${form.get('planned_end_date')}T${form.get('planned_end_time') || '18:00'}:00` : null,
      cargo_description: form.get('cargo') as string,
      cargo_weight_kg: form.get('weight') ? parseInt(form.get('weight') as string) : null,
      notes: form.get('notes') as string,
      status: 'requested',
    }).select().single()

    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/operations/trips/detail?id=${data.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">New Trip Request</h1>
          <p className="page-subtitle">Submit a vehicle movement request for dispatch planning</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-red mb-4">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 9v2m0 4h.01m-6.938 4h13.856"/></svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <div className="card-header"><span className="card-title">Trip Details</span></div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Planned Date *</label>
              <input name="planned_date" type="date" className="form-control" required
                defaultValue={new Date().toISOString().split('T')[0]}/>
            </div>
            <div>
              <label className="form-label">Departure Time *</label>
              <input name="planned_time" type="time" className="form-control" required defaultValue="09:00"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Vehicle Type Needed</label>
              <select name="vehicle_type" className="form-control">
                <option value="any">Any available</option>
                <option value="pickup">Pickup Truck</option>
                <option value="van">Van</option>
                <option value="truck_medium">Medium Truck</option>
                <option value="truck_heavy">Heavy Truck</option>
                <option value="reefer">Reefer Truck</option>
              </select>
            </div>
            <div>
              <label className="form-label">Priority</label>
              <select name="priority" className="form-control">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="planned">Planned</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Cargo Description</label>
            <textarea name="cargo" className="form-control" rows={3}
              placeholder="Describe cargo, special handling requirements…"/>
          </div>
          <div>
            <label className="form-label">Estimated Weight (kg)</label>
            <input name="weight" type="number" className="form-control" placeholder="0"/>
          </div>
          <div>
            <label className="form-label">Additional Notes</label>
            <textarea name="notes" className="form-control" rows={2}/>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
