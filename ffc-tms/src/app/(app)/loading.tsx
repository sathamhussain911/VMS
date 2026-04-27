export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-5">
      {/* Page header skeleton */}
      <div className="flex items-start justify-between">
        <div>
          <div className="skeleton h-7 w-48 rounded-lg mb-2"/>
          <div className="skeleton h-4 w-72 rounded"/>
        </div>
        <div className="skeleton h-9 w-28 rounded-lg"/>
      </div>

      {/* Metrics row skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-[10px] border border-gray-200 p-5 space-y-3">
            <div className="skeleton h-3 w-24 rounded"/>
            <div className="skeleton h-7 w-16 rounded"/>
            <div className="skeleton h-2 w-32 rounded"/>
          </div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3 bg-white rounded-[10px] border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="skeleton h-4 w-32 rounded"/>
            <div className="skeleton h-7 w-20 rounded"/>
          </div>
          <div className="p-5 space-y-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="skeleton h-4 w-24 rounded"/>
                <div className="skeleton h-4 w-20 rounded"/>
                <div className="skeleton h-4 w-28 rounded"/>
                <div className="skeleton h-4 w-16 rounded"/>
                <div className="skeleton h-5 w-20 rounded-full ml-auto"/>
              </div>
            ))}
          </div>
        </div>
        <div className="xl:col-span-2 bg-white rounded-[10px] border border-gray-200 p-5 space-y-4">
          <div className="skeleton h-4 w-36 rounded"/>
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-lg"/>
          ))}
        </div>
      </div>
    </div>
  )
}
