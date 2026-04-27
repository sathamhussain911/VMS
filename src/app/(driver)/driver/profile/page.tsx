'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, expiryLabel, expiryStatus, expiryStatusColour } from '@/lib/utils'

export default function DriverProfilePage() {
  const supabase = createClient()
  const [driver, setDriver] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/driver/login'; return }
      const { data } = await supabase.from('drivers').select('*, branch:branches(name)').eq('auth_user_id', user.id).single()
      setDriver(data)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/driver/login'
  }

  if (loading) return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/></div>

  const score = driver?.performance_score ?? 0
  const scoreColour = score >= 80 ? '#3d7a18' : score >= 60 ? '#f5a02a' : '#e53e3e'

  const docs = [
    { label: 'Emirates ID', expiry: driver?.eid_expiry },
    { label: 'Driving License', expiry: driver?.license_expiry },
    { label: 'Passport', expiry: driver?.passport_expiry },
  ].filter(d => d.expiry)

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <div className="bg-primary-800 px-4 pt-10 pb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/driver" className="text-white/70 text-sm">← Home</Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center text-white font-extrabold text-[22px]">
            {driver?.full_name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
          </div>
          <div>
            <div className="text-white font-bold text-[18px]">{driver?.full_name}</div>
            <div className="text-primary-300 text-[12px]">{driver?.employee_id} · {driver?.branch?.name}</div>
            <div className="text-primary-300 text-[12px] mt-0.5">{driver?.mobile}</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Performance score */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-[12px] text-gray-500 font-medium uppercase tracking-wide mb-3">Performance Score</div>
          <div className="flex items-center gap-4">
            <div className="text-[48px] font-extrabold" style={{color:scoreColour}}>{score.toFixed(0)}</div>
            <div className="flex-1">
              <div className="progress-bar h-3 mb-2">
                <div className="progress-fill h-full" style={{width:`${score}%`, background:scoreColour}}/>
              </div>
              <div className="text-[12px] text-gray-400">Target ≥ 80 · {score>=80?'✅ On target':'⚠️ Below target'}</div>
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-[12px] text-gray-500 font-medium uppercase tracking-wide mb-3">My Documents</div>
          <div className="space-y-2.5">
            {docs.map((d,i) => {
              const st = expiryStatus(d.expiry)
              return (
                <div key={i} className={`flex justify-between items-center p-2.5 rounded-lg ${st==='expired'?'bg-red-50':st==='critical'?'bg-amber-50':st==='warning'?'bg-yellow-50':'bg-green-50'}`}>
                  <div className="font-medium text-[13px]">{d.label}</div>
                  <span className={`badge ${expiryStatusColour[st]} text-[11px]`}>{expiryLabel(d.expiry)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Driver info */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-[12px] text-gray-500 font-medium uppercase tracking-wide mb-3">Details</div>
          <div className="space-y-2">
            {[
              { label:'Driver Code',    value: driver?.driver_code },
              { label:'License #',      value: driver?.license_number },
              { label:'License Class',  value: driver?.license_class },
              { label:'Employment',     value: driver?.employment_type },
              { label:'Joining Date',   value: formatDate(driver?.joining_date) },
            ].map((f,i) => (
              <div key={i} className="flex justify-between text-[13px] py-1 border-b border-gray-100 last:border-0">
                <span className="text-gray-500">{f.label}</span>
                <span className="font-medium text-gray-800">{f.value ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <button onClick={handleSignOut} className="w-full border border-red-200 text-red-600 bg-red-50 rounded-xl py-3 font-semibold text-[14px]">
          Sign Out
        </button>
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
