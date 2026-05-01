'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, expiryStatus } from '@/lib/utils'

type ExportFormat = 'excel' | 'pdf'

export default function ReportsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState<string>('')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])

  // ─── DATA FETCHERS ───────────────────────────────────────────

  async function fetchTripData() {
    const { data: trips } = await supabase.from('trips')
      .select('trip_number,status,priority,planned_start,actual_start,actual_end,total_distance,opening_odometer,closing_odometer,branch:branches(name),vehicle:vehicles(vehicle_number),driver:drivers(full_name)')
      .gte('planned_start', `${dateFrom}T00:00:00`)
      .lte('planned_start', `${dateTo}T23:59:59`)
      .is('deleted_at', null)
      .order('planned_start', { ascending: false })
    return trips ?? []
  }

  async function fetchFleetData() {
    const [{ data: vehicles }, { data: trips }] = await Promise.all([
      supabase.from('vehicles').select('vehicle_number,make,model,vehicle_type,status,current_odometer,mulkiya_expiry,insurance_expiry,next_service_date').is('deleted_at', null),
      supabase.from('trips').select('vehicle_id,status,total_distance,planned_start').gte('planned_start', `${dateFrom}T00:00:00`).lte('planned_start', `${dateTo}T23:59:59`).is('deleted_at', null),
    ])
    const tripsByVehicle: Record<string, { total: number, completed: number, distance: number }> = {}
    trips?.forEach(t => {
      if (!t.vehicle_id) return
      if (!tripsByVehicle[t.vehicle_id]) tripsByVehicle[t.vehicle_id] = { total: 0, completed: 0, distance: 0 }
      tripsByVehicle[t.vehicle_id].total++
      if (t.status === 'completed') { tripsByVehicle[t.vehicle_id].completed++; tripsByVehicle[t.vehicle_id].distance += t.total_distance ?? 0 }
    })
    return (vehicles ?? []).map((v: any) => ({ ...v, trips: tripsByVehicle[v.id]?.total ?? 0, completed: tripsByVehicle[v.id]?.completed ?? 0, distance: tripsByVehicle[v.id]?.distance ?? 0 }))
  }

  async function fetchDocComplianceData() {
    const now = new Date()
    const [{ data: vehicles }, { data: drivers }] = await Promise.all([
      supabase.from('vehicles').select('vehicle_number,make,model,mulkiya_expiry,mulkiya_number,insurance_expiry,insurance_policy,gps_contract_expiry').is('deleted_at', null),
      supabase.from('drivers').select('full_name,employee_id,eid_expiry,license_expiry,passport_expiry').eq('status', 'active'),
    ])
    const rows: any[] = []
    vehicles?.forEach((v: any) => {
      rows.push({ entity: v.vehicle_number, entity_type: 'Vehicle', doc_type: 'Mulkiya', doc_number: v.mulkiya_number, expiry: v.mulkiya_expiry, status: expiryStatus(v.mulkiya_expiry) })
      rows.push({ entity: v.vehicle_number, entity_type: 'Vehicle', doc_type: 'Insurance', doc_number: v.insurance_policy, expiry: v.insurance_expiry, status: expiryStatus(v.insurance_expiry) })
      if (v.gps_contract_expiry) rows.push({ entity: v.vehicle_number, entity_type: 'Vehicle', doc_type: 'GPS Contract', doc_number: null, expiry: v.gps_contract_expiry, status: expiryStatus(v.gps_contract_expiry) })
    })
    drivers?.forEach((d: any) => {
      rows.push({ entity: d.full_name, entity_type: 'Driver', doc_type: 'Emirates ID', doc_number: d.employee_id, expiry: d.eid_expiry, status: expiryStatus(d.eid_expiry) })
      rows.push({ entity: d.full_name, entity_type: 'Driver', doc_type: 'Driving License', doc_number: null, expiry: d.license_expiry, status: expiryStatus(d.license_expiry) })
      if (d.passport_expiry) rows.push({ entity: d.full_name, entity_type: 'Driver', doc_type: 'Passport', doc_number: null, expiry: d.passport_expiry, status: expiryStatus(d.passport_expiry) })
    })
    return rows.sort((a, b) => { const o: any = { expired: 0, critical: 1, warning: 2, ok: 3 }; return (o[a.status] ?? 4) - (o[b.status] ?? 4) })
  }

  async function fetchDriverData() {
    const [{ data: drivers }, { data: trips }, { data: fuel }] = await Promise.all([
      supabase.from('drivers').select('id,full_name,employee_id,performance_score,branch:branches(name)').eq('status', 'active'),
      supabase.from('trips').select('driver_id,status,total_distance,planned_start,actual_start').gte('planned_start', `${dateFrom}T00:00:00`).lte('planned_start', `${dateTo}T23:59:59`).is('deleted_at', null).not('driver_id', 'is', null),
      supabase.from('fuel_entries').select('driver_id,litres,amount,efficiency_kmpl').gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59`),
    ])
    const tripsByDriver: Record<string, any> = {}
    trips?.forEach(t => {
      if (!t.driver_id) return
      if (!tripsByDriver[t.driver_id]) tripsByDriver[t.driver_id] = { total: 0, completed: 0, distance: 0 }
      tripsByDriver[t.driver_id].total++
      if (t.status === 'completed') { tripsByDriver[t.driver_id].completed++; tripsByDriver[t.driver_id].distance += t.total_distance ?? 0 }
    })
    const fuelByDriver: Record<string, any> = {}
    fuel?.forEach(f => {
      if (!f.driver_id) return
      if (!fuelByDriver[f.driver_id]) fuelByDriver[f.driver_id] = { cost: 0, litres: 0, efficiencies: [] }
      fuelByDriver[f.driver_id].cost += f.amount ?? 0
      fuelByDriver[f.driver_id].litres += f.litres ?? 0
      if (f.efficiency_kmpl) fuelByDriver[f.driver_id].efficiencies.push(f.efficiency_kmpl)
    })
    return (drivers ?? []).map((d: any) => ({
      ...d,
      trips: tripsByDriver[d.id]?.total ?? 0,
      completed: tripsByDriver[d.id]?.completed ?? 0,
      distance: tripsByDriver[d.id]?.distance ?? 0,
      fuel_cost: fuelByDriver[d.id]?.cost ?? 0,
      avg_efficiency: fuelByDriver[d.id]?.efficiencies?.length ? fuelByDriver[d.id].efficiencies.reduce((s: number, e: number) => s + e, 0) / fuelByDriver[d.id].efficiencies.length : null,
    }))
  }

  async function fetchCostData() {
    const [{ data: fuel }, { data: maint }, { data: fines }] = await Promise.all([
      supabase.from('fuel_entries').select('amount,litres,efficiency_kmpl,created_at,vehicle:vehicles(vehicle_number)').gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59`),
      supabase.from('maintenance_records').select('cost,maintenance_type,service_date,vehicle:vehicles(vehicle_number)').gte('service_date', dateFrom).lte('service_date', dateTo).eq('status', 'completed'),
      supabase.from('traffic_fines').select('fine_amount,fine_date,vehicle:vehicles(vehicle_number)').gte('fine_date', dateFrom).lte('fine_date', dateTo),
    ])
    return { fuel: fuel ?? [], maintenance: maint ?? [], fines: fines ?? [] }
  }

  // ─── EXCEL EXPORT ────────────────────────────────────────────

  function toCSV(headers: string[], rows: any[][]): string {
    const escape = (v: any) => {
      const s = v == null ? '' : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    return [headers, ...rows].map(row => row.map(escape).join(',')).join('\n')
  }

  function downloadCSV(filename: string, csv: string) {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // ─── PDF EXPORT ──────────────────────────────────────────────

  function downloadPDF(title: string, subtitle: string, headers: string[], rows: any[][], summary?: string) {
    const colWidth = Math.floor(170 / headers.length)
    const tableRows = rows.map(row =>
      `<tr>${row.map(cell => `<td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:10px;">${cell ?? '—'}</td>`).join('')}</tr>`
    ).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;margin:20px;color:#111;}
  h1{font-size:18px;color:#1b4a00;margin-bottom:4px;}
  .subtitle{font-size:12px;color:#6b7280;margin-bottom:4px;}
  .meta{font-size:11px;color:#9ca3af;margin-bottom:16px;}
  .summary{background:#f0fdf4;border:1px solid #bbf7d0;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:12px;}
  table{width:100%;border-collapse:collapse;margin-top:8px;}
  th{background:#1b4a00;color:white;padding:6px 8px;text-align:left;font-size:10px;font-weight:600;}
  tr:nth-child(even){background:#f9fafb;}
  @media print{body{margin:0;}}
</style></head><body>
<h1>FFC Transport Management — ${title}</h1>
<div class="subtitle">${subtitle}</div>
<div class="meta">Period: ${dateFrom} to ${dateTo} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-AE')} &nbsp;|&nbsp; Fresh Fruits Company UAE</div>
${summary ? `<div class="summary">${summary}</div>` : ''}
<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
<tbody>${tableRows}</tbody></table>
<div style="margin-top:20px;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px;">
Confidential — Fresh Fruits Company UAE | This report was generated automatically by FFC TMS
</div>
<script>window.onload=()=>window.print()</script>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  // ─── REPORT HANDLERS ─────────────────────────────────────────

  async function exportTrips(format: ExportFormat) {
    setLoading(`trips-${format}`)
    const data = await fetchTripData()
    const headers = ['Trip #', 'Status', 'Priority', 'Branch', 'Vehicle', 'Driver', 'Planned Start', 'Actual Start', 'Actual End', 'Distance (km)']
    const rows = data.map((t: any) => [
      t.trip_number, t.status, t.priority, t.branch?.name ?? '—', t.vehicle?.vehicle_number ?? '—', t.driver?.full_name ?? 'Unassigned',
      t.planned_start ? formatDate(t.planned_start, 'dd MMM yyyy HH:mm') : '—',
      t.actual_start ? formatDate(t.actual_start, 'dd MMM yyyy HH:mm') : '—',
      t.actual_end ? formatDate(t.actual_end, 'dd MMM yyyy HH:mm') : '—',
      t.total_distance ?? 0,
    ])
    const completed = data.filter((t: any) => t.status === 'completed').length
    const summary = `Total: ${data.length} | Completed: ${completed} (${data.length > 0 ? Math.round(completed / data.length * 100) : 0}%) | Cancelled: ${data.filter((t: any) => t.status === 'cancelled').length} | Total Distance: ${data.reduce((s: number, t: any) => s + (t.total_distance ?? 0), 0).toLocaleString()} km`
    if (format === 'excel') downloadCSV(`Trip-Summary-${dateFrom}-${dateTo}.csv`, toCSV(headers, rows))
    else downloadPDF('Trip Summary Report', 'Date range, branch, vehicle, driver filters. KPIs, delays, cost breakdown.', headers, rows, summary)
    setLoading('')
  }

  async function exportFleet(format: ExportFormat) {
    setLoading(`fleet-${format}`)
    const data = await fetchFleetData()
    const headers = ['Vehicle #', 'Make', 'Model', 'Type', 'Status', 'Odometer (km)', 'Trips', 'Completed', 'Distance (km)', 'Mulkiya Expiry', 'Insurance Expiry', 'Next Service']
    const rows = data.map((v: any) => [
      v.vehicle_number, v.make, v.model, v.vehicle_type ?? '—', v.status,
      v.current_odometer?.toLocaleString() ?? 0,
      v.trips, v.completed, v.distance.toLocaleString(),
      v.mulkiya_expiry ? formatDate(v.mulkiya_expiry) : 'NOT SET',
      v.insurance_expiry ? formatDate(v.insurance_expiry) : 'NOT SET',
      v.next_service_date ? formatDate(v.next_service_date) : '—',
    ])
    const available = data.filter((v: any) => v.status === 'available').length
    const summary = `Total Vehicles: ${data.length} | Available: ${available} | Assigned: ${data.filter((v: any) => v.status === 'assigned').length} | Maintenance: ${data.filter((v: any) => v.status === 'maintenance').length}`
    if (format === 'excel') downloadCSV(`Fleet-Utilisation-${dateFrom}-${dateTo}.csv`, toCSV(headers, rows))
    else downloadPDF('Fleet Utilisation Report', 'Vehicle-wise utilisation, idle days, maintenance downtime, cost per KM.', headers, rows, summary)
    setLoading('')
  }

  async function exportCompliance(format: ExportFormat) {
    setLoading(`compliance-${format}`)
    const data = await fetchDocComplianceData()
    const headers = ['Entity', 'Type', 'Document', 'Doc Number', 'Expiry Date', 'Days Left', 'Status']
    const rows = data.map((d: any) => {
      const daysLeft = d.expiry ? Math.ceil((new Date(d.expiry).getTime() - Date.now()) / 86400000) : null
      return [d.entity, d.entity_type, d.doc_type, d.doc_number ?? '—', d.expiry ? formatDate(d.expiry) : 'NOT SET', daysLeft === null ? '—' : daysLeft < 0 ? `${Math.abs(daysLeft)} days OVERDUE` : `${daysLeft} days`, d.status.toUpperCase()]
    })
    const expired = data.filter((d: any) => d.status === 'expired').length
    const critical = data.filter((d: any) => d.status === 'critical').length
    const summary = `Total Documents: ${data.length} | 🔴 Expired: ${expired} | 🟠 Critical (≤30 days): ${critical} | 🟡 Warning (≤60 days): ${data.filter((d: any) => d.status === 'warning').length} | ✅ Valid: ${data.filter((d: any) => d.status === 'ok').length}`
    if (format === 'excel') downloadCSV(`Document-Compliance-${new Date().toISOString().split('T')[0]}.csv`, toCSV(headers, rows))
    else downloadPDF('Document Compliance Report', 'All expiry statuses, renewal SLA, compliance % per entity and branch.', headers, rows, summary)
    setLoading('')
  }

  async function exportDrivers(format: ExportFormat) {
    setLoading(`drivers-${format}`)
    const data = await fetchDriverData()
    const headers = ['Driver', 'Employee ID', 'Branch', 'Trips', 'Completed', 'Completion %', 'Distance (km)', 'Fuel Cost (AED)', 'Avg Efficiency (km/L)', 'Performance Score']
    const rows = data.map((d: any) => [
      d.full_name, d.employee_id ?? '—', d.branch?.name ?? '—',
      d.trips, d.completed,
      d.trips > 0 ? `${Math.round((d.completed / d.trips) * 100)}%` : '0%',
      d.distance.toLocaleString(),
      d.fuel_cost > 0 ? `AED ${d.fuel_cost.toFixed(2)}` : '—',
      d.avg_efficiency ? `${d.avg_efficiency.toFixed(1)}` : '—',
      d.performance_score ?? 100,
    ])
    const avgScore = data.length ? data.reduce((s: number, d: any) => s + (d.performance_score ?? 100), 0) / data.length : 0
    const summary = `Total Drivers: ${data.length} | Avg Performance Score: ${avgScore.toFixed(1)}/100 | Total Trips: ${data.reduce((s: number, d: any) => s + d.trips, 0)}`
    if (format === 'excel') downloadCSV(`Driver-Performance-${dateFrom}-${dateTo}.csv`, toCSV(headers, rows))
    else downloadPDF('Driver Performance Report', 'Scores, trip counts, delays caused, fuel efficiency per driver.', headers, rows, summary)
    setLoading('')
  }

  async function exportCosts(format: ExportFormat) {
    setLoading(`costs-${format}`)
    const { fuel, maintenance, fines } = await fetchCostData()
    const headers = ['Date', 'Category', 'Vehicle', 'Description', 'Amount (AED)']
    const rows: any[][] = [
      ...fuel.map((f: any) => [formatDate(f.created_at), 'Fuel', f.vehicle?.vehicle_number ?? '—', `${f.litres?.toFixed(1)}L fuel`, `AED ${f.amount?.toFixed(2)}`]),
      ...maintenance.map((m: any) => [formatDate(m.service_date), 'Maintenance', m.vehicle?.vehicle_number ?? '—', m.maintenance_type, `AED ${m.cost?.toFixed(2)}`]),
      ...fines.map((f: any) => [formatDate(f.fine_date), 'Traffic Fine', f.vehicle?.vehicle_number ?? '—', 'Fine', `AED ${f.fine_amount?.toFixed(2)}`]),
    ].sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    const totalFuel = fuel.reduce((s: number, f: any) => s + (f.amount ?? 0), 0)
    const totalMaint = maintenance.reduce((s: number, m: any) => s + (m.cost ?? 0), 0)
    const totalFines = fines.reduce((s: number, f: any) => s + (f.fine_amount ?? 0), 0)
    const summary = `Total Spend: AED ${(totalFuel + totalMaint + totalFines).toFixed(2)} | Fuel: AED ${totalFuel.toFixed(2)} | Maintenance: AED ${totalMaint.toFixed(2)} | Fines: AED ${totalFines.toFixed(2)}`
    if (format === 'excel') downloadCSV(`Cost-Analysis-${dateFrom}-${dateTo}.csv`, toCSV(headers, rows))
    else downloadPDF('Cost Analysis Report', 'Cost per trip, per KM, per branch. Fuel + maintenance cost breakdown.', headers, rows, summary)
    setLoading('')
  }

  async function exportFuel(format: ExportFormat) {
    setLoading(`fuel-${format}`)
    const { data: fuel } = await supabase.from('fuel_entries')
      .select('litres,amount,efficiency_kmpl,anomaly_flag,station_name,fuel_type,created_at,vehicle:vehicles(vehicle_number),driver:drivers(full_name)')
      .gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59`).order('created_at', { ascending: false })
    const data = fuel ?? []
    const headers = ['Date', 'Vehicle', 'Driver', 'Fuel Type', 'Litres', 'Amount (AED)', 'Efficiency (km/L)', 'Station', 'Anomaly']
    const rows = data.map((f: any) => [
      formatDate(f.created_at), f.vehicle?.vehicle_number ?? '—', f.driver?.full_name ?? '—',
      f.fuel_type, f.litres?.toFixed(1), f.amount?.toFixed(2),
      f.efficiency_kmpl ? f.efficiency_kmpl.toFixed(1) : '—', f.station_name ?? '—',
      f.anomaly_flag ? 'YES' : 'No',
    ])
    const summary = `Entries: ${data.length} | Total: AED ${data.reduce((s: number, f: any) => s + (f.amount ?? 0), 0).toFixed(2)} | Total Litres: ${data.reduce((s: number, f: any) => s + (f.litres ?? 0), 0).toFixed(1)}L | Anomalies: ${data.filter((f: any) => f.anomaly_flag).length}`
    if (format === 'excel') downloadCSV(`Fuel-Report-${dateFrom}-${dateTo}.csv`, toCSV(headers, rows))
    else downloadPDF('Fuel Report', 'Fuel consumption, efficiency and anomalies per vehicle.', headers, rows, summary)
    setLoading('')
  }

  async function exportMaintenance(format: ExportFormat) {
    setLoading(`maint-${format}`)
    const { data: maint } = await supabase.from('maintenance_records')
      .select('*,vehicle:vehicles(vehicle_number)').gte('service_date', dateFrom).lte('service_date', dateTo).order('service_date', { ascending: false })
    const data = maint ?? []
    const headers = ['Date', 'Vehicle', 'Type', 'Title', 'Workshop', 'Cost (AED)', 'Status', 'Next Service']
    const rows = data.map((m: any) => [
      formatDate(m.service_date), m.vehicle?.vehicle_number ?? '—', m.maintenance_type,
      m.title, m.workshop_name ?? '—', m.cost ? `AED ${m.cost.toFixed(2)}` : '—',
      m.status, m.next_service_date ? formatDate(m.next_service_date) : '—',
    ])
    const summary = `Records: ${data.length} | Total Cost: AED ${data.reduce((s: number, m: any) => s + (m.cost ?? 0), 0).toFixed(2)}`
    if (format === 'excel') downloadCSV(`Maintenance-Report-${dateFrom}-${dateTo}.csv`, toCSV(headers, rows))
    else downloadPDF('Maintenance Report', 'Service records, costs and upcoming maintenance schedule.', headers, rows, summary)
    setLoading('')
  }

  // ─── REPORT CARDS CONFIG ──────────────────────────────────────

  const REPORTS = [
    {
      key: 'trips',
      title: 'Trip Summary Report',
      desc: 'Date range, branch, vehicle, driver filters. Includes KPIs, delays, cost breakdown.',
      icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#15803d" strokeWidth={2}><path strokeLinecap="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
      iconBg: 'bg-green-100',
      onExcel: () => exportTrips('excel'),
      onPDF: () => exportTrips('pdf'),
    },
    {
      key: 'fleet',
      title: 'Fleet Utilisation Report',
      desc: 'Vehicle-wise utilisation, idle days, maintenance downtime, cost per KM.',
      icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#2563eb" strokeWidth={2}><path strokeLinecap="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>,
      iconBg: 'bg-blue-100',
      onExcel: () => exportFleet('excel'),
      onPDF: () => exportFleet('pdf'),
    },
    {
      key: 'compliance',
      title: 'Document Compliance Report',
      desc: 'All expiry statuses, renewal SLA, compliance % per entity and branch.',
      icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth={2}><path strokeLinecap="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
      iconBg: 'bg-amber-100',
      onExcel: () => exportCompliance('excel'),
      onPDF: () => exportCompliance('pdf'),
    },
    {
      key: 'drivers',
      title: 'Driver Performance Report',
      desc: 'Scores, trip counts, delays caused, fuel efficiency per driver.',
      icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#0d9488" strokeWidth={2}><path strokeLinecap="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
      iconBg: 'bg-teal-100',
      onExcel: () => exportDrivers('excel'),
      onPDF: () => exportDrivers('pdf'),
    },
    {
      key: 'costs',
      title: 'Cost Analysis Report',
      desc: 'Cost per trip, per KM, per branch. Fuel + maintenance cost breakdown.',
      icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#15803d" strokeWidth={2}><path strokeLinecap="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1"/></svg>,
      iconBg: 'bg-green-100',
      onExcel: () => exportCosts('excel'),
      onPDF: () => exportCosts('pdf'),
    },
    {
      key: 'fuel',
      title: 'Fuel Report',
      desc: 'Fuel consumption, efficiency per vehicle, anomaly detection and cost analysis.',
      icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#ea580c" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6zm12 2h1a2 2 0 012 2v3a1 1 0 001 1h0a1 1 0 001-1V8l-2-2"/></svg>,
      iconBg: 'bg-orange-100',
      onExcel: () => exportFuel('excel'),
      onPDF: () => exportFuel('pdf'),
    },
    {
      key: 'maint',
      title: 'Maintenance Report',
      desc: 'Service records, repair costs, scheduled maintenance and vehicle health.',
      icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>,
      iconBg: 'bg-purple-100',
      onExcel: () => exportMaintenance('excel'),
      onPDF: () => exportMaintenance('pdf'),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Exports</h1>
          <p className="page-subtitle">Operational and management reporting — Excel, PDF, CSV</p>
        </div>
      </div>

      {/* Date Range */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="form-label">From Date</label>
              <input type="date" className="form-control h-9" value={dateFrom} onChange={e => setDateFrom(e.target.value)}/>
            </div>
            <div>
              <label className="form-label">To Date</label>
              <input type="date" className="form-control h-9" value={dateTo} onChange={e => setDateTo(e.target.value)}/>
            </div>
            {[
              { label: 'Today', fn: () => { const t = new Date().toISOString().split('T')[0]; setDateFrom(t); setDateTo(t) } },
              { label: 'This Week', fn: () => { const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1); setDateFrom(mon.toISOString().split('T')[0]); setDateTo(d.toISOString().split('T')[0]) } },
              { label: 'This Month', fn: () => { const d = new Date(); setDateFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]); setDateTo(d.toISOString().split('T')[0]) } },
              { label: 'Last Month', fn: () => { const d = new Date(); setDateFrom(new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]); setDateTo(new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]) } },
            ].map(b => <button key={b.label} onClick={b.fn} className="btn btn-secondary btn-sm">{b.label}</button>)}
          </div>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map(report => (
          <div key={report.key} className="card">
            <div className="card-body flex flex-col gap-3">
              <div className={`w-10 h-10 rounded-[10px] ${report.iconBg} flex items-center justify-center`}>
                {report.icon}
              </div>
              <div className="font-bold text-[14px] text-gray-800">{report.title}</div>
              <div className="text-[12px] text-gray-500 leading-relaxed flex-1">{report.desc}</div>
              <div className="flex gap-2 mt-1">
                <button onClick={report.onExcel} disabled={!!loading}
                  className="btn btn-primary btn-sm flex items-center gap-1.5 disabled:opacity-60">
                  {loading === `${report.key}-excel`
                    ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Exporting…</>
                    : <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      Excel
                    </>}
                </button>
                <button onClick={report.onPDF} disabled={!!loading}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 disabled:opacity-60">
                  {loading === `${report.key}-pdf`
                    ? <><div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"/>Generating…</>
                    : <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                      PDF
                    </>}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
