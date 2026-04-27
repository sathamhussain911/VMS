import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types'
 
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tqonszwlaurmfwrpycsc.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxb25zendsYXVybWZ3cnB5Y3NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNzg4OTQsImV4cCI6MjA5Mjg1NDg5NH0.kJvDpmitBUaYrg4Ij_85fTUaHIVWnzP4NNLfo6L1_Dc'
 
export function createClient() {
  return createBrowserClient<Database>(url, key)
}
 
