import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

/**
 * Server-side sign-in endpoint.
 * Calls signInWithPassword on the server so the session cookies are written
 * directly into the HTTP response — the browser never touches document.cookie.
 * Returns 200 with { ok: true } on success, or 401/400/500 with { error }.
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  // We need to collect the cookies the server client wants to set.
  const cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabase = createServerClient(url, key, {
    cookieEncoding: 'base64url',
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(setCookies) {
        setCookies.forEach(({ name, value, options }) => {
          cookiesToSet.push({ name, value, options: options as Record<string, unknown> })
        })
      },
    },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })

  if (error) {
    const status = error.status === 400 ? 401 : (error.status ?? 500)
    return NextResponse.json({ error: error.message }, { status })
  }

  if (!data.session) {
    return NextResponse.json({ error: 'No session returned.' }, { status: 401 })
  }

  // Check admin membership before confirming success.
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('admin_members')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle()

  if (!membership) {
    // Sign them back out — not an admin.
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'Admin access is not enabled for this account.' }, { status: 403 })
  }

  // Check ADMIN_EMAIL lock if configured.
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (configuredEmail && data.user.email?.trim().toLowerCase() !== configuredEmail) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'Admin access is not enabled for this account.' }, { status: 403 })
  }

  // Build the response and attach all session cookies.
  const response = NextResponse.json({ ok: true }, { status: 200 })
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, {
      path: (options.path as string | undefined) ?? '/',
      sameSite: (options.sameSite as 'lax' | 'strict' | 'none' | undefined) ?? 'lax',
      secure: (options.secure as boolean | undefined) ?? (process.env.NODE_ENV === 'production'),
      maxAge: typeof options.maxAge === 'number' ? options.maxAge : 60 * 60 * 24 * 7,
      httpOnly: false,
    })
  })

  return response
}
