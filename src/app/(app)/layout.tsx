'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/layout/AppShell'

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Run session check and user fetch in parallel for speed
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      // Fetch user profile in parallel with session validation
      const { data } = await supabase
        .from('users')
        .select('id,full_name,email,status,role:roles(id,name),branch:branches(id,name)')
        .eq('id', session.user.id)
        .maybeSingle()
      if (!data) { router.replace('/login'); return }
      setUser(data)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary-700/20 border-t-primary-700 rounded-full animate-spin mx-auto mb-3"/>
          <p className="text-gray-500 text-[14px] font-medium">Loading FFC TMS…</p>
        </div>
      </div>
    )
  }

  return <AppShell user={user}>{children}</AppShell>
}
