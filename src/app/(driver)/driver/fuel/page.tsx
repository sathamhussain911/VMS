'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

const GROQ_KEY = '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'

interface ScannedData {
  amount?: number
  litres?: number
  station_name?: string
  fuel_type?: string
  price_per_litre?: number
  date?: string
  confidence: 'high' | 'medium' | 'low'
  raw?: string
}

export default function DriverFuelPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const [driver, setDriver] = useState<any>(null)
  const [vehicle, setVehicle] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [tab, setTab] = useState<'scan' | 'manual' | 'history'>('scan')
  const [pageLoading, setPageLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // OCR state
  const [receiptImage, setReceiptImage] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState<ScannedData | null>(null)
  const [scanError, setScanError] = useState('')

  // Form state
  const [form, setForm] = useState({
    fuel_type: 'diesel',
    litres: '',
    amount: '',
    odometer: '',
    station_name: '',
    notes: '',
  })

  useEffect(() => { loadDriver() }, [])

  async function loadDriver() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/driver/login'; return }

    const { data: d } = await supabase.from('drivers')
      .select('id,full_name,employee_id').eq('auth_user_id', user.id).maybeSingle()
    if (!d) { window.location.href = '/driver/login'; return }
    setDriver(d)

    // Get assigned vehicle
    const { data: activeTrip } = await supabase.from('trips')
      .select('vehicle:vehicles(id,vehicle_number,make,model,current_odometer)')
      .eq('driver_id', d.id).eq('status', 'in_progress').maybeSingle()

    if (activeTrip?.vehicle) {
      setVehicle(activeTrip.vehicle)
    } else {
      const { data: v } = await supabase.from('vehicles')
        .select('id,vehicle_number,make,model,current_odometer')
        .eq('current_driver_id', d.id).maybeSingle()
      setVehicle(v)
    }

    // Load history
    const { data: hist } = await supabase.from('fuel_entries')
      .select('id,fuel_type,litres,amount,odometer,station_name,efficiency_kmpl,anomaly_flag,created_at')
      .eq('driver_id', d.id)
      .order('created_at', { ascending: false }).limit(15)
    setHistory(hist ?? [])
    setPageLoading(false)
  }

  // ─── OCR SCAN FUNCTION ────────────────────────────────────
  async function scanReceipt(imageBase64: string) {
    setScanning(true)
    setScanError('')
    setScanned(null)

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: imageBase64 }
                },
                {
                  type: 'text',
                  text: `You are a UAE fuel receipt scanner. Extract data from this fuel receipt image.
                  
Return ONLY a JSON object with these exact fields (no markdown, no explanation):
{
  "amount": <total amount paid in AED as number, null if not found>,
  "litres": <litres/volume dispensed as number, null if not found>,
  "station_name": <fuel station name as string, null if not found>,
  "fuel_type": <one of: "diesel", "petrol_special", "petrol_super", null if not found>,
  "price_per_litre": <price per litre in AED as number, null if not found>,
  "date": <date in YYYY-MM-DD format, null if not found>,
  "confidence": <"high" if 3+ fields found, "medium" if 2 fields, "low" if 1 field>
}

Common UAE stations: ENOC, ADNOC, EMARAT, TOTAL, SHELL, EPPCO.
Diesel = Diesel. Special (E-Plus 91) = petrol_special. Super (98) = petrol_super.
If text is in Arabic, translate the values.
Return ONLY the JSON, nothing else.`
                }
              ]
            }
          ],
          temperature: 0,
          max_tokens: 300,
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message ?? `Scan failed (${res.status})`)
      }

      const data = await res.json()
      const raw = data.choices?.[0]?.message?.content ?? ''

      // Parse JSON from response
      let parsed: ScannedData
      try {
        const clean = raw.replace(/```json|```/g, '').trim()
        parsed = JSON.parse(clean)
      } catch {
        throw new Error('Could not read receipt. Please enter manually.')
      }

      setScanned(parsed)

      // Auto-populate form
      setForm(prev => ({
        ...prev,
        amount: parsed.amount ? parsed.amount.toString() : prev.amount,
        litres: parsed.litres ? parsed.litres.toString() : prev.litres,
        station_name: parsed.station_name ?? prev.station_name,
        fuel_type: parsed.fuel_type ?? prev.fuel_type,
      }))

    } catch (err: any) {
      setScanError(err.message ?? 'Scan failed. Please try again or enter manually.')
    } finally {
      setScanning(false)
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setReceiptImage(base64)
      scanReceipt(base64)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.litres || !form.amount) { setError('Litres and amount are required'); return }
    setSubmitLoading(true); setError('')

    let vehicle_id = vehicle?.id
    if (!vehicle_id) {
      const { data: last } = await supabase.from('fuel_entries')
        .select('vehicle_id').eq('driver_id', driver.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      vehicle_id = last?.vehicle_id
    }
    if (!vehicle_id) { setError('No vehicle assigned. Contact supervisor.'); setSubmitLoading(false); return }

    const litres = parseFloat(form.litres)
    const amount = parseFloat(form.amount)
    const odometer = form.odometer ? parseInt(form.odometer) : null

    // Calculate efficiency
    let efficiency_kmpl = null
    if (odometer) {
      const { data: last } = await supabase.from('fuel_entries')
        .select('odometer,litres').eq('vehicle_id', vehicle_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (last && odometer > last.odometer && litres > 0) {
        efficiency_kmpl = parseFloat(((odometer - last.odometer) / litres).toFixed(2))
      }
    }

    // Anomaly detection
    let anomaly_flag = false
    let anomaly_reason = null
    if (litres > 200) { anomaly_flag = true; anomaly_reason = 'Fill > 200L' }
    if (amount / litres > 5 || amount / litres < 1) { anomaly_flag = true; anomaly_reason = 'Unusual cost/litre' }
    if (efficiency_kmpl && efficiency_kmpl < 3) { anomaly_flag = true; anomaly_reason = 'Low efficiency <3 km/L' }

    const { error: err } = await supabase.from('fuel_entries').insert({
      vehicle_id, driver_id: driver.id,
      fuel_type: form.fuel_type,
      litres, amount,
      odometer, station_name: form.station_name || null,
      efficiency_kmpl, anomaly_flag, anomaly_reason,
      notes: form.notes || null,
    })

    if (err) { setError(err.message); setSubmitLoading(false); return }

    if (odometer && odometer > (vehicle?.current_odometer ?? 0)) {
      await supabase.from('vehicles').update({ current_odometer: odometer }).eq('id', vehicle_id)
    }

    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      setForm({ fuel_type: 'diesel', litres: '', amount: '', odometer: '', station_name: '', notes: '' })
      setReceiptImage(null); setScanned(null)
      setTab('history')
      loadDriver()
    }, 1800)
    setSubmitLoading(false)
  }

  if (pageLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#14532d' }}>
      <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"/>
    </div>
  )

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-xs w-full mx-4">
        <div className="text-6xl mb-3">✅</div>
        <div className="font-extrabold text-[18px] text-green-700">Fuel Logged!</div>
        <div className="text-gray-400 text-[13px] mt-1">Entry saved successfully</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 pb-20" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Header */}
      <div className="px-4 pt-10 pb-5" style={{ background: '#14532d' }}>
        <div className="flex items-center gap-3 mb-1">
          <Link href="/driver" className="text-white/60 text-[13px]">← Home</Link>
        </div>
        <h1 className="text-white font-extrabold text-[20px]">⛽ Fuel Log</h1>
        {vehicle && (
          <div className="mt-2 bg-white/10 rounded-xl p-3 flex justify-between items-center">
            <div>
              <div className="text-white font-semibold text-[14px]">{vehicle.vehicle_number}</div>
              <div className="text-white/60 text-[11px]">{vehicle.make} {vehicle.model}</div>
            </div>
            <div className="text-right">
              <div className="text-white/60 text-[10px]">Current Odometer</div>
              <div className="text-white font-bold text-[14px]">{vehicle.current_odometer?.toLocaleString() ?? '—'} km</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100">
        {[
          { key: 'scan', label: '📷 Scan Receipt' },
          { key: 'manual', label: '✏️ Manual' },
          { key: 'history', label: `📋 History` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex-1 py-3 text-[12.5px] font-semibold transition-colors ${tab === t.key ? 'text-primary-700 border-b-2 border-primary-700' : 'text-gray-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">

        {/* ─── SCAN TAB ─── */}
        {tab === 'scan' && (
          <div className="space-y-4">

            {/* Upload area */}
            {!receiptImage && (
              <div>
                <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
                  <div className="text-5xl mb-3">🧾</div>
                  <div className="font-bold text-[15px] text-gray-700 mb-1">Scan Your Fuel Receipt</div>
                  <div className="text-[12px] text-gray-400 mb-5">Take a photo or upload from gallery.<br/>AI will automatically read the details.</div>
                  <div className="flex flex-col gap-3">
                    <button onClick={() => cameraRef.current?.click()}
                      className="w-full py-3 rounded-xl font-bold text-[14px] text-white"
                      style={{ background: '#15803d' }}>
                      📸 Take Photo
                    </button>
                    <button onClick={() => fileRef.current?.click()}
                      className="w-full py-3 rounded-xl font-semibold text-[14px] text-gray-700 bg-gray-100">
                      📁 Upload from Gallery
                    </button>
                  </div>
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect}/>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect}/>
                </div>
                <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3 text-[12px] text-blue-600 text-center">
                  💡 Works with ENOC, ADNOC, EMARAT, TOTAL receipts in English or Arabic
                </div>
              </div>
            )}

            {/* Image preview + scanning */}
            {receiptImage && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <div className="relative">
                  <img src={receiptImage} alt="Receipt" className="w-full max-h-64 object-contain bg-gray-50"/>
                  {scanning && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                      <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3"/>
                      <div className="text-white font-semibold text-[13px]">Reading receipt…</div>
                      <div className="text-white/60 text-[11px] mt-1">Groq AI Vision scanning</div>
                    </div>
                  )}
                  {/* Scan lines animation */}
                  {scanning && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div className="w-full h-0.5 bg-green-400/70 animate-bounce" style={{ animationDuration: '1s' }}/>
                    </div>
                  )}
                </div>
                <div className="p-3 flex gap-2">
                  <button onClick={() => { setReceiptImage(null); setScanned(null); setScanError('') }}
                    className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-gray-600 bg-gray-100">
                    🔄 Retake
                  </button>
                  {scanned && (
                    <button onClick={() => setTab('manual')}
                      className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-white" style={{ background: '#15803d' }}>
                      ✏️ Edit & Submit
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Scan error */}
            {scanError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="font-semibold text-red-700 text-[13px] mb-1">❌ Scan Failed</div>
                <div className="text-red-600 text-[12px]">{scanError}</div>
                <button onClick={() => { setTab('manual'); setScanError('') }}
                  className="mt-3 w-full py-2 rounded-xl text-[13px] font-semibold text-white bg-red-500">
                  Enter Manually →
                </button>
              </div>
            )}

            {/* Scanned results */}
            {scanned && !scanning && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className={`px-4 py-3 flex items-center gap-2 ${scanned.confidence === 'high' ? 'bg-green-50' : scanned.confidence === 'medium' ? 'bg-amber-50' : 'bg-red-50'}`}>
                  <span className="text-[18px]">{scanned.confidence === 'high' ? '✅' : scanned.confidence === 'medium' ? '⚠️' : '❓'}</span>
                  <div>
                    <div className={`font-bold text-[13px] ${scanned.confidence === 'high' ? 'text-green-700' : scanned.confidence === 'medium' ? 'text-amber-700' : 'text-red-700'}`}>
                      {scanned.confidence === 'high' ? 'Receipt Read Successfully!' : scanned.confidence === 'medium' ? 'Partially Read — Please Verify' : 'Low Confidence — Please Check'}
                    </div>
                    <div className="text-[11px] text-gray-500">Tap fields to edit before submitting</div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {[
                    { label: 'Station', value: scanned.station_name, key: 'station_name', icon: '📍' },
                    { label: 'Amount (AED)', value: scanned.amount?.toString(), key: 'amount', icon: '💰' },
                    { label: 'Litres', value: scanned.litres?.toString(), key: 'litres', icon: '⛽' },
                    { label: 'Price/Litre', value: scanned.price_per_litre ? `AED ${scanned.price_per_litre}` : null, key: null, icon: '🏷️' },
                    { label: 'Fuel Type', value: scanned.fuel_type?.replace('_', ' '), key: 'fuel_type', icon: '🔥' },
                  ].map((field, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-[16px]">{field.icon}</span>
                        <span className="text-[12px] text-gray-500">{field.label}</span>
                      </div>
                      <span className={`text-[13px] font-semibold ${field.value ? 'text-gray-800' : 'text-red-400'}`}>
                        {field.value ?? 'Not detected'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="px-4 pb-4 space-y-2">
                  <button onClick={() => setTab('manual')}
                    className="w-full py-3 rounded-xl font-bold text-[14px] text-white"
                    style={{ background: '#15803d' }}>
                    ✅ Review & Submit →
                  </button>
                  <button onClick={() => { setReceiptImage(null); setScanned(null) }}
                    className="w-full py-2.5 rounded-xl font-semibold text-[13px] text-gray-600 bg-gray-100">
                    🔄 Scan Again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── MANUAL / REVIEW TAB ─── */}
        {tab === 'manual' && (
          <div className="space-y-3">
            {scanned && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-[12px] text-green-700 flex items-center gap-2">
                <span>✅</span>
                <span>Fields pre-filled from scanned receipt. Please verify before submitting.</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[13px] text-red-700">
                ❌ {error}
                <button onClick={() => setError('')} className="ml-2 text-red-400">×</button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">

                <div>
                  <label className="form-label text-[12px]">Fuel Type *</label>
                  <select name="fuel_type" className="form-control"
                    value={form.fuel_type} onChange={e => setForm(p => ({ ...p, fuel_type: e.target.value }))}>
                    <option value="diesel">Diesel</option>
                    <option value="petrol_special">Petrol Special (E-Plus 91)</option>
                    <option value="petrol_super">Petrol Super (98)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label text-[12px]">
                      Litres *
                      {scanned?.litres && <span className="ml-1 text-green-600 font-normal">✓ scanned</span>}
                    </label>
                    <input type="number" step="0.1" min="1" className="form-control text-[16px]"
                      placeholder="e.g. 65.0" value={form.litres}
                      onChange={e => setForm(p => ({ ...p, litres: e.target.value }))} required/>
                  </div>
                  <div>
                    <label className="form-label text-[12px]">
                      Amount (AED) *
                      {scanned?.amount && <span className="ml-1 text-green-600 font-normal">✓ scanned</span>}
                    </label>
                    <input type="number" step="0.01" min="1" className="form-control text-[16px]"
                      placeholder="e.g. 173.55" value={form.amount}
                      onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required/>
                  </div>
                </div>

                {form.litres && form.amount && parseFloat(form.litres) > 0 && (
                  <div className="bg-gray-50 rounded-xl p-2.5 text-center text-[12px] text-gray-500">
                    Price per litre: <span className="font-bold text-gray-700">AED {(parseFloat(form.amount) / parseFloat(form.litres)).toFixed(3)}</span>
                  </div>
                )}

                <div>
                  <label className="form-label text-[12px]">
                    Station Name
                    {scanned?.station_name && <span className="ml-1 text-green-600 font-normal">✓ scanned</span>}
                  </label>
                  <input type="text" className="form-control"
                    placeholder="ENOC, ADNOC, EMARAT…" value={form.station_name}
                    onChange={e => setForm(p => ({ ...p, station_name: e.target.value }))}/>
                </div>

                <div>
                  <label className="form-label text-[12px]">
                    Odometer (km)
                    <span className="ml-1 text-gray-400 font-normal">— for efficiency tracking</span>
                  </label>
                  <input type="number" inputMode="numeric" className="form-control text-[16px]"
                    placeholder={vehicle?.current_odometer ? `Current: ${vehicle.current_odometer.toLocaleString()}` : 'Enter km reading'}
                    value={form.odometer}
                    onChange={e => setForm(p => ({ ...p, odometer: e.target.value }))}/>
                </div>

                <div>
                  <label className="form-label text-[12px]">Notes (optional)</label>
                  <textarea className="form-control" rows={2}
                    placeholder="Any notes…" value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    style={{ resize: 'none' }}/>
                </div>
              </div>

              {/* Receipt thumbnail if scanned */}
              {receiptImage && (
                <div className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
                  <img src={receiptImage} alt="Receipt" className="w-14 h-14 object-cover rounded-lg"/>
                  <div>
                    <div className="text-[13px] font-semibold text-gray-700">Receipt attached</div>
                    <div className="text-[11px] text-gray-400">Scanned and data extracted</div>
                  </div>
                  <button type="button" onClick={() => { setReceiptImage(null); setScanned(null) }}
                    className="ml-auto text-gray-300 text-[20px]">×</button>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[12px] text-amber-700">
                💡 Keep original receipt — required for claims above AED 300
              </div>

              <button type="submit" disabled={submitLoading}
                className="w-full font-bold py-4 rounded-2xl text-[15px] text-white disabled:opacity-50"
                style={{ background: '#15803d' }}>
                {submitLoading ? '⏳ Saving…' : '⛽ Submit Fuel Entry'}
              </button>
            </form>
          </div>
        )}

        {/* ─── HISTORY TAB ─── */}
        {tab === 'history' && (
          <div className="space-y-2.5">
            {history.length === 0
              ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                  <div className="text-4xl mb-2">⛽</div>
                  <div className="font-semibold text-gray-600">No fuel entries yet</div>
                  <button onClick={() => setTab('scan')} className="mt-4 btn btn-primary btn-sm">Log First Entry</button>
                </div>
              )
              : history.map(e => (
                <div key={e.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${e.anomaly_flag ? 'border-red-200 bg-red-50/50' : 'border-gray-100'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-[15px] text-gray-800">
                        {e.litres?.toFixed(1)}L · AED {e.amount?.toFixed(2)}
                      </div>
                      <div className="text-[12px] text-gray-400">{e.station_name ?? 'Station not recorded'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-gray-400">{formatDate(e.created_at, 'dd MMM HH:mm')}</div>
                      {e.efficiency_kmpl && (
                        <div className={`text-[13px] font-bold mt-0.5 ${e.efficiency_kmpl < 5 ? 'text-red-600' : 'text-green-600'}`}>
                          {e.efficiency_kmpl.toFixed(1)} km/L
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between text-[11.5px] text-gray-400">
                    <span className="capitalize">{e.fuel_type?.replace('_', ' ')}</span>
                    {e.odometer && <span>Odo: {e.odometer.toLocaleString()} km</span>}
                    {e.anomaly_flag && <span className="text-red-500 font-semibold">⚠ Flagged</span>}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 bg-white border-t border-gray-200 grid grid-cols-4 py-2 z-50"
        style={{ left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430 }}>
        {[
          { icon: '🏠', label: 'Home', href: '/driver' },
          { icon: '🗺️', label: 'Trips', href: '/driver/trips' },
          { icon: '⛽', label: 'Fuel', href: '/driver/fuel', active: true },
          { icon: '👤', label: 'Profile', href: '/driver/profile' },
        ].map(item => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center py-1 gap-0.5">
            <span className="text-[20px]">{item.icon}</span>
            <span className={`text-[10px] font-medium ${(item as any).active ? 'text-primary-700' : 'text-gray-400'}`}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
