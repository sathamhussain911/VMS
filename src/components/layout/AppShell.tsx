'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn, initials } from '@/lib/utils'
import type { User } from '@/types'

const NAV = [
  { section: 'Overview' },
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { section: 'Operations' },
  { href: '/operations/trips', label: 'Trips & Delivery', icon: 'map' },
  { href: '/operations/dispatch', label: 'Dispatch Board', icon: 'calendar' },
  { section: 'Fleet' },
  { href: '/fleet/vehicles', label: 'Vehicles', icon: 'truck' },
  { href: '/fleet/drivers', label: 'Drivers', icon: 'users' },
  { href: '/fleet/fuel', label: 'Fuel Log', icon: 'fuel' },
  { href: '/fleet/maintenance', label: 'Maintenance', icon: 'wrench' },
  { section: 'Compliance' },
  { href: '/compliance/documents', label: 'Documents & Expiry', icon: 'file' },
  { section: 'Compliance & Workflows' },
  { href: '/approvals', label: 'Approvals', icon: 'check' },
  { href: '/fines', label: 'Fines & Accidents', icon: 'alert' },
  { href: '/audit', label: 'Audit Trail', icon: 'log' },
  { section: 'Finance' },
  { href: '/finance', label: 'Costs & Finance', icon: 'finance' },
  { section: 'Reports' },
  { href: '/reports', label: 'Reports & Analytics', icon: 'chart' },
  { href: '/notifications', label: 'Notifications', icon: 'bell' },
  { href: '/ai-analytics', label: 'AI Analytics', icon: 'ai' },
  { section: 'Admin' },
  { href: '/admin', label: 'Admin & Settings', icon: 'settings' },
]

const ICONS: Record<string, React.ReactNode> = {
  grid: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  map: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>,
  calendar: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  truck: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>,
  users: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  fuel: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6zm12 2h1a2 2 0 012 2v3a1 1 0 001 1h0a1 1 0 001-1V8l-2-2m-3 0v4"/></svg>,
  wrench: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>,
  file: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  check: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  alert: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>,
  log: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  finance: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  chart: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  bell: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
  ai: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>,
  settings: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>,
}

interface AppShellProps {
  user: User | null
  children: React.ReactNode
}

export default function AppShell({ user, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <nav className={cn('flex flex-col h-full bg-primary-900 transition-all duration-200 flex-shrink-0', collapsed ? 'w-16' : 'w-[260px]')} style={{ zIndex: 100 }}>
        <div className="h-16 flex items-center gap-3 px-4 border-b border-white/10 flex-shrink-0 overflow-hidden">
          <div className="w-9 h-9 min-w-[36px] bg-gradient-to-br from-primary-400 to-primary-500 rounded-[9px] flex items-center justify-center font-extrabold text-[15px] text-white shadow-md">FFC</div>
          {!collapsed && (
            <div className="overflow-hidden whitespace-nowrap">
              <strong className="block text-white text-[14px] font-extrabold tracking-tight leading-tight">Fresh Fruits Co.</strong>
              <span className="text-primary-300 text-[11px] font-medium tracking-wide">Transport Management</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-2.5 scrollbar-none">
          {NAV.map((item, i) => {
            if ('section' in item) {
              return collapsed ? null : (
                <div key={i} className="px-5 py-2.5 pt-4 text-[10px] font-bold text-white/30 uppercase tracking-[1.2px]">{item.section}</div>
              )
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href!}
                className={cn('flex items-center gap-3 px-4 py-2.5 text-[13.5px] font-medium transition-all border-l-[3px] border-transparent',
                  isActive ? 'bg-white/12 border-primary-400 text-white font-semibold' : 'text-white/65 hover:text-white hover:bg-white/7')}>
                <span className="w-[18px] h-[18px] min-w-[18px]">{ICONS[item.icon!]}</span>
                {!collapsed && <span className="flex-1 whitespace-nowrap">{item.label}</span>}
              </Link>
            )
          })}
        </div>

        <div className="p-3 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/7 cursor-pointer overflow-hidden" onClick={handleSignOut} title="Sign out">
            <div className="w-[34px] h-[34px] min-w-[34px] rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-[13px]">
              {user?.full_name ? initials(user.full_name) : 'U'}
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <div className="text-white text-[13px] font-semibold whitespace-nowrap truncate">{user?.full_name ?? 'User'}</div>
                <div className="text-primary-300 text-[11px] whitespace-nowrap">{user?.role?.name ?? 'Staff'}</div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4 flex-shrink-0 shadow-sm">
          <button onClick={() => setCollapsed(c => !c)} className="w-[34px] h-[34px] flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <div className="flex-1 max-w-sm">
            <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-3 h-9 focus-within:bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/10 transition-all">
              <svg className="w-[15px] h-[15px] text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
              <input type="text" placeholder="Search vehicles, drivers, trips…" className="bg-transparent border-none outline-none text-[13px] text-gray-700 w-full"/>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-gray-500 text-[12.5px] hidden sm:flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              {new Date().toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <Link href="/notifications" className="w-9 h-9 border border-gray-200 bg-white rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-50 relative transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"/>
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 animate-fade-up">{children}</main>
      </div>
    </div>
  )
}
