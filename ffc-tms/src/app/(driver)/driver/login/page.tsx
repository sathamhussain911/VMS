'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DriverLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [employeeId, setEmployeeId] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Look up driver by employee_id to get their email
    const { data: driver } = await supabase
      .from('drivers')
      .select('id,full_name,auth_user_id,status')
      .eq('employee_id', employeeId.trim().toUpperCase())
      .eq('status', 'active')
      .single()

    if (!driver) { setError('Employee ID not found or account inactive'); setLoading(false); return }
    if (!driver.auth_user_id) { setError('Driver portal not set up. Contact IT Admin.'); setLoading(false); return }

    // Sign in with driver email + PIN as password
    // Convention: driver email = employeeId.toLowerCase()@driver.ffc.internal
    const email = `${employeeId.trim().toLowerCase()}@driver.ffc.internal`
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: pin })

    if (authError) { setError('Invalid PIN. Please try again.'); setLoading(false); return }
    router.push('/driver')
  }

  return (
    <div className="min-h-screen bg-primary-900 flex items-center justify-center px-4"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl mb-4 shadow-lg">
            <span className="text-white font-extrabold text-xl">FFC</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Driver Portal</h1>
          <p className="text-primary-300 text-sm mt-1">Fresh Fruits Company</p>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden shadow-modal">
          <div className="p-7">
            <h2 className="text-[16px] font-bold text-gray-900 mb-5">Sign in with your PIN</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="form-label">Employee ID</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. EMP-1021"
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  required
                  autoCapitalize="characters"
                />
              </div>
              <div>
                <label className="form-label">6-Digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="form-control text-[20px] tracking-[0.5em] text-center font-mono"
                  placeholder="• • • • • •"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-lg w-full justify-center mt-1"
                disabled={loading}
              >
                {loading ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : null}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-5">
              PIN set by IT Admin · Rotates every 90 days
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-primary-400 mt-4">
          Office staff?{' '}
          <a href="/login" className="text-primary-300 font-semibold hover:underline">Office Portal →</a>
        </p>
      </div>
    </div>
  )
}
