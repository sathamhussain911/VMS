'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const GROQ_KEY = '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'

function Ring({ pct, color, size = 48 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = Math.min(pct, 100) / 100 * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={5}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}/>
    </svg>
  )
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${max > 0 ? Math.min((value/max)*100, 100) : 0}%`, background: color, borderRadius: 99, transition: 'width 1s ease' }}/>
    </div>
  )
}

function TripBars({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 56 }}>
      {data.map((v, i) => {
        const isToday = i === data.length - 1
        const d = new Date(); d.setDate(d.getDate() - (data.length - 1 - i))
        const label = d.toLocaleDateString('en', { weekday: 'short' }).charAt(0)
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ fontSize: 8, color: isToday ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>{v}</div>
            <div style={{ width: '100%', height: `${Math.max((v/max)*40, 3)}px`, background: isToday ? '#4ade80' : 'rgba(255,255,255,0.2)', borderRadius: 2, transition: 'height 0.8s ease' }}/>
            <div style={{ fontSize: 8, color: isToday ? '#4ade80' : 'rgba(255,255,255,0.25)' }}>{label}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function CEODashboard() {
  const supabase = createClient()
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(new Date())
  const [tab, setTab] = useState<'overview'|'fleet'|'drivers'|'costs'>('overview')
  const [messages, setMessages] = useState([{ role: 'ai', text: "Good day. I'm your FFC Transport AI Agent.\n\nI have full live visibility of your fleet operations — vehicles, drivers, trips, fuel and costs.\n\nAsk me anything or tap a quick prompt below." }])
  const [input, setInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const load = useCallback(async () => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const m30 = new Date(now); m30.setDate(now.getDate() - 30)
    const [vR,dR,tR,fR,mR,bR,apR,fiR] = await Promise.all([
      supabase.from('vehicles').select('id,status,mulkiya_expiry,insurance_expiry,next_service_date').is('deleted_at',null),
      supabase.from('drivers').select('id,full_name,status,duty_status,performance_score').eq('status','active'),
      supabase.from('trips').select('id,status,total_distance,planned_start,branch:branches(name)').gte('planned_start',m30.toISOString()).is('deleted_at',null),
      supabase.from('fuel_entries').select('amount,litres,efficiency_kmpl,anomaly_flag').gte('created_at',m30.toISOString()),
      supabase.from('maintenance_records').select('cost,status').gte('service_date',today.slice(0,7)+'-01'),
      supabase.from('breakdown_reports').select('id,severity,status').gte('reported_at',m30.toISOString()),
      supabase.from('approvals').select('id,status').gte('created_at',m30.toISOString()),
      supabase.from('traffic_fines').select('fine_amount,status').gte('fine_date',today.slice(0,7)+'-01'),
    ])
    const v=vR.data??[]; const d=dR.data??[]; const t=tR.data??[]
    const f=fR.data??[]; const m=mR.data??[]; const b=bR.data??[]
    const ap=apR.data??[]; const fi=fiR.data??[]
    const in30=new Date(); in30.setDate(now.getDate()+30)
    const completed=t.filter(x=>x.status==='completed')
    const totalDist=completed.reduce((s,x)=>s+(x.total_distance??0),0)
    const fuelCost=f.reduce((s,x)=>s+(x.amount??0),0)
    const maintCost=m.filter(x=>x.status==='completed').reduce((s,x)=>s+(x.cost??0),0)
    const finesCost=fi.filter(x=>x.status!=='waived').reduce((s,x)=>s+(x.fine_amount??0),0)
    const bMap:Record<string,number>={}; t.forEach(x=>{const n=x.branch?.name??'Unknown';bMap[n]=(bMap[n]??0)+1})
    const trend=Array.from({length:7},(_,i)=>{const dd=new Date();dd.setDate(dd.getDate()-6+i);const ds=dd.toISOString().split('T')[0];return t.filter(x=>x.planned_start?.startsWith(ds)).length})
    setData({
      v,d,t,f,m,b,ap,fi,
      available:v.filter(x=>x.status==='available').length,
      assigned:v.filter(x=>x.status==='assigned').length,
      maintenance:v.filter(x=>x.status==='maintenance').length,
      fleetUtil:v.length>0?Math.round((v.filter(x=>x.status==='assigned').length/v.length)*100):0,
      docAlerts:v.filter(x=>(x.mulkiya_expiry&&new Date(x.mulkiya_expiry)<in30)||(x.insurance_expiry&&new Date(x.insurance_expiry)<in30)),
      expiredDocs:v.filter(x=>(x.mulkiya_expiry&&new Date(x.mulkiya_expiry)<now)||(x.insurance_expiry&&new Date(x.insurance_expiry)<now)),
      serviceDue:v.filter(x=>x.next_service_date&&new Date(x.next_service_date)<=in30),
      completed,totalDist,completionRate:t.length>0?Math.round((completed.length/t.length)*100):0,
      onDuty:d.filter(x=>x.duty_status==='on_duty'||x.duty_status==='on_trip'),
      avgScore:d.length?Math.round(d.reduce((s,x)=>s+(x.performance_score??100),0)/d.length):0,
      topDrivers:[...d].sort((a,b)=>(b.performance_score??0)-(a.performance_score??0)).slice(0,5),
      lowDrivers:d.filter(x=>(x.performance_score??100)<70),
      fuelCost,maintCost,finesCost,totalCost:fuelCost+maintCost+finesCost,
      costPerKm:totalDist>0?(fuelCost+maintCost)/totalDist:0,
      fuelLitres:f.reduce((s,x)=>s+(x.litres??0),0),
      avgEff:(()=>{const e=f.filter(x=>x.efficiency_kmpl);return e.length?e.reduce((s,x)=>s+x.efficiency_kmpl,0)/e.length:0})(),
      anomalies:f.filter(x=>x.anomaly_flag).length,
      openBreakdowns:b.filter(x=>x.status!=='resolved').length,
      pendingApprovals:ap.filter(x=>x.status==='pending').length,
      unpaidFines:fi.filter(x=>x.status==='unpaid').length,
      todayTrips:t.filter(x=>x.planned_start?.startsWith(today)),
      trend,branches:Object.entries(bMap).sort((a,b)=>b[1]-a[1]),
    })
    setLoading(false)
  },[])

  useEffect(()=>{load()},[load])
  useEffect(()=>{const t=setInterval(load,120000);return()=>clearInterval(t)},[load])

  async function sendMessage(q?: string) {
    const question = q ?? input.trim()
    if (!question || aiLoading) return
    setInput('')
    setMessages(p=>[...p,{role:'user',text:question}])
    setAiLoading(true)
    const ctx=data?`FFC TRANSPORT LIVE (${new Date().toLocaleDateString('en-AE')}): Fleet:${data.v.length} total|${data.available} available|${data.assigned} deployed|${data.fleetUtil}% util. Docs:${data.expiredDocs.length} EXPIRED|${data.docAlerts.length} expiring. Trips(30d):${data.t.length}|${data.completed.length} done(${data.completionRate}%)|${data.todayTrips.length} today. Drivers:${data.d.length}|${data.onDuty.length} on duty|${data.avgScore}/100|${data.lowDrivers.length} below 70. Cost:Fuel AED${data.fuelCost.toFixed(0)}|Maint AED${data.maintCost.toFixed(0)}|Fines AED${data.finesCost.toFixed(0)}|Total AED${data.totalCost.toFixed(0)}|AED${data.costPerKm.toFixed(2)}/km. Issues:${data.openBreakdowns} breakdowns|${data.pendingApprovals} approvals|${data.unpaidFines} fines. Branches:${data.branches.slice(0,4).map(([n,c]:any)=>`${n}:${c}`).join(',')}`:''
    try {
      const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${GROQ_KEY}`},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'system',content:`You are the AI Transport Analyst for Fresh Fruits Company UAE. Advise the CEO sharply. Use bullet points. Bold critical issues. End with a clear recommendation. Max 160 words. Currency: AED.`},{role:'user',content:`Data: ${ctx}\n\nQuestion: ${question}`}],temperature:0.2,max_tokens:500})})
      const result=await res.json()
      setMessages(p=>[...p,{role:'ai',text:result.choices?.[0]?.message?.content??'Unable to respond.'}])
    } catch {
      setMessages(p=>[...p,{role:'ai',text:'⚠️ Connection error. Please retry.'}])
    }
    setAiLoading(false)
  }

  const G='#4ade80'; const B='#60a5fa'; const A='#fbbf24'; const R='#f87171'
  const BG='rgb(8,12,18)'; const CARD='rgba(255,255,255,0.05)'; const BORDER='rgba(255,255,255,0.08)'
  const QUICK=['Biggest risk now?','Fleet health','Cost analysis','Driver concerns','Branch performance','Predict next week']

  if (loading) return (
    <div style={{background:BG,margin:'-24px',minHeight:'calc(100vh - 64px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:36,height:36,border:'3px solid rgba(74,222,128,0.2)',borderTopColor:G,borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 10px'}}/>
        <div style={{color:'rgba(255,255,255,0.3)',fontFamily:'monospace',fontSize:10,letterSpacing:'0.1em'}}>LOADING…</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const D=data!

  return (
    <div style={{background:BG,margin:'-24px',minHeight:'calc(100vh - 64px)',color:'#fff',fontFamily:"'Plus Jakarta Sans',sans-serif",display:'flex',flexDirection:'column'}}>

      {/* TOP BAR */}
      <div style={{padding:'12px 20px',borderBottom:`1px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:30,height:30,borderRadius:7,overflow:'hidden',flexShrink:0}}><img src="/ffc-logo.png" alt="FFC" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
          <div>
            <div style={{fontSize:12,fontWeight:700,letterSpacing:'0.08em',color:'rgba(255,255,255,0.9)'}}>EXECUTIVE COMMAND CENTER</div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontFamily:'monospace'}}>Fresh Fruits Company UAE · Transport Intelligence</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:6,height:6,borderRadius:'50%',background:G,animation:'pulse 2s infinite'}}/><span style={{fontSize:9,color:'rgba(255,255,255,0.35)',fontFamily:'monospace'}}>LIVE</span></div>
          <div style={{fontFamily:'monospace',fontSize:12,color:'rgba(255,255,255,0.45)'}}>{time.toLocaleTimeString('en-AE',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>
          <button onClick={load} style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:15}}>↻</button>
          <Link href="/dashboard" style={{fontSize:10,color:'rgba(255,255,255,0.3)',textDecoration:'none'}}>← Ops Dashboard</Link>
        </div>
      </div>

      {/* ALERTS STRIP */}
      {(D.expiredDocs.length>0||D.openBreakdowns>0||D.pendingApprovals>0)&&(
        <div style={{padding:'7px 20px',background:'rgba(248,113,113,0.07)',borderBottom:`1px solid rgba(248,113,113,0.15)`,display:'flex',alignItems:'center',gap:16,flexShrink:0,flexWrap:'wrap'}}>
          <span style={{fontSize:9,fontWeight:700,color:R,letterSpacing:'0.1em'}}>⚠ ALERTS</span>
          {D.expiredDocs.length>0&&<span style={{fontSize:10,color:'rgba(255,255,255,0.5)'}}>📄 {D.expiredDocs.length} expired docs</span>}
          {D.openBreakdowns>0&&<span style={{fontSize:10,color:'rgba(255,255,255,0.5)'}}>🔧 {D.openBreakdowns} open breakdowns</span>}
          {D.pendingApprovals>0&&<span style={{fontSize:10,color:'rgba(255,255,255,0.5)'}}>✅ {D.pendingApprovals} pending approvals</span>}
          {D.unpaidFines>0&&<span style={{fontSize:10,color:'rgba(255,255,255,0.5)'}}>🚦 {D.unpaidFines} unpaid fines</span>}
        </div>
      )}

      {/* MAIN BODY — side by side */}
      <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 340px',overflow:'hidden',minHeight:0}}>

        {/* LEFT: metrics */}
        <div style={{overflowY:'auto',padding:'14px 14px 14px 20px',display:'flex',flexDirection:'column',gap:12}}>

          {/* KPI row */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            {[
              {label:'FLEET UTIL',value:`${D.fleetUtil}%`,sub:`${D.assigned}/${D.v.length} deployed`,color:G,ring:D.fleetUtil},
              {label:'COMPLETION',value:`${D.completionRate}%`,sub:`${D.completed.length}/${D.t.length} trips`,color:B,ring:D.completionRate},
              {label:'OP COST',value:`AED ${(D.totalCost/1000).toFixed(1)}k`,sub:`AED ${D.costPerKm.toFixed(2)}/km`,color:A,ring:Math.min((D.totalCost/50000)*100,100)},
              {label:'DRIVER AVG',value:`${D.avgScore}`,sub:`${D.onDuty.length} on duty now`,color:D.avgScore>=80?G:A,ring:D.avgScore},
            ].map((k,i)=>(
              <div key={i} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:'12px 12px 10px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                  <span style={{fontSize:8,color:'rgba(255,255,255,0.3)',fontWeight:700,letterSpacing:'0.08em'}}>{k.label}</span>
                  <Ring pct={k.ring} color={k.color} size={34}/>
                </div>
                <div style={{fontSize:20,fontWeight:800,color:'#fff',lineHeight:1}}>{k.value}</div>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',marginTop:2}}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{display:'flex',gap:2,borderBottom:`1px solid ${BORDER}`}}>
            {(['overview','fleet','drivers','costs'] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{padding:'6px 12px',fontSize:10,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',background:'none',border:'none',cursor:'pointer',borderBottom:tab===t?`2px solid ${G}`:'2px solid transparent',color:tab===t?'#fff':'rgba(255,255,255,0.3)',marginBottom:-1}}>{t}</button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {tab==='overview'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:14}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontWeight:700,letterSpacing:'0.08em',marginBottom:12}}>TRIP VOLUME — 7 DAYS</div>
                <TripBars data={D.trend}/>
              </div>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:14}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontWeight:700,letterSpacing:'0.08em',marginBottom:10}}>BRANCH ACTIVITY</div>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {D.branches.slice(0,4).map(([name,count]:any,i:number)=>(
                    <div key={i}><div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}><span style={{color:'rgba(255,255,255,0.45)'}}>{name.replace(' Branch','').replace('FFC ','')}</span><span style={{color:'#fff',fontWeight:600}}>{count}</span></div><MiniBar value={count} max={D.branches[0]?.[1]??1} color={B}/></div>
                  ))}
                  {D.branches.length===0&&<div style={{color:'rgba(255,255,255,0.2)',fontSize:11}}>No trips yet</div>}
                </div>
              </div>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:14}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontWeight:700,letterSpacing:'0.08em',marginBottom:10}}>FLEET STATUS</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,textAlign:'center'}}>
                  {[['Available',D.available,G],['Deployed',D.assigned,B],['Maint.',D.maintenance,A]].map(([l,v,c]:any)=>(
                    <div key={l}><div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>{l}</div></div>
                  ))}
                </div>
                {D.docAlerts.length>0&&<div style={{marginTop:8,padding:'6px 9px',background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:6,fontSize:10,color:R}}>⚠ {D.docAlerts.length} docs expiring ≤30d</div>}
              </div>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:14}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontWeight:700,letterSpacing:'0.08em',marginBottom:10}}>COST BREAKDOWN (30d)</div>
                {(()=>{const total=D.fuelCost+D.maintCost+D.finesCost||1;return(<>
                  <div style={{display:'flex',height:6,borderRadius:99,overflow:'hidden',marginBottom:8}}>
                    <div style={{width:`${(D.fuelCost/total)*100}%`,background:A}}/><div style={{width:`${(D.maintCost/total)*100}%`,background:B}}/><div style={{width:`${(D.finesCost/total)*100}%`,background:R}}/>
                  </div>
                  {[['⛽ Fuel',D.fuelCost,A],['🔧 Maint.',D.maintCost,B],['🚦 Fines',D.finesCost,R]].map(([l,v,c]:any)=>(
                    <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>{l}</span><span style={{fontSize:10,color:'#fff',fontWeight:600}}>AED {v.toFixed(0)}</span></div>
                  ))}
                  <div style={{borderTop:`1px solid ${BORDER}`,marginTop:4,paddingTop:4,display:'flex',justifyContent:'space-between'}}><span style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>Total</span><span style={{fontSize:12,fontWeight:700,color:'#fff'}}>AED {(D.fuelCost+D.maintCost+D.finesCost).toFixed(0)}</span></div>
                </>)})()}
              </div>
            </div>
          )}

          {/* FLEET TAB */}
          {tab==='fleet'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:14}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontWeight:700,letterSpacing:'0.08em',marginBottom:10}}>VEHICLE HEALTH</div>
                {[['Total',D.v.length,'#fff'],['Available',D.available,G],['Deployed',D.assigned,B],['Maintenance',D.maintenance,A],['Doc Alerts',D.docAlerts.length,D.docAlerts.length>0?R:G],['Service Due',D.serviceDue.length,D.serviceDue.length>0?A:G]].map(([l,v,c]:any)=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${BORDER}`}}><span style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{l}</span><span style={{fontSize:12,fontWeight:700,color:c}}>{v}</span></div>
                ))}
              </div>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:14}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontWeight:700,letterSpacing:'0.08em',marginBottom:10}}>BREAKDOWNS (30d)</div>
                {D.b.length===0?<div style={{color:G,fontSize:12}}>✓ No breakdowns</div>:['critical','major','minor'].map(sev=>{const cnt=D.b.filter((x:any)=>x.severity===sev).length;const col=sev==='critical'?R:sev==='major'?A:'rgba(255,255,255,0.4)';return cnt>0?<div key={sev} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${BORDER}`}}><span style={{fontSize:11,color:'rgba(255,255,255,0.4)',textTransform:'capitalize'}}>{sev}</span><span style={{fontSize:12,fontWeight:700,color:col}}>{cnt}</span></div>:null})}
                <div style={{marginTop:8,fontSize:10,color:'rgba(255,255,255,0.25)'}}>{D.openBreakdowns} still open</div>
              </div>
            </div>
          )}

          {/* DRIVERS TAB */}
          {tab==='drivers'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:14}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontWeight:700,letterSpacing:'0.08em',marginBottom:10}}>TOP PERFORMERS</div>
                {D.topDrivers.map((dr:any,i:number)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:`1px solid ${BORDER}`}}>
                    <div style={{width:18,height:18,borderRadius:'50%',background:i===0?A:BORDER,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:i===0?'#000':'rgba(255,255,255,0.4)',flexShrink:0}}>{i+1}</div>
                    <span style={{flex:1,fontSize:11,color:'rgba(255,255,255,0.7)'}}>{dr.full_name}</span>
                    <span style={{fontSize:12,fontWeight:700,color:(dr.performance_score??100)>=90?G:A}}>{dr.performance_score?.toFixed(0)??'100'}</span>
                  </div>
                ))}
              </div>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:14}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontWeight:700,letterSpacing:'0.08em',marginBottom:10}}>NEEDS ATTENTION</div>
                {D.lowDrivers.length===0?<div style={{color:G,fontSize:11}}>✓ All above score 70</div>:D.lowDrivers.map((dr:any,i:number)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${BORDER}`}}><span style={{fontSize:11,color:'rgba(255,255,255,0.6)'}}>{dr.full_name}</span><span style={{fontSize:12,fontWeight:700,color:R}}>{dr.performance_score?.toFixed(0)??'?'}</span></div>
                ))}
                <div style={{marginTop:10,padding:9,background:'rgba(255,255,255,0.04)',borderRadius:7}}>
                  <div style={{fontSize:9,color:'rgba(255,255,255,0.25)',marginBottom:5}}>DUTY STATUS</div>
                  <div style={{display:'flex',gap:16}}><div><div style={{fontSize:20,fontWeight:800,color:G}}>{D.onDuty.length}</div><div style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>On Duty</div></div><div><div style={{fontSize:20,fontWeight:800,color:'rgba(255,255,255,0.3)'}}>{D.d.length-D.onDuty.length}</div><div style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>Off Duty</div></div></div>
                </div>
              </div>
            </div>
          )}

          {/* COSTS TAB */}
          {tab==='costs'&&(
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
              {[{label:'FUEL',v:D.fuelCost,sub:`${D.fuelLitres.toFixed(0)}L · ${D.avgEff.toFixed(1)}km/L`,c:A,icon:'⛽'},{label:'MAINTENANCE',v:D.maintCost,sub:`${D.m.length} records`,c:B,icon:'🔧'},{label:'FINES',v:D.finesCost,sub:`${D.unpaidFines} unpaid`,c:R,icon:'🚦'}].map((s,i)=>(
                <div key={i} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:14}}>
                  <div style={{fontSize:18,marginBottom:6}}>{s.icon}</div>
                  <div style={{fontSize:8,color:'rgba(255,255,255,0.3)',fontWeight:700,letterSpacing:'0.08em',marginBottom:4}}>{s.label}</div>
                  <div style={{fontSize:18,fontWeight:800,color:s.c}}>AED {s.v.toLocaleString('en',{maximumFractionDigits:0})}</div>
                  <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',marginTop:2}}>{s.sub}</div>
                </div>
              ))}
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:14,gridColumn:'1 / -1',display:'flex',justifyContent:'space-around',alignItems:'center'}}>
                {[['Total Spend',`AED ${D.totalCost.toFixed(0)}`],['Cost/km',D.costPerKm>0?`AED ${D.costPerKm.toFixed(2)}`:'—'],['Total Distance',`${D.totalDist.toLocaleString()} km`],['Approvals',D.pendingApprovals+' pending']].map(([l,v],i)=>(
                  <div key={i} style={{textAlign:'center'}}><div style={{fontSize:16,fontWeight:800,color:'#fff'}}>{v}</div><div style={{fontSize:9,color:'rgba(255,255,255,0.3)',marginTop:2}}>{l}</div></div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: AI AGENT */}
        <div style={{borderLeft:`1px solid ${BORDER}`,display:'flex',flexDirection:'column',overflow:'hidden',background:'rgba(0,0,0,0.25)'}}>

          {/* AI Header */}
          <div style={{padding:'12px 14px',borderBottom:`1px solid ${BORDER}`,flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:9}}>
              <div style={{width:34,height:34,borderRadius:9,background:'linear-gradient(135deg,#4ade80,#16a34a)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>🤖</div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>AI Operations Analyst</div>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:G,animation:'pulse 2s infinite'}}/>
                  <span style={{fontSize:8,color:'rgba(255,255,255,0.3)',fontFamily:'monospace'}}>GROQ · LLAMA 3.3 · LIVE DATA</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick prompts */}
          <div style={{padding:'9px 12px',borderBottom:`1px solid ${BORDER}`,flexShrink:0}}>
            <div style={{fontSize:8,color:'rgba(255,255,255,0.25)',fontWeight:700,letterSpacing:'0.08em',marginBottom:6}}>QUICK ANALYSIS</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {QUICK.map((q,i)=>(
                <button key={i} onClick={()=>sendMessage(q)} disabled={aiLoading}
                  style={{padding:'3px 8px',fontSize:9,background:'rgba(255,255,255,0.05)',border:`1px solid ${BORDER}`,borderRadius:20,color:'rgba(255,255,255,0.5)',cursor:'pointer',whiteSpace:'nowrap',transition:'all 0.15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background='rgba(74,222,128,0.1)';e.currentTarget.style.color=G;e.currentTarget.style.borderColor='rgba(74,222,128,0.3)'}}
                  onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.05)';e.currentTarget.style.color='rgba(255,255,255,0.5)';e.currentTarget.style.borderColor=BORDER}}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:'auto',padding:'12px',display:'flex',flexDirection:'column',gap:10}}>
            {messages.map((msg,i)=>(
              <div key={i} style={{display:'flex',flexDirection:msg.role==='user'?'row-reverse':'row',gap:7,alignItems:'flex-start'}}>
                {msg.role==='ai'&&<div style={{width:24,height:24,borderRadius:6,background:'linear-gradient(135deg,#4ade80,#16a34a)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,flexShrink:0}}>🤖</div>}
                <div style={{maxWidth:'85%',padding:'8px 11px',borderRadius:msg.role==='user'?'11px 11px 3px 11px':'11px 11px 11px 3px',background:msg.role==='user'?'rgba(74,222,128,0.12)':'rgba(255,255,255,0.05)',border:`1px solid ${msg.role==='user'?'rgba(74,222,128,0.2)':BORDER}`,fontSize:11.5,lineHeight:1.6,color:'rgba(255,255,255,0.82)',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
                  {msg.text}
                </div>
              </div>
            ))}
            {aiLoading&&(
              <div style={{display:'flex',gap:7,alignItems:'flex-start'}}>
                <div style={{width:24,height:24,borderRadius:6,background:'linear-gradient(135deg,#4ade80,#16a34a)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,flexShrink:0}}>🤖</div>
                <div style={{padding:'9px 13px',background:'rgba(255,255,255,0.05)',border:`1px solid ${BORDER}`,borderRadius:'11px 11px 11px 3px',display:'flex',gap:4,alignItems:'center'}}>
                  {[0,1,2].map(j=><div key={j} style={{width:5,height:5,borderRadius:'50%',background:G,animation:`bounce 1.2s ease infinite`,animationDelay:`${j*0.2}s`}}/>)}
                </div>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>

          {/* Input */}
          <div style={{padding:'10px 12px',borderTop:`1px solid ${BORDER}`,flexShrink:0}}>
            <div style={{display:'flex',gap:7,alignItems:'flex-end'}}>
              <textarea value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}}}
                placeholder="Ask your AI analyst anything…" rows={2}
                style={{flex:1,background:'rgba(255,255,255,0.06)',border:`1px solid ${BORDER}`,borderRadius:9,padding:'8px 11px',fontSize:11.5,color:'#fff',outline:'none',resize:'none',fontFamily:"'Plus Jakarta Sans',sans-serif",lineHeight:1.5}}
                onFocus={e=>e.currentTarget.style.borderColor='rgba(74,222,128,0.4)'}
                onBlur={e=>e.currentTarget.style.borderColor=BORDER}/>
              <button onClick={()=>sendMessage()} disabled={aiLoading||!input.trim()}
                style={{width:36,height:36,borderRadius:9,border:'none',cursor:aiLoading||!input.trim()?'not-allowed':'pointer',background:aiLoading||!input.trim()?'rgba(255,255,255,0.05)':'linear-gradient(135deg,#4ade80,#16a34a)',color:'#fff',fontSize:15,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s'}}>
                {aiLoading?'⏳':'↑'}
              </button>
            </div>
            <div style={{fontSize:8,color:'rgba(255,255,255,0.2)',textAlign:'center',marginTop:4}}>Enter to send · Shift+Enter for new line</div>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}`}</style>
    </div>
  )
}
