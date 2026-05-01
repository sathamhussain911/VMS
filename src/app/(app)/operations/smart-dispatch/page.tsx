'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

const GROQ_KEY = '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'

interface Suggestion {
  trip_id: string
  trip_number: string
  vehicle_id: string
  vehicle_number: string
  driver_id: string
  driver_name: string
  reason: string
  score: number
  priority: string
}

interface AIMessage { role: 'user' | 'ai'; text: string }

export default function SmartDispatchPage() {
  const supabase = createClient()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [trips, setTrips] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState<string>('')
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [tab, setTab] = useState<'plan' | 'board' | 'chat'>('plan')
  const [successMsg, setSuccessMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [tR, vR, dR] = await Promise.all([
      supabase.from('trips')
        .select('id,trip_number,status,priority,planned_start,planned_end,vehicle_id,driver_id,vehicle_type_needed,cargo_description,branch:branches(name,id),vehicle:vehicles(vehicle_number,vehicle_type),driver:drivers(full_name)')
        .gte('planned_start', `${date}T00:00:00`)
        .lte('planned_start', `${date}T23:59:59`)
        .not('status', 'in', '("cancelled")')
        .is('deleted_at', null)
        .order('planned_start'),
      supabase.from('vehicles')
        .select('id,vehicle_number,vehicle_type,make,model,status,current_odometer,branch:branches(name)')
        .neq('status', 'inactive').is('deleted_at', null).order('vehicle_number'),
      supabase.from('drivers')
        .select('id,full_name,duty_status,performance_score,branch:branches(name)')
        .eq('status', 'active').order('full_name'),
    ])
    setTrips(tR.data ?? [])
    setVehicles(vR.data ?? [])
    setDrivers(dR.data ?? [])
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  // ─── Generate AI dispatch plan ────────────────────────────
  async function generatePlan() {
    setGenerating(true)
    setSuggestions([])
    setGenerateError('')

    const unassigned = trips.filter(t => !t.vehicle_id || !t.driver_id)
    const availVehicles = vehicles.filter(v => v.status === 'available' || v.status === 'available')
    const availDrivers = drivers.filter(d => !['on_trip'].includes(d.duty_status ?? ''))

    if (unassigned.length === 0) {
      setSuggestions([])
      setGenerating(false)
      return
    }

    if (availVehicles.length === 0 || availDrivers.length === 0) {
      setGenerateError(`Not enough resources: ${availVehicles.length} vehicles available, ${availDrivers.length} drivers available.`)
      setGenerating(false)
      return
    }

    const prompt = `You are an AI dispatch planner for Fresh Fruits Company UAE.

DATE: ${date}

UNASSIGNED TRIPS (${unassigned.length}):
${unassigned.map(t => `- ID:${t.id} | ${t.trip_number} | Priority:${t.priority} | Time:${formatDate(t.planned_start,'HH:mm')} | Branch:${t.branch?.name} | Vehicle needed:${t.vehicle_type_needed ?? 'any'} | Cargo:${t.cargo_description ?? 'general'}`).join('\n')}

AVAILABLE VEHICLES (${availVehicles.length}):
${availVehicles.map(v => `- ID:${v.id} | ${v.vehicle_number} | Type:${v.vehicle_type} | ${v.make} ${v.model} | Branch:${v.branch?.name} | Odo:${v.current_odometer ?? 0}km`).join('\n')}

AVAILABLE DRIVERS (${availDrivers.length}):
${availDrivers.map(d => `- ID:${d.id} | ${d.full_name} | Score:${d.performance_score ?? 100}/100 | Branch:${d.branch?.name}`).join('\n')}

ALREADY ASSIGNED TRIPS:
${trips.filter(t => t.vehicle_id && t.driver_id).map(t => `- ${t.driver?.full_name} → ${t.vehicle?.vehicle_number} at ${formatDate(t.planned_start,'HH:mm')}`).join('\n') || 'None'}

RULES:
1. Match vehicle type to trip requirement
2. Prefer same-branch vehicle and driver as trip
3. Assign highest-scoring drivers to urgent trips
4. Don't assign same driver to overlapping trips
5. Don't assign same vehicle to overlapping trips
6. Consider odometer — lower is better for long trips

Respond ONLY with valid JSON array. No markdown, no explanation:
[
  {
    "trip_id": "uuid",
    "trip_number": "TRP-XXXX",
    "vehicle_id": "uuid",
    "vehicle_number": "XX000 XX",
    "driver_id": "uuid",
    "driver_name": "Name",
    "reason": "Brief reason for this assignment (1 sentence)",
    "score": 85,
    "priority": "urgent|normal|planned"
  }
]

Only include trips you can assign. If no suitable vehicle or driver, skip that trip.`

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        setGenerating(false)
        setSuggestions([])
        alert('Groq API error: ' + (errData.error?.message ?? res.status))
        return
      }

      const data = await res.json()
      const raw = data.choices?.[0]?.message?.content ?? '[]'

      // Extract JSON array from response — handle various formats
      let jsonStr = raw
      const jsonMatch = raw.match(/\[([\s\S]*?)\]/)
      if (jsonMatch) jsonStr = jsonMatch[0]
      jsonStr = jsonStr.replace(/```json|```/g, '').trim()

      try {
        const parsed = JSON.parse(jsonStr)
        setSuggestions(Array.isArray(parsed) ? parsed : [])
      } catch {
        // If JSON fails, show raw response for debugging
        console.error('JSON parse failed. Raw:', raw)
        setSuggestions([])
        setGenerateError('AI returned unexpected format. Try again.')
      }
    } catch (err: any) {
      console.error('Generate plan error:', err)
      setSuggestions([])
      setGenerateError(err.message ?? 'Network error. Please try again.')
    }
    setGenerating(false)
  }

  // ─── Apply single suggestion ──────────────────────────────
  async function applySuggestion(s: Suggestion) {
    setApplying(s.trip_id)
    const { error } = await supabase.from('trips').update({
      vehicle_id: s.vehicle_id,
      driver_id: s.driver_id,
      status: 'assigned',
    }).eq('id', s.trip_id)

    if (!error) {
      setApplied(prev => new Set([...prev, s.trip_id]))
      setSuccessMsg(`✅ ${s.trip_number} assigned to ${s.driver_name} / ${s.vehicle_number}`)
      setTimeout(() => setSuccessMsg(''), 3000)
      load()
    }
    setApplying('')
  }

  // ─── Apply ALL suggestions ────────────────────────────────
  async function applyAll() {
    const pending = suggestions.filter(s => !applied.has(s.trip_id))
    for (const s of pending) {
      await applySuggestion(s)
    }
    setSuccessMsg(`✅ All ${pending.length} assignments applied!`)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  // ─── AI Chat ──────────────────────────────────────────────
  async function sendChat() {
    if (!input.trim() || chatLoading) return
    const q = input.trim(); setInput('')
    setMessages(p => [...p, { role: 'user', text: q }])
    setChatLoading(true)

    const ctx = `
DATE: ${date}
TRIPS: ${trips.length} total | ${trips.filter(t => !t.vehicle_id || !t.driver_id).length} unassigned | ${trips.filter(t => t.priority === 'urgent').length} urgent
VEHICLES: ${vehicles.length} total | ${vehicles.filter(v => v.status === 'available').length} available | ${vehicles.filter(v => v.status === 'maintenance').length} maintenance
DRIVERS: ${drivers.length} total | ${drivers.filter(d => d.duty_status === 'off_duty').length} available | ${drivers.filter(d => d.duty_status === 'on_duty' || d.duty_status === 'on_trip').length} on duty
SUGGESTIONS GENERATED: ${suggestions.length} | APPLIED: ${applied.size}
`
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: `You are the Smart Dispatch AI for Fresh Fruits Company UAE. Help the dispatcher make optimal decisions. Be concise and specific. Use AED for costs. Today is ${date}.` },
            { role: 'user', content: `Dispatch data:\n${ctx}\n\nQuestion: ${q}` }
          ],
          temperature: 0.2, max_tokens: 400,
        })
      })
      const data = await res.json()
      setMessages(p => [...p, { role: 'ai', text: data.choices?.[0]?.message?.content ?? 'No response' }])
    } catch {
      setMessages(p => [...p, { role: 'ai', text: '⚠️ Connection error. Please retry.' }])
    }
    setChatLoading(false)
  }

  const unassigned = trips.filter(t => !t.vehicle_id || !t.driver_id)
  const assigned = trips.filter(t => t.vehicle_id && t.driver_id)
  const urgent = unassigned.filter(t => t.priority === 'urgent')

  const PRIORITY_COLOR: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700 border-red-200',
    normal: 'bg-gray-100 text-gray-600 border-gray-200',
    planned: 'bg-blue-100 text-blue-700 border-blue-200',
  }

  const STATUS_COLOR: Record<string, string> = {
    requested: 'bg-gray-100 text-gray-600',
    approved: 'bg-purple-100 text-purple-700',
    assigned: 'bg-sky-100 text-sky-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🤖 Smart Dispatch AI</h1>
          <p className="page-subtitle">AI-powered vehicle and driver assignment — plans your full day in seconds</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" className="form-control h-9 w-40"
            value={date} onChange={e => setDate(e.target.value)} />
          <button onClick={load} className="btn btn-secondary">↻</button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-[13px] text-green-700 font-medium">
          {successMsg}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Total Trips', value: trips.length, color: 'text-gray-800', icon: '📦' },
          { label: 'Unassigned', value: unassigned.length, color: unassigned.length > 0 ? 'text-red-600' : 'text-green-600', icon: '⚠️' },
          { label: 'Urgent', value: urgent.length, color: urgent.length > 0 ? 'text-red-600' : 'text-gray-400', icon: '🚨' },
          { label: 'Available Vehicles', value: vehicles.filter(v => v.status === 'available').length, color: 'text-blue-600', icon: '🚛' },
          { label: 'Available Drivers', value: drivers.filter(d => d.duty_status !== 'on_trip').length, color: 'text-green-600', icon: '👤' },
        ].map((s, i) => (
          <div key={i} className="card"><div className="card-body py-3">
            <div className="text-xl mb-1">{s.icon}</div>
            <div className={`text-[24px] font-extrabold ${s.color}`}>{loading ? '…' : s.value}</div>
            <div className="text-[11px] text-gray-400">{s.label}</div>
          </div></div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 w-fit">
        {[
          { key: 'plan', label: '🤖 AI Dispatch Plan' },
          { key: 'board', label: '📋 Dispatch Board' },
          { key: 'chat', label: '💬 Ask AI' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${tab === t.key ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ AI DISPATCH PLAN TAB ══════════ */}
      {tab === 'plan' && (
        <div className="space-y-5">
          {/* Generate button */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-bold text-[15px] text-gray-800 mb-1">AI Dispatch Planner</div>
                  <div className="text-[13px] text-gray-500">
                    Analyzes all unassigned trips, available vehicles and drivers — then generates the optimal assignment plan instantly.
                  </div>
                  {unassigned.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {urgent.length > 0 && <span className="badge bg-red-100 text-red-700 text-[11px]">🚨 {urgent.length} urgent trip{urgent.length > 1 ? 's' : ''}</span>}
                      <span className="badge bg-amber-100 text-amber-700 text-[11px]">📦 {unassigned.length} need assignment</span>
                      <span className="badge bg-blue-100 text-blue-700 text-[11px]">🚛 {vehicles.filter(v => v.status === 'available').length} vehicles available</span>
                      <span className="badge bg-green-100 text-green-700 text-[11px]">👤 {drivers.filter(d => d.duty_status === 'off_duty').length} drivers available</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {suggestions.length > 0 && applied.size < suggestions.length && (
                    <button onClick={applyAll} className="btn btn-secondary text-green-700 border-green-200">
                      ✅ Apply All ({suggestions.length - applied.size})
                    </button>
                  )}
                  <button onClick={generatePlan} disabled={generating || unassigned.length === 0}
                    className="btn btn-primary disabled:opacity-50 min-w-[160px] justify-center">
                    {generating
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Generating…</>
                      : unassigned.length === 0 ? '✅ All Assigned' : '🤖 Generate Plan'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Generate error */}
          {generateError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-[13px] text-red-700 flex justify-between">
              <span>❌ {generateError}</span>
              <button onClick={() => setGenerateError('')} className="text-red-400">×</button>
            </div>
          )}

          {/* No unassigned */}
          {unassigned.length === 0 && (
            <div className="card">
              <div className="card-body text-center py-12">
                <div className="text-5xl mb-3">✅</div>
                <div className="font-bold text-[18px] text-green-700">All trips assigned!</div>
                <div className="text-gray-400 text-[13px] mt-1">No unassigned trips for {formatDate(date)}</div>
              </div>
            </div>
          )}

          {/* Generating skeleton */}
          {generating && (
            <div className="card">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin"/>
                  <div>
                    <div className="font-semibold text-[14px]">AI is planning your dispatch…</div>
                    <div className="text-[12px] text-gray-400">Analyzing trips, vehicles, drivers and constraints</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          {!generating && suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[15px] text-gray-700">
                  🤖 AI Recommendations — {suggestions.length} assignment{suggestions.length > 1 ? 's' : ''}
                </h2>
                <span className="text-[12px] text-gray-400">{applied.size} of {suggestions.length} applied</span>
              </div>
              {suggestions.map((s, i) => {
                const isApplied = applied.has(s.trip_id)
                const isApplying = applying === s.trip_id
                return (
                  <div key={i} className={`card border-2 transition-all ${isApplied ? 'border-green-300 bg-green-50' : s.priority === 'urgent' ? 'border-red-200' : 'border-gray-200'}`}>
                    <div className="card-body py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="font-mono text-[12px] bg-gray-100 px-2 py-0.5 rounded">{s.trip_number}</span>
                            <span className={`badge text-[11px] border ${PRIORITY_COLOR[s.priority] ?? 'bg-gray-100 text-gray-600'}`}>{s.priority}</span>
                            {isApplied && <span className="badge bg-green-100 text-green-700 text-[11px]">✓ Applied</span>}
                            <span className="text-[11px] text-gray-400 ml-auto">AI Score: <strong>{s.score}/100</strong></span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <div className="bg-white border border-gray-100 rounded-xl p-3">
                              <div className="text-[10px] text-gray-400 font-semibold uppercase mb-1">🚛 Vehicle</div>
                              <div className="font-bold text-[14px] text-gray-800">{s.vehicle_number}</div>
                            </div>
                            <div className="bg-white border border-gray-100 rounded-xl p-3">
                              <div className="text-[10px] text-gray-400 font-semibold uppercase mb-1">👤 Driver</div>
                              <div className="font-bold text-[14px] text-gray-800">{s.driver_name}</div>
                            </div>
                          </div>

                          <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-2.5">
                            <span className="text-blue-400 text-[14px] flex-shrink-0">💡</span>
                            <span className="text-[12px] text-blue-700">{s.reason}</span>
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          {isApplied
                            ? <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-white text-[18px]">✓</div>
                            : (
                              <button onClick={() => applySuggestion(s)} disabled={isApplying}
                                className="btn btn-primary btn-sm disabled:opacity-50">
                                {isApplying ? '⏳' : 'Apply →'}
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* No suggestions generated */}
          {!generating && suggestions.length === 0 && unassigned.length > 0 && (
            <div className="card">
              <div className="card-body text-center py-10 text-gray-400">
                <div className="text-4xl mb-2">🤖</div>
                <div className="font-medium">Click "Generate Plan" to let AI assign vehicles and drivers</div>
              </div>
            </div>
          )}

          {/* Unassigned trips list */}
          {unassigned.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">⚠ Unassigned Trips</span>
                <span className="text-[12px] text-gray-400">{unassigned.length} trips</span>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Trip #</th><th>Time</th><th>Branch</th><th>Priority</th><th>Vehicle Needed</th><th>Action</th></tr></thead>
                  <tbody>
                    {unassigned.map(t => (
                      <tr key={t.id} className={t.priority === 'urgent' ? 'bg-red-50' : ''}>
                        <td className="font-mono text-[12px]">{t.trip_number}</td>
                        <td className="text-[13px]">{formatDate(t.planned_start, 'HH:mm')}</td>
                        <td className="text-[12px]">{t.branch?.name ?? '—'}</td>
                        <td><span className={`badge text-[11px] border ${PRIORITY_COLOR[t.priority] ?? 'bg-gray-100 text-gray-600'}`}>{t.priority}</span></td>
                        <td className="text-[12px] capitalize">{t.vehicle_type_needed ?? 'any'}</td>
                        <td>
                          <Link href={`/operations/trips/detail/assign?id=${t.id}`}
                            className="btn btn-secondary btn-sm text-[11px]">Assign →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ DISPATCH BOARD TAB ══════════ */}
      {tab === 'board' && (
        <div className="space-y-4">
          {/* Assigned trips */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Today's Dispatch — {formatDate(date)}</span>
              <span className="text-[12px] text-gray-400">{assigned.length} assigned · {unassigned.length} pending</span>
            </div>
            {loading ? <div className="p-8 text-center text-gray-400">Loading…</div>
              : trips.length === 0
                ? <div className="p-8 text-center text-gray-400"><div className="text-3xl mb-2">📋</div>No trips for {formatDate(date)}</div>
                : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead><tr><th>Time</th><th>Trip #</th><th>Branch</th><th>Vehicle</th><th>Driver</th><th>Priority</th><th>Status</th></tr></thead>
                      <tbody>
                        {trips.map(t => (
                          <tr key={t.id} className={t.priority === 'urgent' ? 'bg-red-50/50' : ''}>
                            <td className="font-mono text-[12px]">{formatDate(t.planned_start, 'HH:mm')}</td>
                            <td>
                              <Link href={`/operations/trips/detail?id=${t.id}`}
                                className="font-mono text-[12px] bg-gray-100 px-1.5 py-0.5 rounded hover:bg-primary-100 hover:text-primary-700">
                                {t.trip_number}
                              </Link>
                            </td>
                            <td className="text-[12px]">{t.branch?.name ?? '—'}</td>
                            <td className="text-[13px]">
                              {t.vehicle?.vehicle_number
                                ? <span className="font-semibold">{t.vehicle.vehicle_number}</span>
                                : <span className="text-red-500 text-[12px]">⚠ Unassigned</span>}
                            </td>
                            <td className="text-[13px]">
                              {t.driver?.full_name
                                ? t.driver.full_name
                                : <span className="text-red-500 text-[12px]">⚠ Unassigned</span>}
                            </td>
                            <td><span className={`badge text-[11px] border ${PRIORITY_COLOR[t.priority] ?? 'bg-gray-100 text-gray-600'}`}>{t.priority}</span></td>
                            <td><span className={`badge text-[11px] ${STATUS_COLOR[t.status] ?? 'bg-gray-100 text-gray-500'}`}>{t.status.replace('_', ' ')}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
          </div>

          {/* Available resources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <div className="card-header"><span className="card-title">🚛 Available Vehicles</span><span className="text-[12px] text-gray-400">{vehicles.filter(v => v.status === 'available').length}</span></div>
              <div className="divide-y divide-gray-50">
                {vehicles.filter(v => v.status === 'available').slice(0, 8).map(v => (
                  <div key={v.id} className="px-5 py-2.5 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-[13px]">{v.vehicle_number}</div>
                      <div className="text-[11px] text-gray-400">{v.vehicle_type} · {v.branch?.name}</div>
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono">{v.current_odometer?.toLocaleString()} km</div>
                  </div>
                ))}
                {vehicles.filter(v => v.status === 'available').length === 0 && <div className="p-4 text-center text-gray-400 text-[13px]">No vehicles available</div>}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">👤 Available Drivers</span><span className="text-[12px] text-gray-400">{drivers.filter(d => d.duty_status !== 'on_trip').length}</span></div>
              <div className="divide-y divide-gray-50">
                {drivers.filter(d => d.duty_status !== 'on_trip').slice(0, 8).map(d => (
                  <div key={d.id} className="px-5 py-2.5 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-[13px]">{d.full_name}</div>
                      <div className="text-[11px] text-gray-400">{d.branch?.name}</div>
                    </div>
                    <div className={`text-[12px] font-bold ${(d.performance_score ?? 100) >= 90 ? 'text-green-600' : (d.performance_score ?? 100) >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                      {d.performance_score?.toFixed(0) ?? '100'}
                    </div>
                  </div>
                ))}
                {drivers.filter(d => d.duty_status === 'off_duty').length === 0 && <div className="p-4 text-center text-gray-400 text-[13px]">No drivers available</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ AI CHAT TAB ══════════ */}
      {tab === 'chat' && (
        <div className="card" style={{ height: 500, display: 'flex', flexDirection: 'column' }}>
          <div className="card-header flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-700 flex items-center justify-center text-white text-[14px]">🤖</div>
              <div>
                <div className="card-title">Dispatch AI Assistant</div>
                <div className="text-[11px] text-gray-400">Ask anything about today's dispatch</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
            {messages.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <div className="text-3xl mb-2">💬</div>
                <div className="font-medium text-[13px]">Ask me anything about today's dispatch</div>
                <div className="text-[12px] mt-1">e.g. "Which driver is best for the urgent trip?" or "Do I have enough vehicles?"</div>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {['Which trips are urgent?', 'Best driver for urgent trips?', 'Any vehicle conflicts?', 'How many unassigned trips?'].map(q => (
                    <button key={q} onClick={() => { setInput(q); setTimeout(() => sendChat(), 50) }}
                      className="btn btn-secondary btn-sm text-[12px]">{q}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary-700 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5 items-center">
                  {[0,1,2].map(j => <div key={j} style={{ width:6, height:6, borderRadius:'50%', background:'#9ca3af', animation:`bounce 1.2s ease infinite`, animationDelay:`${j*0.2}s` }}/>)}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-100 flex-shrink-0 flex gap-2">
            <input className="form-control flex-1" placeholder="Ask about today's dispatch…"
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendChat() }}/>
            <button onClick={sendChat} disabled={chatLoading || !input.trim()}
              className="btn btn-primary disabled:opacity-50">Send</button>
          </div>
        </div>
      )}

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  )
}
