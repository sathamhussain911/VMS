// ─────────────────────────────────────────────────────────────
//  FFC TMS — Shared UI Components
//  All components use Tailwind CSS classes from globals.css
// ─────────────────────────────────────────────────────────────
'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

// ── Badge ────────────────────────────────────────────────────
interface BadgeProps {
  children: ReactNode
  className?: string
}
export function Badge({ children, className }: BadgeProps) {
  return <span className={cn('badge', className)}>{children}</span>
}

// ── Button ───────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const variantClass = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    ghost:     'btn-ghost',
    danger:    'btn-danger',
  }[variant]

  const sizeClass = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
  }[size]

  return (
    <button
      className={cn('btn', variantClass, sizeClass, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      )}
      {children}
    </button>
  )
}

// ── Card ─────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode
  className?: string
}
export function Card({ children, className }: CardProps) {
  return <div className={cn('card', className)}>{children}</div>
}

export function CardHeader({ children, className }: CardProps) {
  return <div className={cn('card-header', className)}>{children}</div>
}

export function CardTitle({ children, className }: CardProps) {
  return <span className={cn('card-title', className)}>{children}</span>
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn('card-body', className)}>{children}</div>
}

// ── Alert ────────────────────────────────────────────────────
interface AlertProps {
  children: ReactNode
  variant?: 'red' | 'amber' | 'green' | 'blue'
  className?: string
}
export function Alert({ children, variant = 'blue', className }: AlertProps) {
  return (
    <div className={cn('alert', `alert-${variant}`, className)}>
      {children}
    </div>
  )
}

// ── MetricCard ───────────────────────────────────────────────
interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  colour?: 'green' | 'amber' | 'blue' | 'red' | 'teal'
  bar?: number
}
export function MetricCard({ label, value, sub, colour = 'green', bar }: MetricCardProps) {
  return (
    <div className={`metric-card ${colour}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {bar !== undefined && (
        <div className="progress-bar">
          <div
            className={`progress-fill ${bar >= 85 ? 'bg-primary-500' : bar >= 70 ? 'bg-amber' : 'bg-red-500'}`}
            style={{ width: `${bar}%` }}
          />
        </div>
      )}
      {sub && <p className="text-[12px] text-gray-400">{sub}</p>}
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────
interface SkeletonProps {
  className?: string
}
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)}/>
}

// ── PageHeader ───────────────────────────────────────────────
interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────
interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}
export function EmptyState({ icon = '📋', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="text-[16px] font-bold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-[13px] text-gray-400 mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  )
}

// ── Status Badge helpers ──────────────────────────────────────
import { vehicleStatusColour, driverStatusColour, tripStatusColour, expiryStatusColour } from '@/lib/utils'

export function VehicleStatusBadge({ status }: { status: string }) {
  return <span className={`badge ${vehicleStatusColour[status] ?? 'bg-gray-100 text-gray-500'}`}>{status.replace('_', ' ')}</span>
}

export function DriverStatusBadge({ status }: { status: string }) {
  return <span className={`badge ${driverStatusColour[status] ?? 'bg-gray-100 text-gray-500'}`}>{status.replace('_', ' ')}</span>
}

export function TripStatusBadge({ status }: { status: string }) {
  return <span className={`badge ${tripStatusColour[status] ?? 'bg-gray-100 text-gray-500'}`}>{status.replace('_', ' ')}</span>
}

export function ExpiryBadge({ status, label }: { status: string; label: string }) {
  return <span className={`badge ${expiryStatusColour[status] ?? 'bg-gray-100 text-gray-400'}`}>{label}</span>
}
