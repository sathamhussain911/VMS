// Server client — kept for compatibility but pages use client-side auth
// in static export mode
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types'

export function createServerSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
