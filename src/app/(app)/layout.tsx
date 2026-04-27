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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const { data } = await supabase
        .from('users')
        .select('*, role:roles(*), branch:branches(*)')
        .eq('id', session.user.id)
        .single()
      setUser(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F3F4F6' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:32, height:32, border:'4px solid rgba(61,122,24,.2)', borderTopColor:'#3d7a18', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto' }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ marginTop:12, color:'#6B7280', fontSize:14, fontFamily:'Plus Jakarta Sans, sans-serif' }}>Loading FFC TMS…</p>
        </div>
      </div>
    )
  }

  return <AppShell user={user}>{children}</AppShell>
}
