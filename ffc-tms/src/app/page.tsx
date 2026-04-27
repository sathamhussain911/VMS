'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RootPage() {
  const router = useRouter()
  const supabase = createClient()
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
      else router.replace('/login')
    })
  }, [])
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F3F4F6' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:64, height:64, background:'#3d7a18', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:20, color:'#fff', margin:'0 auto 16px' }}>FFC</div>
        <div style={{ width:32, height:32, border:'4px solid rgba(61,122,24,.2)', borderTopColor:'#3d7a18', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}
