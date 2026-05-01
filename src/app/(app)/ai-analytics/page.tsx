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
  { category: '🚛 Fleet', question: 'Analyze my fleet health and identify vehicles that need immediate attention' },
  { category: '⛽ Fuel', question: 'Analyze fuel consumption patterns and identify any anomalies or inefficiencies' },
  { category: '👤 Drivers', question: 'Evaluate driver performance and identify who needs coaching or recognition' },
  { category: '📦 Trips', question: 'Analyze trip completion rates and identify operational bottlenecks' },
  { category: '🔧 Maintenance', question: 'Review maintenance patterns and predict upcoming service needs' },
  { category: '📄 Compliance', question: 'Flag all compliance risks including expired and expiring documents' },
  { category: '💰 Costs', question: 'Analyze operational costs and suggest where we can reduce expenses' },
  { category: '📊 Summary', question: 'Give me an executive summary of our transport operations this month' },
]

export default function AIAnalyticsPage() {
  const supabase = createClient()
  const [insights, setInsights] = useState<Insight[]>([])
  const [customQuestion, setCustomQuestion] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [fleetContext, setFleetContext] = useState<string>('')

  useEffect(() => {
    // Load saved API key from localStorage
    const saved = localStorage.getItem('grok_api_key') || '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'
    setApiKey(saved)
    localStorage.setItem('grok_api_key', saved)
    loadFleetContext()
  }, [])

  async function loadFleetContext() {
    setDataLoading(true)
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30)
    const monthAgoStr = monthAgo.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    const [
      { data: vehicles },
      { data: drivers },
      { data: trips },
      { data: fuel },
      { data: maintenance },
    ] = await Promise.all([
      supabase.from('vehicles').select('vehicle_number,make,model,status,vehicle_type,current_odometer,mulkiya_expiry,insurance_expiry,next_service_date').is('deleted_at', null),
      supabase.from('drivers').select('full_name,employee_id,status,duty_status,performance_score,eid_expiry,license_expiry').eq('status', 'active'),
      supabase.from('trips').select('trip_number,status,priority,total_distance,planned_start,actual_start,actual_end').gte('planned_start', `${monthAgoStr}T00:00:00`).is('deleted_at', null),
      supabase.from('fuel_entries').select('litres,amount,efficiency_kmpl,anomaly_flag,created_at').gte('created_at', `${monthAgoStr}T00:00:00`),
      supabase.from('maintenance_records').select('maintenance_type,cost,status,service_date,title').gte('service_date', monthAgoStr).catch(() => ({ data: [] })),
    ])

    // Build context summary
    const v = vehicles ?? []
    const d = drivers ?? []
    const t = trips ?? []
    const f = fuel ?? []
    const m = maintenance ?? []

    const availableVehicles = v.filter(x => x.status === 'available').length
    const completedTrips = t.filter(x => x.status === 'completed').length
    const cancelledTrips = t.filter(x => x.status === 'cancelled').length
    const totalFuelCost = f.reduce((s, x) => s + (x.amount ?? 0), 0)
    const totalLitres = f.reduce((s, x) => s + (x.litres ?? 0), 0)
    const anomalies = f.filter(x => x.anomaly_flag).length
    const avgEfficiency = f.filter(x => x.efficiency_kmpl).length
      ? f.filter(x => x.efficiency_kmpl).reduce((s, x) => s + x.efficiency_kmpl, 0) / f.filter(x => x.efficiency_kmpl).length
      : 0
    const avgScore = d.length ? d.reduce((s, x) => s + (x.performance_score ?? 100), 0) / d.length : 0

    // Expiry checks
    const now = new Date()
    const in30 = new Date(); in30.setDate(now.getDate() + 30)
    const expiredDocs = v.filter(x =>
      (x.mulkiya_expiry && new Date(x.mulkiya_expiry) < now) ||
      (x.insurance_expiry && new Date(x.insurance_expiry) < now)
    ).length
    const expiringSoon = v.filter(x =>
      (x.mulkiya_expiry && new Date(x.mulkiya_expiry) > now && new Date(x.mulkiya_expiry) < in30) ||
      (x.insurance_expiry && new Date(x.insurance_expiry) > now && new Date(x.insurance_expiry) < in30)
    ).length

    const context = `
FRESH FRUITS COMPANY - TRANSPORT MANAGEMENT SYSTEM DATA (Last 30 days as of ${today})

=== FLEET (${v.length} vehicles total) ===
- Available: ${availableVehicles}
- Assigned/In Use: ${v.filter(x => x.status === 'assigned').length}
- Maintenance: ${v.filter(x => x.status === 'maintenance').length}
- Vehicles with expired documents: ${expiredDocs}
- Vehicles with documents expiring in 30 days: ${expiringSoon}
Vehicle details: ${v.map(x => `${x.vehicle_number}(${x.vehicle_type ?? 'unknown'},${x.status},odo:${x.current_odometer ?? 0}km,mulkiya:${x.mulkiya_expiry ?? 'N/A'},insurance:${x.insurance_expiry ?? 'N/A'},next_service:${x.next_service_date ?? 'N/A'})`).join(' | ')}

=== DRIVERS (${d.length} active) ===
- On Duty: ${d.filter(x => x.duty_status === 'on_duty').length}
- Average performance score: ${avgScore.toFixed(1)}/100
Driver details: ${d.map(x => `${x.full_name}(score:${x.performance_score ?? 100},duty:${x.duty_status},eid:${x.eid_expiry ?? 'N/A'},license:${x.license_expiry ?? 'N/A'})`).join(' | ')}

=== TRIPS (${t.length} total) ===
- Completed: ${completedTrips} (${t.length > 0 ? Math.round((completedTrips / t.length) * 100) : 0}% completion rate)
- Cancelled: ${cancelledTrips}
- In Progress: ${t.filter(x => x.status === 'in_progress').length}
- Requested/Pending: ${t.filter(x => x.status === 'requested').length}
- Total distance covered: ${t.reduce((s, x) => s + (x.total_distance ?? 0), 0).toLocaleString()} km

=== FUEL (${f.length} entries) ===
- Total cost: AED ${totalFuelCost.toFixed(2)}
- Total litres: ${totalLitres.toFixed(1)} L
- Average efficiency: ${avgEfficiency.toFixed(1)} km/L
- Anomalies detected: ${anomalies}
- Cost per litre avg: AED ${totalLitres > 0 ? (totalFuelCost / totalLitres).toFixed(2) : 'N/A'}

=== MAINTENANCE (${m.length} records) ===
- Total maintenance cost: AED ${m.reduce((s: number, x: any) => s + (x.cost ?? 0), 0).toFixed(2)}
- Completed: ${m.filter((x: any) => x.status === 'completed').length}
- Scheduled: ${m.filter((x: any) => x.status === 'scheduled').length}
Records: ${m.slice(0, 10).map((x: any) => `${x.vehicle?.vehicle_number ?? 'Unknown'}:${x.maintenance_type}(${x.status},AED ${x.cost ?? 0})`).join(' | ')}

Company: Fresh Fruits Company UAE
Branches: FFC HQ (Dubai), MS Sharjah, VS Ajman, FFC Al Ain
Currency: AED
`
    setFleetContext(context.trim())
    setDataLoading(false)
  }

  async function askGrok(question: string, category: string) {
    if (!apiKey) { setShowKeyInput(true); return }

    const insightId = Date.now().toString()
    const newInsight: Insight = {
      id: insightId,
      category,
      question,
      answer: '',
      loading: true,
    }
    setInsights(prev => [newInsight, ...prev])

    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: [
            {
              role: 'system',
              content: `You are an expert transport operations analyst for Fresh Fruits Company UAE. 
Analyze the fleet data provided and give actionable, specific insights. 
Format your response clearly with:
- Key findings (bullet points)
- Specific vehicle/driver names when relevant
- Concrete recommendations with priority (High/Medium/Low)
- Numbers and percentages where applicable
Keep responses concise but comprehensive. Use UAE context (AED currency, UAE regulations).`,
            },
            {
              role: 'user',
              content: `Here is our current fleet data:\n\n${fleetContext}\n\nQuestion: ${question}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error?.message ?? `API error ${response.status}`)
      }

      const data = await response.json()
      const answer = data.choices?.[0]?.message?.content ?? 'No response received'

      setInsights(prev => prev.map(i =>
        i.id === insightId ? { ...i, answer, loading: false } : i
      ))
    } catch (err: any) {
      setInsights(prev => prev.map(i =>
        i.id === insightId ? { ...i, answer: '', error: err.message, loading: false } : i
      ))
    }
  }

  function saveApiKey() {
    localStorage.setItem('grok_api_key', apiKey)
    setShowKeyInput(false)
  }

  function handleCustomQuestion() {
    if (!customQuestion.trim()) return
    askGrok(customQuestion, '💬 Custom')
    setCustomQuestion('')
  }

  const CATEGORY_COLORS: Record<string, string> = {
    '🚛 Fleet': 'bg-blue-100 text-blue-700',
    '⛽ Fuel': 'bg-orange-100 text-orange-700',
    '👤 Drivers': 'bg-purple-100 text-purple-700',
    '📦 Trips': 'bg-green-100 text-green-700',
    '🔧 Maintenance': 'bg-amber-100 text-amber-700',
    '📄 Compliance': 'bg-red-100 text-red-700',
    '💰 Costs': 'bg-emerald-100 text-emerald-700',
    '📊 Summary': 'bg-primary-100 text-primary-700',
    '💬 Custom': 'bg-gray-100 text-gray-700',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Analytics</h1>
          <p className="page-subtitle">Powered by Grok AI — intelligent insights for your fleet operations</p>
        </div>
        <button onClick={() => setShowKeyInput(true)}
          className={`btn ${apiKey ? 'btn-secondary' : 'btn-primary'}`}>
          {apiKey ? '🔑 API Key Set ✓' : '🔑 Set Grok API Key'}
        </button>
      </div>

      {/* API Key Modal */}
      {showKeyInput && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-[16px] mb-1">Grok API Key</h3>
            <p className="text-[13px] text-gray-500 mb-4">
              Get your API key from{' '}
              <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer"
                className="text-primary-700 underline">console.x.ai</a>
              {' '}— stored locally in your browser only.
            </p>
            <input
              type="password"
              className="form-control mb-4"
              placeholder="xai-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowKeyInput(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={saveApiKey} className="btn btn-primary flex-1">Save Key</button>
            </div>
          </div>
        </div>
      )}

      {/* Data status */}
      <div className={`rounded-xl p-3 mb-5 flex items-center gap-3 ${dataLoading ? 'bg-gray-50 border border-gray-200' : 'bg-green-50 border border-green-200'}`}>
        {dataLoading
          ? <><div className="w-4 h-4 border-2 border-gray-400/20 border-t-gray-400 rounded-full animate-spin"/><span className="text-[13px] text-gray-500">Loading fleet data…</span></>
          : <><span className="text-green-600">✅</span><span className="text-[13px] text-green-700 font-medium">Fleet data loaded — ready for AI analysis</span></>
        }
      </div>

      {!apiKey && !showKeyInput && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <div className="font-bold text-amber-700 mb-1">🔑 Grok API Key Required</div>
          <div className="text-[13px] text-amber-600">
            To use AI Analytics, you need a Grok API key from{' '}
            <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer" className="underline font-semibold">console.x.ai</a>.
            Click "Set Grok API Key" above to get started.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left — Quick questions */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="card-title">Quick Analysis</span></div>
            <div className="card-body space-y-2">
              {QUICK_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => askGrok(q.question, q.category)}
                  disabled={dataLoading || !apiKey}
                  className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <div className="text-[13px] font-semibold text-gray-800">{q.category}</div>
                  <div className="text-[11.5px] text-gray-500 mt-0.5 line-clamp-2">{q.question}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom question */}
          <div className="card">
            <div className="card-header"><span className="card-title">Ask Anything</span></div>
            <div className="card-body">
              <textarea
                className="form-control mb-3 text-[13px]"
                rows={4}
                placeholder="Ask Grok anything about your fleet… e.g. 'Which driver should I assign to urgent trips this week?'"
                value={customQuestion}
                onChange={e => setCustomQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleCustomQuestion() }}
              />
              <button onClick={handleCustomQuestion}
                disabled={!customQuestion.trim() || dataLoading || !apiKey}
                className="btn btn-primary w-full justify-center disabled:opacity-50">
                Ask Grok AI →
              </button>
              <div className="text-[11px] text-gray-400 text-center mt-2">Ctrl+Enter to send</div>
            </div>
          </div>
        </div>

        {/* Right — Insights */}
        <div className="xl:col-span-2 space-y-4">
          {insights.length === 0 && (
            <div className="card">
              <div className="card-body text-center py-16">
                <div className="text-5xl mb-4">🤖</div>
                <div className="font-bold text-[18px] text-gray-700">Ready for Analysis</div>
                <div className="text-gray-400 text-[13px] mt-2 max-w-sm mx-auto">
                  Click any quick analysis button or ask a custom question to get AI-powered insights about your fleet
                </div>
              </div>
            </div>
          )}

          {insights.map(insight => (
            <div key={insight.id} className="card">
              <div className="card-header">
                <div>
                  <span className={`badge text-[11px] mb-1 ${CATEGORY_COLORS[insight.category] ?? 'bg-gray-100 text-gray-700'}`}>
                    {insight.category}
                  </span>
                  <div className="text-[13px] font-semibold text-gray-700 mt-1">{insight.question}</div>
                </div>
                <button onClick={() => setInsights(prev => prev.filter(i => i.id !== insight.id))}
                  className="text-gray-300 hover:text-gray-500 text-xl leading-none flex-shrink-0">×</button>
              </div>
              <div className="card-body">
                {insight.loading && (
                  <div className="flex items-center gap-3 py-4">
                    <div className="w-5 h-5 border-2 border-primary-700/20 border-t-primary-700 rounded-full animate-spin flex-shrink-0"/>
                    <span className="text-[13px] text-gray-500">Grok is analyzing your fleet data…</span>
                  </div>
                )}
                {insight.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[13px] text-red-700">
                    ❌ Error: {insight.error}
                  </div>
                )}
                {!insight.loading && !insight.error && insight.answer && (
                  <div className="prose prose-sm max-w-none">
                    <div className="text-[13.5px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {insight.answer}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
