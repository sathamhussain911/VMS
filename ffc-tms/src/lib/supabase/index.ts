// Barrel export — import Supabase clients from one place
// Usage:
//   Server components:  import { createServerSupabaseClient } from '@/lib/supabase'
//   Client components:  import { createClient } from '@/lib/supabase'

export { createServerSupabaseClient } from './server'
export { createClient } from './client'
