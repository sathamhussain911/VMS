import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { differenceInDays, format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Date helpers ──────────────────────────────────────────────

export function formatDate(date: string | Date | null | undefined, fmt = 'dd MMM yyyy'): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, fmt)
  } catch {
    return '—'
  }
}

export function formatDateTime(date: string | Date | null | undefined): string {
  return formatDate(date, 'dd MMM yyyy, HH:mm')
}

export function daysUntilExpiry(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null
  try {
    return differenceInDays(parseISO(expiryDate), new Date())
  } catch {
    return null
  }
}

export function expiryStatus(expiryDate: string | null | undefined): 'expired' | 'critical' | 'warning' | 'ok' | 'unknown' {
  const days = daysUntilExpiry(expiryDate)
  if (days === null) return 'unknown'
  if (days < 0) return 'expired'
  if (days <= 7) return 'critical'
  if (days <= 30) return 'warning'
  return 'ok'
}

export function expiryLabel(expiryDate: string | null | undefined): string {
  const days = daysUntilExpiry(expiryDate)
  if (days === null) return '—'
  if (days < 0) return `Expired ${Math.abs(days)}d ago`
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  if (days <= 30) return `${days} days`
  return formatDate(expiryDate)
}

// ── Number helpers ────────────────────────────────────────────

export function formatCurrency(amount: number | null | undefined, currency = 'AED'): string {
  if (amount == null) return '—'
  return `${currency} ${amount.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('en-AE')
}

// ── String helpers ────────────────────────────────────────────

export function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function truncate(str: string, length = 40): string {
  return str.length > length ? `${str.slice(0, length)}…` : str
}

// ── Status colour maps ────────────────────────────────────────

export const vehicleStatusColour: Record<string, string> = {
  available:   'bg-green-100 text-green-700',
  assigned:    'bg-blue-100 text-blue-700',
  maintenance: 'bg-amber-100 text-amber-700',
  inactive:    'bg-gray-100 text-gray-500',
}

export const driverStatusColour: Record<string, string> = {
  active:      'bg-green-100 text-green-700',
  on_leave:    'bg-blue-100 text-blue-700',
  suspended:   'bg-red-100 text-red-700',
  terminated:  'bg-gray-100 text-gray-500',
}

export const tripStatusColour: Record<string, string> = {
  requested:   'bg-purple-100 text-purple-700',
  approved:    'bg-blue-100 text-blue-700',
  assigned:    'bg-sky-100 text-sky-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  delayed:     'bg-amber-100 text-amber-700',
  cancelled:   'bg-gray-100 text-gray-500',
}

export const expiryStatusColour: Record<string, string> = {
  expired:  'bg-red-100 text-red-700',
  critical: 'bg-amber-100 text-amber-700',
  warning:  'bg-yellow-100 text-yellow-700',
  ok:       'bg-green-100 text-green-700',
  unknown:  'bg-gray-100 text-gray-400',
}

export const priorityColour: Record<string, string> = {
  urgent:  'bg-red-100 text-red-700',
  normal:  'bg-gray-100 text-gray-600',
  planned: 'bg-blue-100 text-blue-700',
}
