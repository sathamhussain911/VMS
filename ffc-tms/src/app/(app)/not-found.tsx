import Link from 'next/link'

export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-[72px] font-extrabold text-primary-700 leading-none mb-3">404</div>
      <h2 className="text-[20px] font-bold text-gray-900 mb-2">Record Not Found</h2>
      <p className="text-gray-500 text-[14px] mb-8 max-w-sm">
        The vehicle, driver, or trip you&apos;re looking for doesn&apos;t exist or may have been removed.
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <Link href="/fleet/vehicles" className="btn btn-secondary">Fleet →</Link>
        <Link href="/fleet/drivers"  className="btn btn-secondary">Drivers →</Link>
        <Link href="/operations/trips" className="btn btn-secondary">Trips →</Link>
        <Link href="/dashboard" className="btn btn-primary">Dashboard</Link>
      </div>
    </div>
  )
}
