'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────
interface KPI { label: string; value: string; delta: string; deltaUp: boolean; sub: string; icon: string; color: string }
interface AIMessage { role: 'user' | 'ai'; text: string; time: Date }

// ─── Sparkline SVG ────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 80, h = 28
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="opacity-70">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Ring Chart ───────────────────────────────────────────────
function RingChart({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}/>
    </svg>
  )
}

// ─── Bar Chart ────────────────────────────────────────────────
function MiniBar({ bars, color }: { bars: { label: string; value: number; max: number }[]; color: string }) {
  return (
    <div className="space-y-2">
      {bars.map((b, i) => (
        <div key={i}>
          <div className="flex justify-between text-[11px] mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span>{b.label}</span><span style={{ color: 'rgba(255,255,255,0.8)' }}>{b.value}</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${(b.value / b.max) * 100}%`, background: color }}/>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CEODashboard() {
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(new Date())
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([
    { role: 'ai', text: "Good day. I'm your FFC Transport AI. I have full visibility of your fleet operations. Ask me anything — performance, risks, forecasts, or recommendations.", time: new Date() }
  ])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'fleet' | 'drivers' | 'financial'>('overview')
  const chatRef = useRef<HTMLDivElement>(null)
  const GROQ_KEY = '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'

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const loadData = useCallback(async () => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30)
    const prevMonth = new Date(now); prevMonth.setDate(now.getDate() - 60)
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)

    const [vRes, dRes, tRes, tPrevRes, fRes, mRes, bRes, apprRes, finesRes] = await Promise.all([
      supabase.from('vehicles').select('id,status,mulkiya_expiry,insurance_expiry,next_service_date,vehicle_type,make,model').is('deleted_at', null),
      supabase.from('drivers').select('id,full_name,status,duty_status,performance_score,branch_id').eq('status', 'active'),
      supabase.from('trips').select('id,status,priority,total_distance,planned_start,actual_start,actual_end,branch:branches(name)').gte('planned_start', `${monthAgo.toISOString().split('T')[0]}T00:00:00`).is('deleted_at', null),
      supabase.from('trips').select('id,status').gte('planned_start', `${prevMonth.toISOString().split('T')[0]}T00:00:00`).lte('planned_start', `${monthAgo.toISOString().split('T')[0]}T23:59:59`).is('deleted_at', null),
      supabase.from('fuel_entries').select('amount,litres,efficiency_kmpl,anomaly_flag,created_at').gte('created_at', `${monthAgo.toISOString().split('T')[0]}T00:00:00`),
      supabase.from('maintenance_records').select('cost,status,service_date').gte('service_date', monthAgo.toISOString().split('T')[0]),
      supabase.from('breakdown_reports').select('id,severity,status,reported_at').gte('reported_at', monthAgo.toISOString()),
      supabase.from('approvals').select('id,status,amount,approval_type').gte('created_at', monthAgo.toISOString()),
      supabase.from('traffic_fines').select('id,fine_amount,status,fine_date').gte('fine_date', monthAgo.toISOString().split('T')[0]),
    ])

    const v = vRes.data ?? []; const d = dRes.data ?? []; const t = tRes.data ?? []
    const tPrev = tPrevRes.data ?? []; const f = fRes.data ?? []; const m = mRes.data ?? []
    const b = bRes.data ?? []; const appr = apprRes.data ?? []; const fines = finesRes.data ?? []

    // Today's trips
    const todayTrips = t.filter(x => x.planned_start?.startsWith(today))
    const weekTrips = t.filter(x => new Date(x.planned_start) >= weekAgo)

    // Fleet metrics
    const available = v.filter(x => x.status === 'available').length
    const assigned = v.filter(x => x.status === 'assigned').length
    const maintenance = v.filter(x => x.status === 'maintenance').length
    const fleetUtil = v.length > 0 ? Math.round(((assigned) / v.length) * 100) : 0
    const in30 = new Date(); in30.setDate(now.getDate() + 30)
    const docAlerts = v.filter(x => (x.mulkiya_expiry && new Date(x.mulkiya_expiry) < in30) || (x.insurance_expiry && new Date(x.insurance_expiry) < in30))
    const serviceDue = v.filter(x => x.next_service_date && new Date(x.next_service_date) <= in30)

    // Trip metrics
    const completed = t.filter(x => x.status === 'completed')
    const completionRate = t.length > 0 ? Math.round((completed.length / t.length) * 100) : 0
    const prevCompletion = tPrev.length > 0 ? Math.round((tPrev.filter(x => x.status === 'completed').length / tPrev.length) * 100) : 0
    const totalDist = completed.reduce((s, x) => s + (x.total_distance ?? 0), 0)

    // Driver metrics
    const onDuty = d.filter(x => x.duty_status === 'on_duty' || x.duty_status === 'on_trip')
    const avgScore = d.length ? Math.round(d.reduce((s, x) => s + (x.performance_score ?? 100), 0) / d.length) : 0
    const topDrivers = [...d].sort((a, b) => (b.performance_score ?? 0) - (a.performance_score ?? 0)).slice(0, 5)
    const lowDrivers = [...d].filter(x => (x.performance_score ?? 100) < 70)

    // Financial metrics
    const fuelCost = f.reduce((s, x) => s + (x.amount ?? 0), 0)
    const maintCost = m.filter(x => x.status === 'completed').reduce((s, x) => s + (x.cost ?? 0), 0)
    const finesCost = fines.filter(x => x.status !== 'waived').reduce((s, x) => s + (x.fine_amount ?? 0), 0)
    const totalCost = fuelCost + maintCost + finesCost
    const costPerKm = totalDist > 0 ? totalCost / totalDist : 0
    const fuelAnomalies = f.filter(x => x.anomaly_flag).length
    const totalLitres = f.reduce((s, x) => s + (x.litres ?? 0), 0)
    const avgEfficiency = f.filter(x => x.efficiency_kmpl).length
      ? f.filter(x => x.efficiency_kmpl).reduce((s, x) => s + x.efficiency_kmpl, 0) / f.filter(x => x.efficiency_kmpl).length
      : 0

    // Weekly trip trend (last 7 days)
    const weekTrend = Array.from({ length: 7 }, (_, i) => {
      const d2 = new Date(); d2.setDate(d2.getDate() - 6 + i)
      const ds = d2.toISOString().split('T')[0]
      return t.filter(x => x.planned_start?.startsWith(ds)).length
    })

    // Branch breakdown
    const branchMap: Record<string, { total: number; completed: number }> = {}
    t.forEach(x => {
      const name = x.branch?.name ?? 'Unknown'
      if (!branchMap[name]) branchMap[name] = { total: 0, completed: 0 }
      branchMap[name].total++
      if (x.status === 'completed') branchMap[name].completed++
    })
    const branches = Object.entries(branchMap).map(([name, val]) => ({ name, ...val })).sort((a, b) => b.total - a.total)

    setData({
      v, d, t, f, m, b, appr, fines,
      available, assigned, maintenance, fleetUtil, docAlerts, serviceDue,
      completed, completionRate, prevCompletion, totalDist, todayTrips, weekTrips,
      onDuty, avgScore, topDrivers, lowDrivers,
      fuelCost, maintCost, finesCost, totalCost, costPerKm, fuelAnomalies, totalLitres, avgEfficiency,
      weekTrend, branches,
      openBreakdowns: b.filter(x => x.status !== 'resolved').length,
      pendingApprovals: appr.filter(x => x.status === 'pending').length,
      unpaidFines: fines.filter(x => x.status === 'unpaid').length,
    })
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { const t = setInterval(loadData, 180000); return () => clearInterval(t) }, [loadData])
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }, [aiMessages])

  async function askAI(question: string) {
    if (!question.trim() || aiLoading) return
    setAiInput('')
    setAiMessages(p => [...p, { role: 'user', text: question, time: new Date() }])
    setAiLoading(true)

    const ctx = data ? `
FFC TRANSPORT — LIVE DATA SNAPSHOT (${new Date().toLocaleDateString('en-AE')}):
Fleet: ${data.v.length} vehicles | Available: ${data.available} | In Use: ${data.assigned} | Maintenance: ${data.maintenance} | Fleet Utilisation: ${data.fleetUtil}%
Doc Alerts: ${data.docAlerts.length} vehicles with docs expiring ≤30 days | Service Due: ${data.serviceDue.length}
Trips (30d): ${data.t.length} total | Completed: ${data.completed.length} (${data.completionRate}%) | Today: ${data.todayTrips.length}
Drivers: ${data.d.length} active | On Duty: ${data.onDuty.length} | Avg Score: ${data.avgScore}/100 | Low Performers: ${data.lowDrivers.length}
Financials (30d): Fuel AED ${data.fuelCost.toFixed(0)} | Maintenance AED ${data.maintCost.toFixed(0)} | Fines AED ${data.finesCost.toFixed(0)} | Total AED ${data.totalCost.toFixed(0)} | Cost/km AED ${data.costPerKm.toFixed(2)}
Fuel: ${data.totalLitres.toFixed(0)}L consumed | Avg efficiency ${data.avgEfficiency.toFixed(1)} km/L | ${data.fuelAnomalies} anomalies
Issues: ${data.openBreakdowns} open breakdowns | ${data.pendingApprovals} pending approvals | ${data.unpaidFines} unpaid fines
Distance: ${data.totalDist.toLocaleString()} km total
Branches: ${data.branches.map((b: any) => `${b.name}:${b.total}trips`).join(', ')}
Company: Fresh Fruits Company UAE | Currency: AED
` : 'Data still loading...'

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: `You are the AI Chief Operations Analyst for Fresh Fruits Company UAE. You advise the CEO with sharp, executive-level insights. Be direct, data-driven and specific. Use bullet points. Highlight risks in bold. Always give a clear recommendation. Keep responses under 200 words unless asked for detail. Use AED for currency. Today is ${new Date().toLocaleDateString('en-AE')}.` },
            { role: 'user', content: `Live operational data:\n${ctx}\n\nCEO Question: ${question}` }
          ],
          temperature: 0.2, max_tokens: 800,
        })
      })
      const result = await res.json()
      const answer = result.choices?.[0]?.message?.content ?? 'Unable to get response. Please try again.'
      setAiMessages(p => [...p, { role: 'ai', text: answer, time: new Date() }])
    } catch {
      setAiMessages(p => [...p, { role: 'ai', text: 'Connection error. Please check your network and try again.', time: new Date() }])
    }
    setAiLoading(false)
  }

  const QUICK_PROMPTS = [
    "What's the biggest operational risk right now?",
    "Give me a fleet health summary",
    "Which branch needs attention?",
    "How are our costs trending?",
    "Any driver performance concerns?",
    "Predict next week's issues",
  ]

  const BG = 'rgb(10,14,20)'
  const CARD = 'rgba(255,255,255,0.04)'
  const BORDER = 'rgba(255,255,255,0.08)'
  const GREEN = '#22c55e'
  const BLUE = '#3b82f6'
  const AMBER = '#f59e0b'
  const RED = '#ef4444'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-2 border-t-green-400 border-white/10 animate-spin mx-auto mb-4"/>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 12 }}>LOADING EXECUTIVE INTELLIGENCE…</div>
      </div>
    </div>
  )

  const d2 = data!

  return (
    <div style={{ background: BG, minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' }}>

      {/* ── TOP BAR ── */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '16px 24px' }} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
            <img src="/ffc-logo.png" alt="FFC" className="w-full h-full object-cover"/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.9)' }}>
              EXECUTIVE COMMAND CENTER
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
              Fresh Fruits Company UAE · Transport Operations
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>LIVE</span>
          </div>
          {/* Clock */}
          <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            {time.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>
              {time.toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
          <button onClick={loadData} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }} className="hover:text-white transition-colors">↻</button>
          <Link href="/dashboard" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}
            className="hover:text-white transition-colors">← Ops Dashboard</Link>
        </div>
      </div>

      {/* ── CRITICAL ALERTS STRIP ── */}
      {(d2.docAlerts.length > 0 || d2.openBreakdowns > 0 || d2.fuelAnomalies > 0) && (
        <div style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', padding: '10px 24px' }}
          className="flex items-center gap-6 flex-wrap">
          <div style={{ fontSize: 11, fontWeight: 700, color: RED, letterSpacing: '0.1em' }}>⚠ ALERTS</div>
          {d2.docAlerts.length > 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>📄 {d2.docAlerts.length} docs expiring</div>}
          {d2.openBreakdowns > 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>🔧 {d2.openBreakdowns} open breakdowns</div>}
          {d2.fuelAnomalies > 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>⛽ {d2.fuelAnomalies} fuel anomalies</div>}
          {d2.unpaidFines > 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>🚦 {d2.unpaidFines} unpaid fines</div>}
        </div>
      )}

      <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, maxWidth: 1600, margin: '0 auto' }}>

        {/* ── LEFT MAIN PANEL ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Fleet Utilisation', value: `${d2.fleetUtil}%`, sub: `${d2.assigned} of ${d2.v.length} deployed`, trend: d2.weekTrend, color: GREEN, ring: d2.fleetUtil, icon: '🚛' },
              { label: 'Trip Completion', value: `${d2.completionRate}%`, sub: `${d2.completed.length} / ${d2.t.length} trips`, trend: null, color: BLUE, ring: d2.completionRate, icon: '📦' },
              { label: 'Total Op Cost', value: `AED ${(d2.totalCost / 1000).toFixed(1)}k`, sub: `${d2.costPerKm > 0 ? `AED ${d2.costPerKm.toFixed(2)}/km` : 'No trips'}`, trend: null, color: AMBER, ring: Math.min(100, (d2.totalCost / 50000) * 100), icon: '💰' },
              { label: 'Driver Score', value: `${d2.avgScore}/100`, sub: `${d2.onDuty.length} on duty now`, trend: null, color: d2.avgScore >= 80 ? GREEN : AMBER, ring: d2.avgScore, icon: '👤' },
            ].map((kpi, i) => (
              <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 16px' }}>
                <div className="flex items-start justify-between mb-3">
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em' }}>{kpi.label.toUpperCase()}</div>
                  <RingChart pct={kpi.ring} color={kpi.color} size={44}/>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{kpi.sub}</div>
                {kpi.trend && <div className="mt-3"><Sparkline data={kpi.trend} color={kpi.color}/></div>}
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1" style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 0 }}>
            {(['overview', 'fleet', 'drivers', 'financial'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 16px', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
                  textTransform: 'uppercase', border: 'none', cursor: 'pointer', borderBottom: activeTab === tab ? `2px solid ${GREEN}` : '2px solid transparent',
                  background: 'transparent', color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.35)',
                  transition: 'all 0.2s',
                }}>
                {tab}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Trip trend */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 16 }}>DAILY TRIP VOLUME (7 DAYS)</div>
                <div className="flex items-end gap-2 h-24">
                  {d2.weekTrend.map((val: number, i: number) => {
                    const max = Math.max(...d2.weekTrend, 1)
                    const pct = (val / max) * 100
                    const day = new Date(); day.setDate(day.getDate() - 6 + i)
                    const isToday = i === 6
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{val}</div>
                        <div style={{ width: '100%', height: `${Math.max(pct, 8)}%`, background: isToday ? GREEN : 'rgba(255,255,255,0.15)', borderRadius: 4, transition: 'height 0.8s ease', minHeight: 4 }}/>
                        <div style={{ fontSize: 9, color: isToday ? GREEN : 'rgba(255,255,255,0.3)' }}>
                          {day.toLocaleDateString('en', { weekday: 'short' }).charAt(0)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Branch performance */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 16 }}>BRANCH PERFORMANCE</div>
                {d2.branches.length === 0
                  ? <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No branch data</div>
                  : <MiniBar bars={d2.branches.slice(0, 5).map((b: any) => ({ label: b.name.replace(' Branch', '').replace('FFC ', ''), value: b.total, max: Math.max(...d2.branches.map((x: any) => x.total)) }))} color={BLUE}/>
                }
              </div>

              {/* Fleet status */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 16 }}>FLEET STATUS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Available', value: d2.available, color: GREEN },
                    { label: 'Deployed', value: d2.assigned, color: BLUE },
                    { label: 'Maintenance', value: d2.maintenance, color: AMBER },
                  ].map((s, i) => (
                    <div key={i} className="text-center">
                      <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {d2.docAlerts.length > 0 && (
                  <div style={{ marginTop: 14, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 12, color: RED }}>
                    ⚠ {d2.docAlerts.length} vehicles need document renewal
                  </div>
                )}
              </div>

              {/* Financial summary */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 16 }}>COST BREAKDOWN (30 DAYS)</div>
                <MiniBar bars={[
                  { label: 'Fuel', value: Math.round(d2.fuelCost), max: Math.max(d2.fuelCost, d2.maintCost, d2.finesCost, 1) },
                  { label: 'Maintenance', value: Math.round(d2.maintCost), max: Math.max(d2.fuelCost, d2.maintCost, d2.finesCost, 1) },
                  { label: 'Fines', value: Math.round(d2.finesCost), max: Math.max(d2.fuelCost, d2.maintCost, d2.finesCost, 1) },
                ]} color={AMBER}/>
                <div style={{ marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                  Total: <span style={{ color: '#fff', fontWeight: 700 }}>AED {d2.totalCost.toLocaleString('en', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
          )}

          {/* FLEET TAB */}
          {activeTab === 'fleet' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 16 }}>VEHICLE FLEET ({d2.v.length} TOTAL)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Total', value: d2.v.length, color: '#fff' },
                    { label: 'Available', value: d2.available, color: GREEN },
                    { label: 'Deployed', value: d2.assigned, color: BLUE },
                    { label: 'Maintenance', value: d2.maintenance, color: AMBER },
                    { label: 'Doc Alerts', value: d2.docAlerts.length, color: d2.docAlerts.length > 0 ? RED : GREEN },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 30, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 16 }}>SERVICE DUE (≤30 DAYS)</div>
                {d2.serviceDue.length === 0
                  ? <div style={{ color: GREEN, fontSize: 13 }}>✓ All vehicles serviced on schedule</div>
                  : d2.serviceDue.slice(0, 6).map((v: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                      <span>{v.vehicle_number ?? v.make}</span>
                      <span style={{ color: AMBER }}>{v.next_service_date}</span>
                    </div>
                  ))}
              </div>
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 16 }}>BREAKDOWNS (30 DAYS)</div>
                {d2.b.length === 0
                  ? <div style={{ color: GREEN, fontSize: 13 }}>✓ No breakdowns this month</div>
                  : <div>
                    {[['critical', RED], ['major', AMBER], ['minor', 'rgba(255,255,255,0.4)']].map(([sev, col]) => {
                      const count = d2.b.filter((x: any) => x.severity === sev).length
                      return count > 0 ? (
                        <div key={sev} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${BORDER}`, fontSize: 13 }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{sev}</span>
                          <span style={{ color: col as string, fontWeight: 700 }}>{count}</span>
                        </div>
                      ) : null
                    })}
                    <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                      {d2.openBreakdowns} still open
                    </div>
                  </div>}
              </div>
            </div>
          )}

          {/* DRIVERS TAB */}
          {activeTab === 'drivers' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 16 }}>TOP PERFORMERS</div>
                {d2.topDrivers.map((dr: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? '#f59e0b' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: i === 0 ? '#000' : 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{dr.full_name}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: (dr.performance_score ?? 100) >= 90 ? GREEN : AMBER }}>{dr.performance_score?.toFixed(0) ?? '100'}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 16 }}>NEEDS ATTENTION</div>
                {d2.lowDrivers.length === 0
                  ? <div style={{ color: GREEN, fontSize: 13 }}>✓ All drivers above 70 score</div>
                  : d2.lowDrivers.map((dr: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{dr.full_name}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: RED }}>{dr.performance_score?.toFixed(0) ?? '?'}</div>
                    </div>
                  ))}
                <div style={{ marginTop: 14, padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>DUTY STATUS</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div><div style={{ fontSize: 20, fontWeight: 800, color: GREEN }}>{d2.onDuty.length}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>On Duty</div></div>
                    <div><div style={{ fontSize: 20, fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>{d2.d.length - d2.onDuty.length}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Off Duty</div></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FINANCIAL TAB */}
          {activeTab === 'financial' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { label: 'Fuel Cost', value: d2.fuelCost, icon: '⛽', color: AMBER, sub: `${d2.totalLitres.toFixed(0)}L · ${d2.avgEfficiency.toFixed(1)} km/L avg` },
                { label: 'Maintenance', value: d2.maintCost, icon: '🔧', color: BLUE, sub: `${d2.m.length} service records` },
                { label: 'Traffic Fines', value: d2.finesCost, icon: '🚦', color: RED, sub: `${d2.unpaidFines} unpaid` },
              ].map((s, i) => (
                <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label.toUpperCase()}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>AED {s.value.toLocaleString('en', { maximumFractionDigits: 0 })}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 16 }}>PENDING APPROVALS</div>
                <div style={{ display: 'flex', gap: 20 }}>
                  {[
                    { label: 'Pending', value: d2.pendingApprovals, color: AMBER },
                    { label: 'Total (30d)', value: d2.appr.length, color: 'rgba(255,255,255,0.6)' },
                    { label: 'Total Cost (30d)', value: `AED ${d2.totalCost.toLocaleString('en', { maximumFractionDigits: 0 })}`, color: '#fff' },
                    { label: 'Cost/km', value: d2.costPerKm > 0 ? `AED ${d2.costPerKm.toFixed(2)}` : '—', color: GREEN },
                  ].map((s, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: AI AGENT PANEL ── */}
        <div style={{ display: 'flex', flexDirection: 'column', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden', height: 'calc(100vh - 160px)', position: 'sticky', top: 20 }}>
          {/* AI Header */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
            <div className="flex items-center gap-3">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🤖</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>AI Operations Analyst</div>
                <div className="flex items-center gap-1.5">
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} className="animate-pulse"/>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>GROQ · LLAMA 3.3 · LIVE DATA</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick prompts */}
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 8 }}>QUICK ANALYSIS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_PROMPTS.map((p, i) => (
                <button key={i} onClick={() => askAI(p)} disabled={aiLoading}
                  style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 20, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.1)', e.currentTarget.style.borderColor = 'rgba(34,197,94,0.4)', e.currentTarget.style.color = GREEN)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)', e.currentTarget.style.borderColor = BORDER, e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Chat messages */}
          <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}
            className="scrollbar-thin">
            {aiMessages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
                {msg.role === 'ai' && (
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>🤖</div>
                )}
                <div style={{
                  maxWidth: '82%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(34,197,94,0.25)' : BORDER}`,
                  fontSize: 12.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.text}
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                    {msg.time.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {aiLoading && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>🤖</div>
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '14px 14px 14px 4px', display: 'flex', gap: 6, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, animation: 'pulse 1s ease infinite', animationDelay: `${i * 0.2}s` }}/>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '14px 16px', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAI(aiInput) } }}
                placeholder="Ask anything about your operations…"
                rows={2}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 10,
                  padding: '10px 12px', fontSize: 12.5, color: '#fff', outline: 'none', resize: 'none',
                  fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5,
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(34,197,94,0.4)'}
                onBlur={e => e.currentTarget.style.borderColor = BORDER}
              />
              <button onClick={() => askAI(aiInput)} disabled={aiLoading || !aiInput.trim()}
                style={{ width: 40, height: 40, borderRadius: 10, background: aiLoading || !aiInput.trim() ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', cursor: aiLoading || !aiInput.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, transition: 'all 0.2s' }}>
                {aiLoading ? '⏳' : '↑'}
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 6, textAlign: 'center' }}>Enter to send · Shift+Enter for new line</div>
          </div>
        </div>
      </div>
    </div>
  )
}
