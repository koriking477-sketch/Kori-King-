import { NextRequest, NextResponse } from 'next/server'
import { isSameOriginRequest, jsonError } from '@/lib/server-utils'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Clears the Supabase session cookies on the server. The client then performs a
 * full navigation so no cached admin screen can be restored with the back button.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return jsonError('Invalid request origin.', 403)

  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // Even if Supabase is unreachable, the response must not leak session state.
  }

  return NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } },
  )
}
