'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

const ALERT_TYPES = [
  { key: 'doc_expiry', label: '📄 Document Expiry', desc: '30/14/7/1 days before expiry' },
  { key: 'breakdown', label: '🚨 Breakdown Reported', desc: 'Instant when driver reports' },
  { key: 'fuel_anomaly', label: '⛽ Fuel Anomaly', desc: 'Suspicious fuel entry detected' },
  { key: 'trip_delayed', label: '⏰ Trip Delayed', desc: 'Trip running 30+ min late' },
  { key: 'morning_briefing', label: '🌅 Morning Briefing', desc: 'Daily 7AM operations summary' },
  { key: 'pending_approvals', label: '✅ Pending Approvals', desc: 'Approvals awaiting action' },
  { key: 'low_driver_score', label: '👤 Low Driver Score', desc: 'Driver drops below 70' },
  { key: 'vehicle_service_due', label: '🔧 Service Due', desc: 'Vehicle needs service ≤7 days' },
]

const GROQ_KEY = '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'

export default function WhatsAppAlertsPage() {
  const supabase = createClient()
  const [recipients, setRecipients] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'recipients' | 'settings' | 'logs' | 'test'>('recipients')
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [testLoading, setTestLoading] = useState<string>('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editRecipient, setEditRecipient] = useState<any>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: r }, { data: l }, { data: s }] = await Promise.all([
      supabase.from('whatsapp_recipients').select('*').order('name'),
      supabase.from('whatsapp_alert_log').select('*').order('sent_at', { ascending: false }).limit(50),
      supabase.from('whatsapp_settings').select('key,value'),
    ])
    setRecipients(r ?? [])
    setLogs(l ?? [])
    const settingsMap: Record<string, string> = {}
    s?.forEach(x => { settingsMap[x.key] = x.value })
    setSettings(settingsMap)
    setLoading(false)
  }

  async function saveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormLoading(true); setError(''); setSuccess('')
    const f = new FormData(e.currentTarget)
    const updates = [
      { key: 'callmebot_default_key', value: f.get('callmebot_default_key') as string },
      { key: 'morning_briefing_time', value: f.get('morning_briefing_time') as string },
      { key: 'alerts_enabled', value: f.get('alerts_enabled') as string },
    ]
    for (const u of updates) {
      await supabase.from('whatsapp_settings').upsert({ key: u.key, value: u.value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    }
    setSuccess('Settings saved ✅')
    setFormLoading(false)
    loadAll()
  }

  async function saveRecipient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormLoading(true); setError('')
    const f = new FormData(e.currentTarget)
    const selectedAlerts = ALERT_TYPES.map(a => a.key).filter(k => f.get(`alert_${k}`) === 'on')

    const data = {
      name: f.get('name') as string,
      phone: (f.get('phone') as string).replace(/\s/g, ''),
      role: f.get('role') as string,
      alerts: selectedAlerts,
      callmebot_key: f.get('callmebot_key') as string,
      active: true,
    }

    if (editRecipient) {
      await supabase.from('whatsapp_recipients').update(data).eq('id', editRecipient.id)
    } else {
      await supabase.from('whatsapp_recipients').insert(data)
    }

    setShowForm(false); setEditRecipient(null)
    setFormLoading(false); loadAll()
  }

  async function toggleRecipient(id: string, active: boolean) {
    await supabase.from('whatsapp_recipients').update({ active }).eq('id', id)
    loadAll()
  }

  async function deleteRecipient(id: string) {
    await supabase.from('whatsapp_recipients').delete().eq('id', id)
    loadAll()
  }

  // Send WhatsApp message via CallMeBot
  async function sendWhatsApp(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // CallMeBot: each recipient needs their own API key
    // phone format: international with + e.g. +971501234567
    const recipient = recipients.find(r => r.phone === phone)
    const apiKey = recipient?.callmebot_key || settings.callmebot_default_key

    if (!apiKey) return { success: false, error: 'No CallMeBot API key for this recipient. Each person must activate CallMeBot on their own phone.' }

    try {
      const encodedMsg = encodeURIComponent(message)
      const phoneFormatted = phone.startsWith('+') ? phone : '+' + phone
      const url = `https://api.callmebot.com/whatsapp.php?phone=${phoneFormatted}&text=${encodedMsg}&apikey=${apiKey}`
      const res = await fetch(url)
      const text = await res.text()
      if (!res.ok || text.toLowerCase().includes('error')) return { success: false, error: text.slice(0, 100) }
      return { success: true, messageId: Date.now().toString() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // Generate AI message with Groq
  async function generateAIMessage(alertType: string, context: string): Promise<string> {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You write concise WhatsApp alert messages for Fresh Fruits Company UAE transport team. Keep messages under 200 characters. Be direct and actionable. Use relevant emoji. Include FFC branding.' },
            { role: 'user', content: `Write a WhatsApp alert for: ${alertType}\nContext: ${context}\nKeep it under 200 characters.` }
          ],
          temperature: 0.3, max_tokens: 100,
        })
      })
      const data = await res.json()
      return data.choices?.[0]?.message?.content ?? context
    } catch {
      return context
    }
  }

  // Test send an alert
  async function sendTestAlert(alertType: string) {
    if (!settings.callmebot_default_key) {
      setError('Configure CallMeBot API key in Settings first')
      setTab('settings')
      return
    }

    const activeRecipients = recipients.filter(r => r.active && r.alerts.includes(alertType))
    if (activeRecipients.length === 0) {
      setError(`No recipients configured for ${alertType}. Add a recipient with this alert type enabled.`)
      return
    }

    setTestLoading(alertType); setError(''); setSuccess('')

    // Get live context from Supabase
    const now = new Date()
    const in30 = new Date(); in30.setDate(now.getDate() + 30)
    const today = now.toISOString().split('T')[0]

    let context = ''
    let message = ''

    if (alertType === 'doc_expiry') {
      const { data: v } = await supabase.from('vehicles').select('vehicle_number,mulkiya_expiry,insurance_expiry').is('deleted_at', null)
      const expiring = (v ?? []).filter(x => (x.mulkiya_expiry && new Date(x.mulkiya_expiry) < in30) || (x.insurance_expiry && new Date(x.insurance_expiry) < in30))
      context = `${expiring.length} vehicles have docs expiring in 30 days: ${expiring.slice(0, 3).map(x => x.vehicle_number).join(', ')}`
      message = await generateAIMessage('Document expiry alert', context)
    } else if (alertType === 'breakdown') {
      const { data: b } = await supabase.from('breakdown_reports').select('*,vehicle:vehicles(vehicle_number),driver:drivers(full_name)').eq('status', 'reported').order('reported_at', { ascending: false }).limit(1)
      const latest = b?.[0]
      context = latest ? `${latest.vehicle?.vehicle_number} breakdown reported by ${latest.driver?.full_name}: ${latest.description?.slice(0, 50)}` : 'Test breakdown alert'
      message = await generateAIMessage('Vehicle breakdown alert', context)
    } else if (alertType === 'fuel_anomaly') {
      const { data: f } = await supabase.from('fuel_entries').select('*,vehicle:vehicles(vehicle_number)').eq('anomaly_flag', true).order('created_at', { ascending: false }).limit(1)
      const latest = f?.[0]
      context = latest ? `Fuel anomaly on ${latest.vehicle?.vehicle_number}: ${latest.anomaly_reason}` : 'Test fuel anomaly alert'
      message = await generateAIMessage('Fuel anomaly detected', context)
    } else if (alertType === 'morning_briefing') {
      const { data: trips } = await supabase.from('trips').select('status').gte('planned_start', `${today}T00:00:00`).lte('planned_start', `${today}T23:59:59`).is('deleted_at', null)
      const { data: vehicles } = await supabase.from('vehicles').select('status').is('deleted_at', null)
      const total = trips?.length ?? 0
      const avail = vehicles?.filter(v => v.status === 'available').length ?? 0
      context = `Today: ${total} trips planned, ${avail} vehicles available`
      message = await generateAIMessage('Morning operations briefing', context)
    } else if (alertType === 'pending_approvals') {
      const { data: ap } = await supabase.from('approvals').select('id').eq('status', 'pending')
      context = `${ap?.length ?? 0} approvals pending your action`
      message = await generateAIMessage('Pending approvals reminder', context)
    } else {
      context = `Test alert for ${alertType}`
      message = await generateAIMessage(alertType, context)
    }

    // Send to all matching recipients
    let sentCount = 0; let failCount = 0
    for (const recipient of activeRecipients) {
      const result = await sendWhatsApp(recipient.phone, message)
      await supabase.from('whatsapp_alert_log').insert({
        recipient_id: recipient.id, phone: recipient.phone,
        alert_type: alertType, message,
        status: result.success ? 'sent' : 'failed',
        wa_message_id: result.messageId ?? null,
        error_msg: result.error ?? null,
      })
      result.success ? sentCount++ : failCount++
    }

    setTestLoading('')
    if (sentCount > 0) setSuccess(`✅ Sent to ${sentCount} recipient${sentCount > 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`)
    else setError(`Failed to send: ${activeRecipients[0] ? 'Check WhatsApp credentials' : 'No recipients'}`)
    loadAll()
  }

  // Send ALL alerts (full scan)
  async function runAllAlerts() {
    setTestLoading('all'); setError(''); setSuccess('')
    for (const alert of ALERT_TYPES) {
      if (recipients.some(r => r.active && r.alerts.includes(alert.key))) {
        await sendTestAlert(alert.key)
      }
    }
    setTestLoading('')
    setSuccess('All alert checks completed ✅')
  }

  const ROLE_COLORS: Record<string, string> = {
    ceo: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    supervisor: 'bg-green-100 text-green-700',
    driver_coordinator: 'bg-amber-100 text-amber-700',
    it_admin: 'bg-gray-100 text-gray-600',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">WhatsApp AI Alerts</h1>
          <p className="page-subtitle">AI-powered WhatsApp notifications for your transport team</p>
        </div>
        <div className="flex gap-2">
          <button onClick={runAllAlerts} disabled={!!testLoading || loading}
            className="btn btn-secondary disabled:opacity-50">
            {testLoading === 'all' ? '⏳ Running…' : '▶ Run All Alerts'}
          </button>
          <button onClick={() => { setShowForm(true); setEditRecipient(null) }} className="btn btn-primary">
            + Add Recipient
          </button>
        </div>
      </div>

      {/* Status banners */}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-[13px] text-red-700 flex justify-between"><span>❌ {error}</span><button onClick={() => setError('')}>×</button></div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-[13px] text-green-700 flex justify-between"><span>{success}</span><button onClick={() => setSuccess('')}>×</button></div>}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Recipients', value: recipients.length, sub: `${recipients.filter(r => r.active).length} active`, icon: '👥' },
          { label: 'Sent Today', value: logs.filter(l => new Date(l.sent_at).toDateString() === new Date().toDateString()).length, sub: 'messages sent', icon: '📤' },
          { label: 'Success Rate', value: logs.length > 0 ? `${Math.round((logs.filter(l => l.status === 'sent').length / logs.length) * 100)}%` : '—', sub: 'delivery rate', icon: '✅' },
          { label: 'Alert Types', value: ALERT_TYPES.length, sub: 'configured', icon: '🔔' },
        ].map((s, i) => (
          <div key={i} className="card"><div className="card-body">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-[26px] font-extrabold text-gray-800">{s.value}</div>
            <div className="text-[13px] font-medium text-gray-600">{s.label}</div>
            <div className="text-[11px] text-gray-400">{s.sub}</div>
          </div></div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 w-fit">
        {(['recipients', 'test', 'settings', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold capitalize transition-all ${tab === t ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
            {t === 'test' ? '🧪 Test Alerts' : t === 'logs' ? '📋 Logs' : t === 'settings' ? '⚙️ Settings' : '👥 Recipients'}
          </button>
        ))}
      </div>

      {/* RECIPIENTS */}
      {tab === 'recipients' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Alert Recipients</span><span className="text-[12px] text-gray-400">{recipients.length} total</span></div>
          {loading ? <div className="p-8 text-center text-gray-400">Loading…</div>
            : recipients.length === 0
              ? <div className="p-8 text-center text-gray-400"><div className="text-4xl mb-2">👥</div>No recipients yet. Add someone to start sending alerts.</div>
              : (
                <div className="divide-y divide-gray-50">
                  {recipients.map(r => (
                    <div key={r.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[18px] flex-shrink-0 ${r.active ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {r.role === 'ceo' ? '👑' : r.role === 'manager' ? '💼' : r.role === 'supervisor' ? '👔' : '📱'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-[14px]">{r.name}</span>
                            <span className={`badge text-[10px] ${ROLE_COLORS[r.role] ?? 'bg-gray-100 text-gray-600'}`}>{r.role.replace('_', ' ')}</span>
                            {!r.active && <span className="badge bg-gray-100 text-gray-400 text-[10px]">inactive</span>}
                          </div>
                          <div className="text-[12px] text-gray-500 mb-2">📱 +{r.phone}</div>
                          <div className="flex flex-wrap gap-1">
                            {r.alerts.map((a: string) => {
                              const at = ALERT_TYPES.find(x => x.key === a)
                              return at ? <span key={a} className="text-[10px] bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{at.label}</span> : null
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => { setEditRecipient(r); setShowForm(true) }}
                          className="btn btn-secondary btn-sm text-[12px]">Edit</button>
                        <button onClick={() => toggleRecipient(r.id, !r.active)}
                          className={`btn btn-sm text-[12px] ${r.active ? 'btn-secondary text-amber-600' : 'btn-secondary text-green-600'}`}>
                          {r.active ? 'Pause' : 'Activate'}
                        </button>
                        <button onClick={() => deleteRecipient(r.id)}
                          className="btn btn-secondary btn-sm text-red-500 text-[12px]">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </div>
      )}

      {/* TEST ALERTS */}
      {tab === 'test' && (
        <div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-[13px] text-blue-700">
            💡 Test alerts send real WhatsApp messages using live data from your system. Make sure you have configured WhatsApp settings and have active recipients for each alert type.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ALERT_TYPES.map(alert => {
              const recipientCount = recipients.filter(r => r.active && r.alerts.includes(alert.key)).length
              const isLoading = testLoading === alert.key
              return (
                <div key={alert.key} className="card">
                  <div className="card-body">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold text-[14px]">{alert.label}</div>
                        <div className="text-[12px] text-gray-400 mt-0.5">{alert.desc}</div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-[11px] text-gray-400">{recipientCount} recipient{recipientCount !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <button onClick={() => sendTestAlert(alert.key)}
                      disabled={!!testLoading || recipientCount === 0}
                      className={`w-full btn btn-sm justify-center text-[12px] ${recipientCount === 0 ? 'btn-secondary opacity-40' : 'btn-primary'} disabled:opacity-50`}>
                      {isLoading ? '⏳ Sending…' : recipientCount === 0 ? '⚠ No recipients' : '📤 Send Now'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SETTINGS */}
      {tab === 'settings' && (
        <div className="card max-w-lg">
          <div className="card-header"><span className="card-title">WhatsApp Business API Config</span></div>
          <div className="card-body">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-[13px] text-blue-700">
              <div className="font-bold mb-2">How to get your credentials:</div>
              <ol className="space-y-1 list-decimal list-inside text-[12px]">
                <li>Go to <strong>developers.facebook.com</strong> → My Apps → Create App</li>
                <li>Add <strong>WhatsApp</strong> product to your app</li>
                <li>Go to WhatsApp → Getting Started</li>
                <li>Copy the <strong>Phone Number ID</strong> and <strong>Temporary Token</strong></li>
                <li>Add your number in the "To" field and send a test message</li>
                <li>For production: verify your Meta Business Account</li>
              </ol>
            </div>
            <form onSubmit={saveSettings} className="space-y-4">
              <div>
                <label className="form-label">Your CallMeBot API Key *</label>
                <input name="callmebot_default_key" className="form-control font-mono text-[18px]"
                  placeholder="e.g. 5954788"
                  defaultValue={settings.callmebot_default_key}/>
                <div className="text-[11px] text-gray-400 mt-1">The API key CallMeBot sent you on WhatsApp</div>
              </div>
              <div>
                <label className="form-label">Morning Briefing Time</label>
                <input name="morning_briefing_time" type="time" className="form-control"
                  defaultValue={settings.morning_briefing_time ?? '07:00'}/>
              </div>
              <div>
                <label className="form-label">Alerts Enabled</label>
                <select name="alerts_enabled" className="form-control"
                  defaultValue={settings.alerts_enabled ?? 'true'}>
                  <option value="true">✅ Enabled — send alerts</option>
                  <option value="false">⏸ Paused — no alerts sent</option>
                </select>
              </div>
              <button type="submit" disabled={formLoading} className="btn btn-primary w-full justify-center">
                {formLoading ? 'Saving…' : '💾 Save Settings'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* LOGS */}
      {tab === 'logs' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Message Log</span>
            <span className="text-[12px] text-gray-400">{logs.length} messages</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Time</th><th>Alert Type</th><th>Phone</th><th>Message Preview</th><th>Status</th></tr></thead>
              <tbody>
                {logs.length === 0
                  ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">No messages sent yet</td></tr>
                  : logs.map(l => (
                    <tr key={l.id}>
                      <td className="text-[12px] font-mono">{formatDate(l.sent_at, 'dd MMM HH:mm')}</td>
                      <td><span className="badge bg-blue-100 text-blue-700 text-[11px]">{l.alert_type.replace('_', ' ')}</span></td>
                      <td className="text-[12px] font-mono">+{l.phone}</td>
                      <td className="text-[12px] text-gray-600 max-w-xs truncate">{l.message}</td>
                      <td>
                        <span className={`badge text-[11px] ${l.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {l.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                        </span>
                        {l.error_msg && <div className="text-[11px] text-red-400 mt-0.5">{l.error_msg}</div>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD/EDIT RECIPIENT MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl my-4">
            <h3 className="font-bold text-[16px] mb-4">{editRecipient ? 'Edit Recipient' : 'Add WhatsApp Recipient'}</h3>
            <form onSubmit={saveRecipient} className="space-y-4">
              <div>
                <label className="form-label">Full Name *</label>
                <input name="name" className="form-control" required defaultValue={editRecipient?.name}/>
              </div>
              <div>
                <label className="form-label">WhatsApp Number *</label>
                <input name="phone" className="form-control font-mono" required
                  placeholder="971501234567 (with country code, no +)"
                  defaultValue={editRecipient?.phone}/>
                <div className="text-[11px] text-gray-400 mt-1">UAE format: 971 5X XXXXXXX</div>
              </div>
              <div>
                <label className="form-label">Role *</label>
                <select name="role" className="form-control" defaultValue={editRecipient?.role ?? 'manager'}>
                  <option value="ceo">👑 CEO</option>
                  <option value="manager">💼 Transport Manager</option>
                  <option value="supervisor">👔 Supervisor</option>
                  <option value="driver_coordinator">📱 Driver Coordinator</option>
                  <option value="it_admin">🔧 IT Admin</option>
                </select>
              </div>
              <div>
                <label className="form-label">CallMeBot API Key *</label>
                <input name="callmebot_key" className="form-control font-mono"
                  placeholder="e.g. 5954788"
                  defaultValue={editRecipient?.callmebot_key}/>
                <div className="text-[11px] text-gray-400 mt-1">
                  Each person must activate CallMeBot: save +34 644 61 63 99 → send "I allow callmebot to send me messages" → get key
                </div>
              </div>
              <div>
                <label className="form-label">Alert Types to Receive</label>
                <div className="space-y-2 mt-2">
                  {ALERT_TYPES.map(a => (
                    <label key={a.key} className="flex items-start gap-3 cursor-pointer group">
                      <input type="checkbox" name={`alert_${a.key}`}
                        defaultChecked={editRecipient?.alerts?.includes(a.key)}
                        className="mt-0.5 flex-shrink-0"/>
                      <div>
                        <div className="text-[13px] font-medium text-gray-700 group-hover:text-primary-700">{a.label}</div>
                        <div className="text-[11px] text-gray-400">{a.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditRecipient(null) }}
                  className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={formLoading} className="btn btn-primary flex-1">
                  {formLoading ? 'Saving…' : editRecipient ? 'Update' : 'Add Recipient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
