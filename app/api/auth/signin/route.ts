import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Cookie options matching @supabase/ssr defaults
const COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax' as const,
  httpOnly: false,
  maxAge: 400 * 24 * 60 * 60,
}

/**
 * Server-side sign-in endpoint.
 * Uses the plain supabase-js client (no SSR wrapper) to sign in, then
 * manually encodes the session tokens into Set-Cookie headers on the response.
 * This matches exactly what @supabase/ssr would write so the proxy and server
 * client can read the session on subsequent requests.
 */
export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { email, password } = body
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  // Plain client — session is stored in memory only, not persisted to cookies.
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })

  if (error) {
    const status = error.status === 400 ? 401 : (error.status ?? 500)
    return NextResponse.json({ error: error.message }, { status })
  }

  if (!data.session) {
    return NextResponse.json({ error: 'No session returned.' }, { status: 401 })
  }

  // Check admin membership.
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('admin_members')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Admin access is not enabled for this account.' }, { status: 403 })
  }

  // Check optional ADMIN_EMAIL lock.
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (configuredEmail && data.user.email?.trim().toLowerCase() !== configuredEmail) {
    return NextResponse.json({ error: 'Admin access is not enabled for this account.' }, { status: 403 })
  }

  // The storage key @supabase/ssr uses is `sb-<project-ref>-auth-token`.
  // Extract the project ref from the Supabase URL.
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const storageKey = `sb-${projectRef}-auth-token`

  // Encode the session as @supabase/ssr does with cookieEncoding: 'base64url'.
  // The value must be base64url(JSON.stringify(session)).
  const sessionJson = JSON.stringify(data.session)
  const encoded = 'base64-' + Buffer.from(sessionJson).toString('base64url')

  const isProduction = process.env.NODE_ENV === 'production'
  const cookieStr = [
    `${storageKey}=${encoded}`,
    `Path=${COOKIE_OPTIONS.path}`,
    `SameSite=${COOKIE_OPTIONS.sameSite}`,
    `Max-Age=${COOKIE_OPTIONS.maxAge}`,
    ...(isProduction ? ['Secure'] : []),
  ].join('; ')

  const response = NextResponse.json({ ok: true }, { status: 200 })
  response.headers.append('Set-Cookie', cookieStr)
  return response
}
