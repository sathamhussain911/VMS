'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { expiryStatus, expiryLabel, expiryStatusColour, driverStatusColour } from '@/lib/utils'

export default function DriversPage() {
  const supabase = createClient()
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    supabase.from('drivers').select('*, branch:branches(name,code)').is('deleted_at',null).order('full_name')
      .then(({data}) => { setDrivers(data??[]); setLoading(false) })
  }, [])

  const filtered = drivers.filter(d => {
    const matchSearch = !search || d.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || d.status === statusFilter
    return matchSearch && matchStatus
  })

  const activeDrivers = drivers.filter(d=>d.status==='active')
  const avgScore = activeDrivers.length > 0
    ? activeDrivers.filter(d=>d.performance_score!=null).reduce((a,d,_,arr)=>a+d.performance_score/arr.length,0) : 0
  const issues = drivers.filter(d=>['expired','critical'].includes(expiryStatus(d.eid_expiry))||['expired','critical'].includes(expiryStatus(d.license_expiry))).length

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Driver Master</h1><p className="page-subtitle">Driver profiles, document compliance & performance scores</p></div>
        <Link href="/fleet/drivers/new" className="btn btn-primary">+ Add Driver</Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[{label:'Total Drivers',value:drivers.length,colour:'green'},{label:'Active',value:activeDrivers.length,colour:'green'},
          {label:'Avg Score',value:activeDrivers.length>0?avgScore.toFixed(1):'—',colour:avgScore>=80?'green':'amber'},
          {label:'Doc Issues',value:issues,colour:issues>0?'red':'green'}]
          .map((s,i)=><div key={i} className={`metric-card ${s.colour}`}><span className="metric-label">{s.label}</span><span className="metric-value">{loading?'…':s.value}</span></div>)}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 h-9 flex-1 min-w-[200px] focus-within:border-primary-500">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
          <input type="text" placeholder="Search driver name…" value={search} onChange={e=>setSearch(e.target.value)} className="bg-transparent outline-none text-[13px] w-full"/>
        </div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="form-control h-9 w-auto">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Driver</th><th>Emp ID</th><th>Branch</th><th>License Expiry</th><th>EID Expiry</th><th>Performance</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading drivers…</td></tr>
              : filtered.length===0 ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">No drivers found</td></tr>
              : filtered.map(d => {
                const lSt=expiryStatus(d.license_expiry), eSt=expiryStatus(d.eid_expiry)
                return (
                  <tr key={d.id}>
                    <td><Link href={`/fleet/drivers/detail?id=${d.id}`} className="font-semibold text-primary-700 hover:underline">{d.full_name}</Link><div className="text-[11px] text-gray-400">{d.driver_code}</div></td>
                    <td className="font-mono text-[12px]">{d.employee_id??'—'}</td>
                    <td className="text-[13px]">{d.branch?.name??'—'}</td>
                    <td><span className={`badge ${expiryStatusColour[lSt]}`}>{expiryLabel(d.license_expiry)}</span></td>
                    <td><span className={`badge ${expiryStatusColour[eSt]}`}>{expiryLabel(d.eid_expiry)}</span></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="progress-bar w-16"><div className={`progress-fill ${(d.performance_score??0)>=80?'bg-primary-500':'bg-amber'}`} style={{width:`${d.performance_score??0}%`}}/></div>
                        <span className="text-[12.5px] font-bold">{d.performance_score?.toFixed(0)??'—'}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${driverStatusColour[d.status]}`}>{d.status.replace('_',' ')}</span></td>
                    <td><Link href={`/fleet/drivers/detail?id=${d.id}`} className="btn btn-secondary btn-sm">View</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
