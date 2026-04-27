export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-700 rounded-2xl mb-4 shadow-lg animate-pulse">
          <span className="text-white font-extrabold text-xl tracking-tight">FFC</span>
        </div>
        <div className="w-8 h-8 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin mx-auto mb-3"/>
        <p className="text-gray-500 text-sm font-medium">Loading FFC TMS…</p>
      </div>
    </div>
  )
}
