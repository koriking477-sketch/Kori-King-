import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | undefined

export function createClient() {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase public configuration is missing.')
    browserClient = createBrowserClient(url, key, {
      cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        // Ensure cookies are accessible across the whole domain
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
      // Force cookie storage so the server-side client can read the session
      cookieEncoding: 'base64url',
    })
  }
  return browserClient
}
