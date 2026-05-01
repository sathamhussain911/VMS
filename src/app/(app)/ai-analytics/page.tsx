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
  const [fleetContext, setFleetContext] = useState('')
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('grok_api_key') || 'xai-dvwCWM0IZtjYCfpJdkMrzRObM1RB1JHObSQ3kG8o1J43TfTQjDtoyLfgwyv0e6nnTbKHLD3OQIsdjmKC'
    setApiKey(saved)
    if (!localStorage.getItem('grok_api_key')) localStorage.setItem('grok_api_key', saved)
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
        supabase.from('trips').select('trip_number,status,priority,total_distance,planned_start').gte('planned_start', `${monthAgoStr}T00:00:00`).is('deleted_at', null),
        supabase.from('fuel_entries').select('litres,amount,efficiency_kmpl,anomaly_flag').gte('created_at', `${monthAgoStr}T00:00:00`),
      ])

      const v = vRes.data ?? []
      const d = dRes.data ?? []
      const t = tRes.data ?? []
      const f = fRes.data ?? []

      const now = new Date()
      const in30 = new Date(); in30.setDate(now.getDate() + 30)

      const completedTrips = t.filter(x => x.status === 'completed').length
      const totalFuelCost = f.reduce((s, x) => s + (x.amount ?? 0), 0)
      const totalLitres = f.reduce((s, x) => s + (x.litres ?? 0), 0)
      const effList = f.filter(x => x.efficiency_kmpl).map(x => x.efficiency_kmpl)
      const avgEff = effList.length ? effList.reduce((s, x) => s + x, 0) / effList.length : 0
      const avgScore = d.length ? d.reduce((s, x) => s + (x.performance_score ?? 100), 0) / d.length : 0
      const expiredDocs = v.filter(x => (x.mulkiya_expiry && new Date(x.mulkiya_expiry) < now) || (x.insurance_expiry && new Date(x.insurance_expiry) < now)).length
      const expiringSoon = v.filter(x => (x.mulkiya_expiry && new Date(x.mulkiya_expiry) > now && new Date(x.mulkiya_expiry) < in30) || (x.insurance_expiry && new Date(x.insurance_expiry) > now && new Date(x.insurance_expiry) < in30)).length

      const ctx = `
FRESH FRUITS COMPANY UAE - TRANSPORT DATA (Last 30 days, as of ${new Date().toLocaleDateString()})

FLEET: ${v.length} vehicles total
- Available: ${v.filter(x => x.status === 'available').length} | Assigned: ${v.filter(x => x.status === 'assigned').length} | Maintenance: ${v.filter(x => x.status === 'maintenance').length}
- Expired documents: ${expiredDocs} | Expiring in 30 days: ${expiringSoon}
- Vehicles: ${v.map(x => `${x.vehicle_number}(${x.vehicle_type ?? 'unknown'},${x.status},${x.current_odometer ?? 0}km,mulkiya:${x.mulkiya_expiry ?? 'none'},insurance:${x.insurance_expiry ?? 'none'})`).join(' | ')}

DRIVERS: ${d.length} active
- On duty: ${d.filter(x => x.duty_status === 'on_duty').length} | Avg score: ${avgScore.toFixed(1)}/100
- Drivers: ${d.map(x => `${x.full_name}(score:${x.performance_score ?? 100},${x.duty_status},eid:${x.eid_expiry ?? 'none'},license:${x.license_expiry ?? 'none'})`).join(' | ')}

TRIPS: ${t.length} total (last 30 days)
- Completed: ${completedTrips} (${t.length > 0 ? Math.round((completedTrips / t.length) * 100) : 0}% rate)
- Cancelled: ${t.filter(x => x.status === 'cancelled').length} | In Progress: ${t.filter(x => x.status === 'in_progress').length} | Pending: ${t.filter(x => x.status === 'requested').length}
- Total distance: ${t.reduce((s, x) => s + (x.total_distance ?? 0), 0).toLocaleString()} km

FUEL: ${f.length} entries
- Total cost: AED ${totalFuelCost.toFixed(2)} | Total litres: ${totalLitres.toFixed(1)}L
- Avg efficiency: ${avgEff.toFixed(1)} km/L | Anomalies: ${f.filter(x => x.anomaly_flag).length}
- Cost/litre: AED ${totalLitres > 0 ? (totalFuelCost / totalLitres).toFixed(2) : 'N/A'}

Company: Fresh Fruits Company UAE | Currency: AED | Branches: Dubai HQ, Sharjah, Ajman, Al Ain
`.trim()

      setFleetContext(ctx)
    } catch (err: any) {
      setDataError(err.message ?? 'Failed to load fleet data')
    } finally {
      setDataLoading(false)
    }
  }

  async function askGrok(question: string, category: string) {
    if (!apiKey) { setShowKeyInput(true); return }

    const insightId = Date.now().toString()
    setInsights(prev => [{ id: insightId, category, question, answer: '', loading: true }, ...prev])

    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'grok-3-latest',
          messages: [
            { role: 'system', content: 'You are an expert transport operations analyst for Fresh Fruits Company UAE. Give specific, actionable insights with bullet points, priorities (High/Medium/Low), and concrete recommendations. Use AED for currency.' },
            { role: 'user', content: `Fleet data:\n\n${fleetContext}\n\nQuestion: ${question}` },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      })

      if (!res.ok) {
        let errMsg = `API error ${res.status}`
        try {
          const err = await res.json()
          errMsg = err.error?.message ?? err.message ?? errMsg
        } catch {}
        throw new Error(errMsg)
      }

      const data = await res.json()
      const answer = data.choices?.[0]?.message?.content ?? 'No response'
      setInsights(prev => prev.map(i => i.id === insightId ? { ...i, answer, loading: false } : i))
    } catch (err: any) {
      setInsights(prev => prev.map(i => i.id === insightId ? { ...i, error: err.message, loading: false } : i))
    }
  }

  function saveApiKey() {
    localStorage.setItem('grok_api_key', apiKey)
    setShowKeyInput(false)
  }

  const CAT_COLOR: Record<string, string> = {
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
          <p className="page-subtitle">Powered by Grok AI — intelligent insights for your fleet</p>
        </div>
        <button onClick={() => setShowKeyInput(true)} className={`btn ${apiKey ? 'btn-secondary' : 'btn-primary'}`}>
          {apiKey ? '🔑 API Key Set ✓' : '🔑 Set Grok API Key'}
        </button>
      </div>

      {showKeyInput && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-[16px] mb-1">Grok API Key</h3>
            <p className="text-[13px] text-gray-500 mb-4">Get your key from <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">console.x.ai</a> — saved in your browser only.</p>
            <input type="password" className="form-control mb-4" placeholder="xai-..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => setShowKeyInput(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={saveApiKey} className="btn btn-primary flex-1">Save Key</button>
            </div>
          </div>
        </div>
      )}

      <div className={`rounded-xl p-3 mb-5 flex items-center gap-3 ${dataLoading ? 'bg-gray-50 border border-gray-200' : dataError ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
        {dataLoading
          ? <><div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin"/><span className="text-[13px] text-gray-500">Loading fleet data…</span></>
          : dataError
            ? <><span className="text-red-500">❌</span><span className="text-[13px] text-red-600">{dataError}</span><button onClick={loadFleetContext} className="btn btn-secondary btn-sm ml-auto">Retry</button></>
            : <><span className="text-green-600">✅</span><span className="text-[13px] text-green-700 font-medium">Fleet data loaded — ready for AI analysis</span></>
        }
      </div>

      {!apiKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <div className="font-bold text-amber-700 mb-1">🔑 Grok API Key Required</div>
          <div className="text-[13px] text-amber-600">Get a free API key from <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer" className="underline font-semibold">console.x.ai</a> then click "Set Grok API Key" above.</div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="card-title">Quick Analysis</span></div>
            <div className="card-body space-y-2">
              {QUICK_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => askGrok(q.question, q.category)}
                  disabled={dataLoading || !apiKey || !!dataError}
                  className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <div className="text-[13px] font-semibold text-gray-800">{q.category}</div>
                  <div className="text-[11.5px] text-gray-500 mt-0.5">{q.question}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Ask Anything</span></div>
            <div className="card-body">
              <textarea className="form-control mb-3 text-[13px]" rows={4}
                placeholder="Ask anything about your fleet… e.g. 'Which driver should I assign to urgent trips?'"
                value={customQuestion} onChange={e => setCustomQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey && customQuestion.trim()) { askGrok(customQuestion, '💬 Custom'); setCustomQuestion('') } }}
              />
              <button onClick={() => { if (customQuestion.trim()) { askGrok(customQuestion, '💬 Custom'); setCustomQuestion('') } }}
                disabled={!customQuestion.trim() || dataLoading || !apiKey || !!dataError}
                className="btn btn-primary w-full justify-center disabled:opacity-50">
                Ask Grok AI →
              </button>
              <div className="text-[11px] text-gray-400 text-center mt-2">Ctrl+Enter to send</div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-4">
          {insights.length === 0 && (
            <div className="card">
              <div className="card-body text-center py-16">
                <div className="text-5xl mb-4">🤖</div>
                <div className="font-bold text-[18px] text-gray-700">Ready for Analysis</div>
                <div className="text-gray-400 text-[13px] mt-2 max-w-sm mx-auto">Click any quick analysis button or ask a custom question</div>
              </div>
            </div>
          )}

          {insights.map(insight => (
            <div key={insight.id} className="card">
              <div className="card-header">
                <div>
                  <span className={`badge text-[11px] mb-1 ${CAT_COLOR[insight.category] ?? 'bg-gray-100 text-gray-700'}`}>{insight.category}</span>
                  <div className="text-[13px] font-semibold text-gray-700 mt-1">{insight.question}</div>
                </div>
                <button onClick={() => setInsights(prev => prev.filter(i => i.id !== insight.id))} className="text-gray-300 hover:text-gray-500 text-xl leading-none flex-shrink-0">×</button>
              </div>
              <div className="card-body">
                {insight.loading && (
                  <div className="flex items-center gap-3 py-4">
                    <div className="w-5 h-5 border-2 border-primary-700/20 border-t-primary-700 rounded-full animate-spin flex-shrink-0"/>
                    <span className="text-[13px] text-gray-500">Grok is analyzing your fleet data…</span>
                  </div>
                )}
                {insight.error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[13px] text-red-700">❌ {insight.error}</div>}
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
