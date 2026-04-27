'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { expiryStatus, expiryLabel, expiryStatusColour, vehicleStatusColour } from '@/lib/utils'

export default function VehiclesPage() {
  const supabase = createClient()
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => { loadVehicles() }, [])

  async function loadVehicles() {
    const { data } = await supabase
      .from('vehicles')
      .select('*, branch:branches(name,code), current_driver:drivers(full_name)')
      .is('deleted_at', null)
      .order('vehicle_number')
    setVehicles(data ?? [])
    setLoading(false)
  }

  const filtered = vehicles.filter(v => {
    const matchSearch = !search || v.vehicle_number?.toLowerCase().includes(search.toLowerCase()) || v.make?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || v.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: vehicles.length,
    available: vehicles.filter(v => v.status==='available').length,
    maintenance: vehicles.filter(v => v.status==='maintenance').length,
    issues: vehicles.filter(v => ['expired','critical'].includes(expiryStatus(v.mulkiya_expiry))||['expired','critical'].includes(expiryStatus(v.insurance_expiry))).length,
  }

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Vehicle Master</h1><p className="page-subtitle">Fleet inventory, compliance status & document tracking</p></div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={()=>{const csv=filtered.map(v=>`${v.vehicle_number},${v.make},${v.model},${v.status}`).join('\n');const a=document.createElement('a');a.href='data:text/csv,Vehicle,Make,Model,Status\n'+csv;a.download='vehicles.csv';a.click()}}>Export CSV</button>
          <Link href="/fleet/vehicles/new" className="btn btn-primary">+ Add Vehicle</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[{label:'Total Fleet',value:stats.total,colour:'green'},{label:'Available',value:stats.available,colour:'green'},{label:'Maintenance',value:stats.maintenance,colour:'amber'},{label:'Doc Issues',value:stats.issues,colour:stats.issues>0?'red':'green'}]
          .map((s,i)=><div key={i} className={`metric-card ${s.colour}`}><span className="metric-label">{s.label}</span><span className="metric-value">{loading?'…':s.value}</span></div>)}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 h-9 flex-1 min-w-[200px] focus-within:border-primary-500">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
          <input type="text" placeholder="Search vehicle number…" value={search} onChange={e=>setSearch(e.target.value)} className="bg-transparent outline-none text-[13px] w-full"/>
        </div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="form-control h-9 w-auto">
          <option value="">All Statuses</option>
          <option value="available">Available</option>
          <option value="assigned">Assigned</option>
          <option value="maintenance">Maintenance</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Vehicle #</th><th>Type / Make</th><th>Branch</th><th>Driver</th><th>Status</th><th>Mulkiya</th><th>Insurance</th><th>Odometer</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="text-center py-10 text-gray-400">Loading vehicles…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={9} className="text-center py-10 text-gray-400">No vehicles found</td></tr>
              : filtered.map(v => {
                const mSt=expiryStatus(v.mulkiya_expiry), iSt=expiryStatus(v.insurance_expiry)
                return (
                  <tr key={v.id}>
                    <td><Link href={`/fleet/vehicles/detail?id=${v.id}`} className="font-semibold text-primary-700 hover:underline">{v.vehicle_number}</Link></td>
                    <td><div className="font-medium capitalize">{v.vehicle_type?.replace('_',' ')}</div><div className="text-[11.5px] text-gray-400">{v.make} {v.model}</div></td>
                    <td className="text-[13px]">{v.branch?.name??'—'}</td>
                    <td className="text-[13px]">{v.current_driver?.full_name??<span className="text-gray-400">Unassigned</span>}</td>
                    <td><span className={`badge ${vehicleStatusColour[v.status]??'bg-gray-100 text-gray-500'}`}>{v.status.replace('_',' ')}</span></td>
                    <td><span className={`badge ${expiryStatusColour[mSt]}`}>{expiryLabel(v.mulkiya_expiry)}</span></td>
                    <td><span className={`badge ${expiryStatusColour[iSt]}`}>{expiryLabel(v.insurance_expiry)}</span></td>
                    <td className="font-mono text-[12px] text-gray-500">{v.current_odometer?.toLocaleString()} km</td>
                    <td><Link href={`/fleet/vehicles/detail?id=${v.id}`} className="btn btn-secondary btn-sm">View</Link></td>
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
