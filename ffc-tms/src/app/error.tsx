'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html>
      <body style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", margin: 0, background: '#F3F4F6' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>⚠️</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
              Something went wrong
            </h1>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>
              An unexpected error occurred. Please try again or contact IT support if the problem persists.
            </p>
            {error.digest && (
              <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{ background: '#3d7a18', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
