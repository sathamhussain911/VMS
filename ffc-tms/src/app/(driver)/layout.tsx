import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'FFC Driver Portal',
  description: 'FFC Driver App — Trips, Delivery & Fuel',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#1b4a00',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// Driver portal has its own minimal layout (no office sidebar)
export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", maxWidth: 430, margin: '0 auto', minHeight: '100vh' }}>
      {children}
    </div>
  )
}
