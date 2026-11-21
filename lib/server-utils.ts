import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const PUBLIC_RATE_LIMITS = {
  reserve: { ip: 12, subject: 6 },
  confirm: { ip: 8, subject: 4 },
} as const

// Used to hash rate-limit keys and hold tokens. The service role key is always
// present on the server, so the fallback is only a safety net for local setup.
const hashSecret = process.env.RATE_LIMIT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'personal-info'

export function jsonError(message: string, status: number) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' }
  if (status === 429) headers['Retry-After'] = '60'
  return NextResponse.json({ error: message }, { status, headers })
}

export function hashValue(value: string) {
  return createHmac('sha256', hashSecret).update(value).digest('hex')
}

export function normalizeIndianMobile(value: unknown) {
  if (typeof value !== 'string') return null
  let digits = value.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (!/^[6-9]\d{9}$/.test(digits)) return null
  return `+91${digits}`
}

export function sanitizeText(value: unknown, minLength: number, maxLength: number) {
  if (typeof value !== 'string') return null
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length < minLength || cleaned.length > maxLength) return null
  return cleaned
}

function clientIp(request: NextRequest) {
  const vercel = request.headers.get('x-vercel-forwarded-for')
  if (vercel) return vercel.split(',')[0]?.trim() || 'unknown'
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',').pop()?.trim() || 'unknown'
  return 'unknown'
}

/**
 * Consumes a rate-limit bucket for the caller's IP and, when known, the
 * customer's mobile number. Keying on both makes it much harder to bypass the
 * limit by rotating IPs or by targeting one number from many addresses.
 */
export async function allowPublicRequest(
  request: NextRequest,
  action: 'reserve' | 'confirm',
  mobile?: string,
) {
  const limits = PUBLIC_RATE_LIMITS[action]
  const supabase = createAdminClient()
  const checks = [
    supabase.rpc('consume_api_rate_limit', {
      p_key_hash: hashValue(`ip:${clientIp(request)}`),
      p_action: action,
      p_limit: limits.ip,
      p_window_seconds: 60,
    }),
  ]

  if (mobile) {
    checks.push(supabase.rpc('consume_api_rate_limit', {
      p_key_hash: hashValue(`mobile:${mobile}`),
      p_action: action,
      p_limit: limits.subject,
      p_window_seconds: 60,
    }))
  }

  const results = await Promise.all(checks)
  if (results.some((result) => result.error)) throw new Error('Rate limiter is unavailable.')
  return results.every((result) => result.data === true)
}

/**
 * Rejects cross-site state-changing requests (CSRF hardening). Browsers send
 * `Origin` on fetch/form POSTs; `Sec-Fetch-Site` is a fallback for clients that
 * do not. Same-origin and non-browser (no headers) requests are allowed.
 */
export function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      const expectedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
      return new URL(origin).host === expectedHost
    } catch {
      return false
    }
  }

  const site = request.headers.get('sec-fetch-site')
  return !site || site === 'same-origin' || site === 'none'
}

/**
 * Authorises an admin request. Membership in `admin_members` is the source of
 * truth; `ADMIN_EMAIL` is an optional extra lock for deployments that want it.
 * Never throws: misconfiguration or auth failures simply deny access.
 */
export async function requireAdmin() {
  try {
    const sessionClient = await createClient()
    const { data: { user }, error } = await sessionClient.auth.getUser()
    if (error || !user) return null

    const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
    if (configuredEmail && user.email?.trim().toLowerCase() !== configuredEmail) return null

    const admin = createAdminClient()
    const { data: membership, error: membershipError } = await admin
      .from('admin_members')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (membershipError || !membership) return null
    return { user, admin }
  } catch {
    return null
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
