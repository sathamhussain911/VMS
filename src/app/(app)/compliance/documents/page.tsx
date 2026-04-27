'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, expiryStatus, expiryLabel, expiryStatusColour } from '@/lib/utils'

export default function DocumentsPage() {
  const supabase = createClient()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('vehicles').select('id,vehicle_number,mulkiya_expiry,insurance_expiry,gps_contract_expiry').is('deleted_at',null).neq('status','inactive').order('vehicle_number'),
      supabase.from('drivers').select('id,full_name,eid_expiry,license_expiry,passport_expiry').eq('status','active').is('deleted_at',null).order('full_name'),
    ]).then(([vRes, dRes]) => {
      const vehicles = vRes.data??[]
      const drivers = dRes.data??[]
      const all = [
        ...vehicles.flatMap((v:any) => [
          {id:`${v.id}-m`,entity:v.vehicle_number,entityType:'vehicle',docType:'Mulkiya',expiry:v.mulkiya_expiry,status:expiryStatus(v.mulkiya_expiry),href:`/fleet/vehicles/detail?id=${v.id}`},
          {id:`${v.id}-i`,entity:v.vehicle_number,entityType:'vehicle',docType:'Insurance',expiry:v.insurance_expiry,status:expiryStatus(v.insurance_expiry),href:`/fleet/vehicles/detail?id=${v.id}`},
          ...(v.gps_contract_expiry?[{id:`${v.id}-g`,entity:v.vehicle_number,entityType:'vehicle',docType:'GPS Contract',expiry:v.gps_contract_expiry,status:expiryStatus(v.gps_contract_expiry),href:`/fleet/vehicles/detail?id=${v.id}`}]:[]),
        ]),
        ...drivers.flatMap((d:any) => [
          {id:`${d.id}-e`,entity:d.full_name,entityType:'driver',docType:'Emirates ID',expiry:d.eid_expiry,status:expiryStatus(d.eid_expiry),href:`/fleet/drivers/detail?id=${d.id}`},
          {id:`${d.id}-l`,entity:d.full_name,entityType:'driver',docType:'Driving License',expiry:d.license_expiry,status:expiryStatus(d.license_expiry),href:`/fleet/drivers/detail?id=${d.id}`},
          ...(d.passport_expiry?[{id:`${d.id}-p`,entity:d.full_name,entityType:'driver',docType:'Passport',expiry:d.passport_expiry,status:expiryStatus(d.passport_expiry),href:`/fleet/drivers/detail?id=${d.id}`}]:[]),
        ]),
      ]
      const ORDER:any={expired:0,critical:1,warning:2,ok:3,unknown:4}
      setDocs(all.sort((a,b)=>(ORDER[a.status]??4)-(ORDER[b.status]??4)))
      setLoading(false)
    })
  }, [])

  const expired=docs.filter(d=>d.status==='expired').length
  const critical=docs.filter(d=>d.status==='critical').length
  const warning=docs.filter(d=>d.status==='warning').length
  const ok=docs.filter(d=>d.status==='ok').length

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Documents & Expiry</h1><p className="page-subtitle">Mulkiya · Insurance · Emirates ID · Driving License · GPS Contracts</p></div>
      </div>

      {!loading && (expired>0||critical>0) && (
        <div className="alert alert-red mb-5">
          <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4"/></svg>
          <p className="text-sm text-red-700"><strong>{expired} expired</strong> and <strong>{critical} expiring within 7 days</strong>. Expired vehicle documents auto-block new trip assignments.</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[{label:'Expired',value:expired,colour:'red'},{label:'Critical ≤7d',value:critical,colour:'amber'},{label:'Warning ≤30d',value:warning,colour:'blue'},{label:'Valid',value:ok,colour:'green'}]
          .map((s,i)=><div key={i} className={`metric-card ${s.colour}`}><span className="metric-label">{s.label}</span><span className="metric-value">{loading?'…':s.value}</span></div>)}
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Entity</th><th>Type</th><th>Document</th><th>Expiry Date</th><th>Status</th><th>Days Left</th><th>Action</th></tr></thead>
            <tbody>
              {loading?<tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading documents…</td></tr>
              :docs.map(doc=>(
                <tr key={doc.id} className={doc.status==='expired'?'bg-red-50':doc.status==='critical'?'bg-amber-50':''}>
                  <td><Link href={doc.href} className="font-semibold text-primary-700 hover:underline">{doc.entity}</Link><div className="text-[11px] text-gray-400 capitalize">{doc.entityType}</div></td>
                  <td><span className={`badge ${doc.entityType==='vehicle'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>{doc.entityType}</span></td>
                  <td className="font-medium text-[13px]">{doc.docType}</td>
                  <td className="font-mono text-[12.5px]">{formatDate(doc.expiry)}</td>
                  <td><span className={`badge ${expiryStatusColour[doc.status]}`}>{doc.status.toUpperCase()}</span></td>
                  <td className={`font-mono text-[13px] font-bold ${doc.status==='expired'?'text-red-600':doc.status==='critical'?'text-amber-600':'text-gray-600'}`}>{expiryLabel(doc.expiry)}</td>
                  <td>{doc.status!=='ok'&&doc.status!=='unknown'?<Link href={doc.href} className="btn btn-primary btn-sm">Update</Link>:<Link href={doc.href} className="btn btn-secondary btn-sm">View</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
