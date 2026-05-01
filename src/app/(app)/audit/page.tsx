'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export default function AuditTrailPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50
  const [filters, setFilters] = useState({ table: '', action: '', search: '', date: '' })

  useEffect(() => { loadLogs() }, [page, filters])

  async function loadLogs() {
    setLoading(true)
    let query = supabase.from('audit_logs')
      .select('*', { count: 'exact' })
      .order('occurred_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filters.table) query = query.eq('table_name', filters.table)
    if (filters.action) query = query.eq('action', filters.action)
    if (filters.date) {
      query = query.gte('occurred_at', `${filters.date}T00:00:00`)
        .lte('occurred_at', `${filters.date}T23:59:59`)
    }
    if (filters.search) query = query.or(`actor_email.ilike.%${filters.search}%,record_id.ilike.%${filters.search}%,table_name.ilike.%${filters.search}%`)

    const { data, count } = await query
    setLogs(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }

  const ACTION_COLOR: Record<string, string> = {
    INSERT: 'bg-green-100 text-green-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
    LOGIN: 'bg-purple-100 text-purple-700',
    LOGOUT: 'bg-gray-100 text-gray-500',
    EXPORT: 'bg-amber-100 text-amber-700',
  }

  const TABLES = ['vehicles', 'drivers', 'trips', 'fuel_entries', 'users', 'maintenance_records', 'traffic_fines', 'accident_reports', 'approvals']

  function formatChanges(before: any, after: any) {
    if (!before && !after) return null
    if (!before) return <span className="text-green-600 text-[11px]">New record created</span>
    if (!after) return <span className="text-red-600 text-[11px]">Record deleted</span>

    const changes: string[] = []
    const allKeys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
    allKeys.forEach(key => {
      if (['updated_at', 'created_at'].includes(key)) return
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes.push(`${key}: ${before[key] ?? 'null'} → ${after[key] ?? 'null'}`)
      }
    })
    if (changes.length === 0) return null
    return (
      <div className="mt-1 space-y-0.5">
        {changes.slice(0, 3).map((c, i) => (
          <div key={i} className="text-[11px] font-mono text-gray-500 truncate max-w-xs">{c}</div>
        ))}
        {changes.length > 3 && <div className="text-[11px] text-gray-400">+{changes.length - 3} more changes</div>}
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Trail & Logs</h1>
          <p className="page-subtitle">Immutable change history — every INSERT, UPDATE, DELETE with before/after values</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <div className="text-[13px] text-blue-700">
          <strong>Read-only for all roles.</strong> Every business transaction is logged with full before/after values, user identity, IP address and timestamp. Records are retained indefinitely.
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="card-body">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="form-label">Search</label>
              <input className="form-control" placeholder="Email, record ID, table…"
                value={filters.search} onChange={e => { setFilters(p => ({ ...p, search: e.target.value })); setPage(0) }}/>
            </div>
            <div>
              <label className="form-label">Table</label>
              <select className="form-control" value={filters.table} onChange={e => { setFilters(p => ({ ...p, table: e.target.value })); setPage(0) }}>
                <option value="">All Tables</option>
                {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Action</label>
              <select className="form-control" value={filters.action} onChange={e => { setFilters(p => ({ ...p, action: e.target.value })); setPage(0) }}>
                <option value="">All Actions</option>
                {['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT'].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Date</label>
              <input type="date" className="form-control" value={filters.date}
                onChange={e => { setFilters(p => ({ ...p, date: e.target.value })); setPage(0) }}/>
            </div>
          </div>
          <button onClick={() => { setFilters({ table: '', action: '', search: '', date: '' }); setPage(0) }}
            className="btn btn-secondary btn-sm mt-3">Clear Filters</button>
        </div>
      </div>

      {/* Logs table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Audit Logs</span>
          <span className="text-[12px] text-gray-400">{total.toLocaleString()} total records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Time</th><th>Action</th><th>Table</th><th>Record ID</th><th>User</th><th>IP</th><th>Changes</th></tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading…</td></tr>
                : logs.length === 0
                  ? <tr><td colSpan={7} className="text-center py-10 text-gray-400">No audit logs found</td></tr>
                  : logs.map(log => (
                    <tr key={log.id}>
                      <td className="text-[11.5px] font-mono text-gray-500 whitespace-nowrap">
                        {formatDate(log.occurred_at, 'dd MMM HH:mm:ss')}
                      </td>
                      <td>
                        <span className={`badge text-[11px] ${ACTION_COLOR[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="text-[12px] font-mono text-primary-700">{log.table_name ?? '—'}</td>
                      <td className="text-[11px] font-mono text-gray-500 max-w-[100px] truncate">{log.record_id ?? '—'}</td>
                      <td className="text-[12px]">{log.actor_email ?? '—'}</td>
                      <td className="text-[11px] font-mono text-gray-400">{log.ip_address ?? '—'}</td>
                      <td>{formatChanges(log.before_value, log.after_value)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="p-4 flex items-center justify-between border-t border-gray-100">
            <span className="text-[13px] text-gray-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="btn btn-secondary btn-sm disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}
                className="btn btn-secondary btn-sm disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
