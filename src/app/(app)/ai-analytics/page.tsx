'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Insight {
  id: string
  category: string
  question: string
  answer: string
  loading: boolean
  error?: string
}

const QUICK_QUESTIONS = [
  { category: '🚛 Fleet', question: 'Analyze my fleet health and identify vehicles that need immediate attention based on status, odometer and document expiry' },
  { category: '⛽ Fuel', question: 'Analyze fuel consumption patterns, efficiency and identify any anomalies or cost saving opportunities' },
  { category: '👤 Drivers', question: 'Evaluate driver performance scores and duty status, identify who needs coaching or recognition' },
  { category: '📦 Trips', question: 'Analyze trip completion rates, cancellations and identify operational bottlenecks' },
  { category: '📄 Compliance', question: 'Flag all compliance risks including expired and expiring vehicle and driver documents' },
  { category: '💰 Costs', question: 'Analyze fuel and operational costs, calculate cost per km and suggest where we can reduce expenses' },
  { category: '📊 Executive Summary', question: 'Give me a complete executive summary of our transport operations with key metrics, wins and areas to improve' },
  { category: '🔮 Predictions', question: 'Based on current data, what issues should I expect in the next 30 days and how should I prepare?' },
]

export default function AIAnalyticsPage() {
  const supabase = createClient()
  const [insights, setInsights] = useState<Insight[]>([])
  const [customQuestion, setCustomQuestion] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [fleetContext, setFleetContext] = useState('')
  const [dataError, setDataError] = useState('')
  const [contextStats, setContextStats] = useState<any>(null)

  useEffect(() => {
    const saved = localStorage.getItem('groq_api_key') || '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'
    setApiKey(saved)
    localStorage.setItem('groq_api_key', saved)
    loadFleetContext()
  }, [])

  async function loadFleetContext() {
    setDataLoading(true)
    setDataError('')
    try {
      const monthAgo = new Date()
      monthAgo.setDate(monthAgo.getDate() - 30)
      const monthAgoStr = monthAgo.toISOString().split('T')[0]

      const [vRes, dRes, tRes, fRes] = await Promise.all([
        supabase.from('vehicles').select('vehicle_number,make,model,status,vehicle_type,current_odometer,mulkiya_expiry,insurance_expiry').is('deleted_at', null),
        supabase.from('drivers').select('full_name,employee_id,status,duty_status,performance_score,eid_expiry,license_expiry').eq('status', 'active'),
        supabase.from('trips').select('trip_number,status,priority,total_distance,planned_start,branch_id').gte('planned_start', `${monthAgoStr}T00:00:00`).is('deleted_at', null),
        supabase.from('fuel_entries').select('litres,amount,efficiency_kmpl,anomaly_flag,created_at').gte('created_at', `${monthAgoStr}T00:00:00`),
      ])

      const v = vRes.data ?? []
      const d = dRes.data ?? []
      const t = tRes.data ?? []
      const f = fRes.data ?? []

      const now = new Date()
      const in30 = new Date(); in30.setDate(now.getDate() + 30)
      const in7 = new Date(); in7.setDate(now.getDate() + 7)

      const completedTrips = t.filter(x => x.status === 'completed').length
      const cancelledTrips = t.filter(x => x.status === 'cancelled').length
      const totalDist = t.reduce((s, x) => s + (x.total_distance ?? 0), 0)
      const totalFuelCost = f.reduce((s, x) => s + (x.amount ?? 0), 0)
      const totalLitres = f.reduce((s, x) => s + (x.litres ?? 0), 0)
      const effList = f.filter(x => x.efficiency_kmpl).map(x => x.efficiency_kmpl)
      const avgEff = effList.length ? effList.reduce((s, x) => s + x, 0) / effList.length : 0
      const avgScore = d.length ? d.reduce((s, x) => s + (x.performance_score ?? 100), 0) / d.length : 100

      // Document expiry analysis
      const expiredVehicleDocs = v.filter(x =>
        (x.mulkiya_expiry && new Date(x.mulkiya_expiry) < now) ||
        (x.insurance_expiry && new Date(x.insurance_expiry) < now)
      )
      const criticalVehicleDocs = v.filter(x =>
        (x.mulkiya_expiry && new Date(x.mulkiya_expiry) > now && new Date(x.mulkiya_expiry) < in7) ||
        (x.insurance_expiry && new Date(x.insurance_expiry) > now && new Date(x.insurance_expiry) < in7)
      )
      const expiredDriverDocs = d.filter(x =>
        (x.eid_expiry && new Date(x.eid_expiry) < now) ||
        (x.license_expiry && new Date(x.license_expiry) < now)
      )

      setContextStats({
        vehicles: v.length, drivers: d.length, trips: t.length,
        completed: completedTrips, cancelled: cancelledTrips,
        fuelCost: totalFuelCost, anomalies: f.filter(x => x.anomaly_flag).length,
        expiredDocs: expiredVehicleDocs.length + expiredDriverDocs.length,
      })

      const ctx = `
FRESH FRUITS COMPANY UAE - LIVE TRANSPORT MANAGEMENT DATA
Report Date: ${new Date().toLocaleDateString('en-AE')} | Period: Last 30 days

━━━ FLEET STATUS (${v.length} vehicles) ━━━
Available: ${v.filter(x => x.status === 'available').length} | Assigned/On Trip: ${v.filter(x => x.status === 'assigned').length} | Under Maintenance: ${v.filter(x => x.status === 'maintenance').length} | Inactive: ${v.filter(x => x.status === 'inactive').length}

Vehicle Details:
${v.map(x => `  • ${x.vehicle_number} | ${x.vehicle_type ?? 'unknown type'} | ${x.make} ${x.model} | Status: ${x.status} | Odometer: ${(x.current_odometer ?? 0).toLocaleString()} km | Mulkiya expires: ${x.mulkiya_expiry ?? 'NOT SET'} | Insurance expires: ${x.insurance_expiry ?? 'NOT SET'}`).join('\n')}

Document Alerts:
${expiredVehicleDocs.length > 0 ? expiredVehicleDocs.map(x => `  🔴 EXPIRED: ${x.vehicle_number} - mulkiya:${x.mulkiya_expiry ?? 'none'}, insurance:${x.insurance_expiry ?? 'none'}`).join('\n') : '  ✅ No expired vehicle documents'}
${criticalVehicleDocs.length > 0 ? criticalVehicleDocs.map(x => `  🟠 CRITICAL (< 7 days): ${x.vehicle_number}`).join('\n') : '  ✅ No critical vehicle document expiries'}

━━━ DRIVERS (${d.length} active) ━━━
On Duty: ${d.filter(x => x.duty_status === 'on_duty').length} | Off Duty: ${d.filter(x => x.duty_status === 'off_duty').length} | On Trip: ${d.filter(x => x.duty_status === 'on_trip').length}
Average Performance Score: ${avgScore.toFixed(1)}/100

Driver Details:
${d.map(x => `  • ${x.full_name} (${x.employee_id ?? 'no ID'}) | Score: ${x.performance_score ?? 100}/100 | Duty: ${x.duty_status} | EID expires: ${x.eid_expiry ?? 'NOT SET'} | License expires: ${x.license_expiry ?? 'NOT SET'}`).join('\n')}

${expiredDriverDocs.length > 0 ? '🔴 EXPIRED DRIVER DOCS:\n' + expiredDriverDocs.map(x => `  • ${x.full_name}: eid:${x.eid_expiry ?? 'none'}, license:${x.license_expiry ?? 'none'}`).join('\n') : '✅ No expired driver documents'}

━━━ TRIP OPERATIONS (${t.length} trips, last 30 days) ━━━
Completed: ${completedTrips} (${t.length > 0 ? Math.round((completedTrips / t.length) * 100) : 0}% completion rate)
Cancelled: ${cancelledTrips} (${t.length > 0 ? Math.round((cancelledTrips / t.length) * 100) : 0}% cancellation rate)
In Progress: ${t.filter(x => x.status === 'in_progress').length}
Pending Approval: ${t.filter(x => x.status === 'requested').length}
Total Distance Covered: ${totalDist.toLocaleString()} km
Urgent Trips: ${t.filter(x => x.priority === 'urgent').length}

━━━ FUEL MANAGEMENT (${f.length} entries, last 30 days) ━━━
Total Cost: AED ${totalFuelCost.toFixed(2)}
Total Litres: ${totalLitres.toFixed(1)} L
Average Efficiency: ${avgEff.toFixed(1)} km/L
Cost per Litre: AED ${totalLitres > 0 ? (totalFuelCost / totalLitres).toFixed(2) : 'N/A'}
Cost per KM: AED ${totalDist > 0 ? (totalFuelCost / totalDist).toFixed(2) : 'N/A'}
Anomalies Flagged: ${f.filter(x => x.anomaly_flag).length}

━━━ COMPANY INFO ━━━
Company: Fresh Fruits Company UAE
Currency: AED (UAE Dirhams)
Branches: FFC Headquarters (Dubai), MS Sharjah Branch, VS Ajman Branch, FFC Al Ain Branch
Industry: Fresh produce logistics and distribution
`.trim()

      setFleetContext(ctx)
    } catch (err: any) {
      setDataError(err.message ?? 'Failed to load fleet data')
    } finally {
      setDataLoading(false)
    }
  }

  async function askGroq(question: string, category: string) {
    if (!apiKey) { setShowKeyInput(true); return }

    const insightId = Date.now().toString()
    setInsights(prev => [{ id: insightId, category, question, answer: '', loading: true }, ...prev])

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are an expert transport fleet operations analyst for Fresh Fruits Company UAE. 
You have deep knowledge of UAE transport regulations, vehicle maintenance, driver management and logistics.
When analyzing data:
- Be specific and mention actual vehicle numbers, driver names, and figures
- Use bullet points and clear sections
- Prioritize issues as 🔴 Critical, 🟠 High, 🟡 Medium, 🟢 Low
- Give concrete, actionable recommendations
- Use AED for all currency values
- Be concise but comprehensive`,
            },
            {
              role: 'user',
              content: `Here is our current fleet data:\n\n${fleetContext}\n\nAnalyze and answer: ${question}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      })

      if (!res.ok) {
        let errMsg = `API error ${res.status}`
        try {
          const err = await res.json()
          errMsg = err.error?.message ?? errMsg
        } catch {}
        throw new Error(errMsg)
      }

      const data = await res.json()
      const answer = data.choices?.[0]?.message?.content ?? 'No response received'
      setInsights(prev => prev.map(i => i.id === insightId ? { ...i, answer, loading: false } : i))
    } catch (err: any) {
      setInsights(prev => prev.map(i => i.id === insightId ? { ...i, error: err.message, loading: false } : i))
    }
  }

  function saveApiKey() {
    localStorage.setItem('groq_api_key', apiKey)
    setShowKeyInput(false)
  }

  const CAT_COLOR: Record<string, string> = {
    '🚛 Fleet': 'bg-blue-100 text-blue-700',
    '⛽ Fuel': 'bg-orange-100 text-orange-700',
    '👤 Drivers': 'bg-purple-100 text-purple-700',
    '📦 Trips': 'bg-green-100 text-green-700',
    '📄 Compliance': 'bg-red-100 text-red-700',
    '💰 Costs': 'bg-emerald-100 text-emerald-700',
    '📊 Executive Summary': 'bg-primary-100 text-primary-700',
    '🔮 Predictions': 'bg-indigo-100 text-indigo-700',
    '💬 Custom': 'bg-gray-100 text-gray-700',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Analytics</h1>
          <p className="page-subtitle">Powered by Groq AI (LLaMA 3.3) — real-time fleet intelligence</p>
        </div>
        <button onClick={() => setShowKeyInput(true)} className={`btn ${apiKey ? 'btn-secondary' : 'btn-primary'}`}>
          {apiKey ? '🔑 Groq Key Set ✓' : '🔑 Set Groq API Key'}
        </button>
      </div>

      {/* API Key Modal */}
      {showKeyInput && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-[16px] mb-1">Groq API Key</h3>
            <p className="text-[13px] text-gray-500 mb-1">Get your free key from <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary-700 underline font-semibold">console.groq.com/keys</a></p>
            <p className="text-[12px] text-gray-400 mb-4">Saved in your browser only — never sent to GitHub or our servers.</p>
            <input type="password" className="form-control mb-4" placeholder="gsk_..." value={apiKey} onChange={e => setApiKey(e.target.value)} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setShowKeyInput(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={saveApiKey} disabled={!apiKey.trim()} className="btn btn-primary flex-1 disabled:opacity-50">Save Key</button>
            </div>
          </div>
        </div>
      )}

      {/* Data status bar */}
      <div className={`rounded-xl p-3 mb-5 flex items-center gap-3 ${dataLoading ? 'bg-gray-50 border border-gray-200' : dataError ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
        {dataLoading ? (
          <><div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"/><span className="text-[13px] text-gray-500">Loading live fleet data…</span></>
        ) : dataError ? (
          <><span>❌</span><span className="text-[13px] text-red-600">{dataError}</span><button onClick={loadFleetContext} className="btn btn-secondary btn-sm ml-auto text-[12px]">↻ Retry</button></>
        ) : (
          <>
            <span className="text-green-600">✅</span>
            <span className="text-[13px] text-green-700 font-medium">Live data loaded</span>
            {contextStats && (
              <div className="flex gap-3 ml-2 text-[12px] text-green-600">
                <span>{contextStats.vehicles} vehicles</span>
                <span>·</span>
                <span>{contextStats.drivers} drivers</span>
                <span>·</span>
                <span>{contextStats.trips} trips</span>
                <span>·</span>
                <span>{contextStats.fuelCost > 0 ? `AED ${contextStats.fuelCost.toFixed(0)} fuel` : 'no fuel data'}</span>
                {contextStats.expiredDocs > 0 && <><span>·</span><span className="text-red-600 font-semibold">⚠️ {contextStats.expiredDocs} expired docs</span></>}
              </div>
            )}
            <button onClick={loadFleetContext} className="ml-auto text-[11px] text-green-600 hover:text-green-800">↻ Refresh</button>
          </>
        )}
      </div>

      {!apiKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <div className="font-bold text-amber-700 mb-1">🔑 Groq API Key Required</div>
          <div className="text-[13px] text-amber-600">
            Get your free API key from <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="underline font-semibold">console.groq.com/keys</a> — it's free and fast. Then click "Set Groq API Key" above.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Left panel - Questions */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="card-title">Quick Analysis</span><span className="text-[11px] text-gray-400">Powered by LLaMA 3.3</span></div>
            <div className="card-body space-y-2">
              {QUICK_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => askGroq(q.question, q.category)}
                  disabled={dataLoading || !apiKey || !!dataError}
                  className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group">
                  <div className="text-[13px] font-semibold text-gray-800 group-hover:text-primary-700">{q.category}</div>
                  <div className="text-[11.5px] text-gray-500 mt-0.5 leading-tight">{q.question}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Ask Anything</span></div>
            <div className="card-body">
              <textarea className="form-control mb-3 text-[13px]" rows={4}
                placeholder="e.g. Which vehicles need service in the next 2 weeks? Which driver has the best fuel efficiency?"
                value={customQuestion}
                onChange={e => setCustomQuestion(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.ctrlKey && customQuestion.trim()) {
                    askGroq(customQuestion, '💬 Custom')
                    setCustomQuestion('')
                  }
                }}
              />
              <button
                onClick={() => { if (customQuestion.trim()) { askGroq(customQuestion, '💬 Custom'); setCustomQuestion('') } }}
                disabled={!customQuestion.trim() || dataLoading || !apiKey || !!dataError}
                className="btn btn-primary w-full justify-center disabled:opacity-50">
                🤖 Ask Groq AI
              </button>
              <div className="text-[11px] text-gray-400 text-center mt-2">Press Ctrl+Enter to send</div>
            </div>
          </div>
        </div>

        {/* Right panel - Insights */}
        <div className="xl:col-span-2 space-y-4">
          {insights.length === 0 && (
            <div className="card">
              <div className="card-body text-center py-16">
                <div className="text-6xl mb-4">🤖</div>
                <div className="font-bold text-[20px] text-gray-700">Groq AI Ready</div>
                <div className="text-gray-400 text-[13px] mt-2 max-w-sm mx-auto">
                  {!apiKey ? 'Set your Groq API key to get started' : 'Click any quick analysis button or ask a custom question to get AI-powered fleet insights'}
                </div>
                {!apiKey && (
                  <button onClick={() => setShowKeyInput(true)} className="btn btn-primary mt-4">
                    🔑 Set Groq API Key
                  </button>
                )}
              </div>
            </div>
          )}

          {insights.map(insight => (
            <div key={insight.id} className="card">
              <div className="card-header">
                <div className="flex-1 min-w-0">
                  <span className={`badge text-[11px] mb-1.5 inline-block ${CAT_COLOR[insight.category] ?? 'bg-gray-100 text-gray-700'}`}>
                    {insight.category}
                  </span>
                  <div className="text-[13px] font-semibold text-gray-700">{insight.question}</div>
                </div>
                <button onClick={() => setInsights(prev => prev.filter(i => i.id !== insight.id))}
                  className="text-gray-300 hover:text-red-400 text-[22px] leading-none flex-shrink-0 ml-3 transition-colors">×</button>
              </div>
              <div className="card-body">
                {insight.loading && (
                  <div className="flex items-center gap-3 py-6">
                    <div className="w-6 h-6 border-2 border-primary-700/20 border-t-primary-700 rounded-full animate-spin flex-shrink-0"/>
                    <div>
                      <div className="text-[13px] text-gray-600 font-medium">Groq AI is analyzing your fleet data…</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">This usually takes 2-5 seconds</div>
                    </div>
                  </div>
                )}
                {insight.error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="font-semibold text-red-700 text-[13px] mb-1">❌ Error</div>
                    <div className="text-[12px] text-red-600">{insight.error}</div>
                    <div className="text-[11px] text-red-400 mt-2">Check your API key is correct and has quota remaining</div>
                  </div>
                )}
                {!insight.loading && !insight.error && insight.answer && (
                  <div className="text-[13.5px] text-gray-700 leading-relaxed whitespace-pre-wrap">{insight.answer}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
