import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="text-center max-w-md">
        <div className="text-[80px] font-extrabold text-primary-700 leading-none mb-2">404</div>
        <h1 className="text-[22px] font-bold text-gray-900 mb-2">Page Not Found</h1>
        <p className="text-gray-500 text-[14px] mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/dashboard" className="btn btn-primary">
            ← Back to Dashboard
          </Link>
          <Link href="/operations/trips" className="btn btn-secondary">
            View Trips
          </Link>
        </div>
      </div>
    </div>
  )
}
