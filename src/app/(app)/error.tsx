'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h2 className="text-[20px] font-bold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-500 text-[14px] mb-2 max-w-sm">
        An error occurred while loading this page. Your data is safe.
      </p>
      {error.digest && (
        <p className="font-mono text-[12px] text-gray-400 mb-6">Ref: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="btn btn-primary"
        >
          Try Again
        </button>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
