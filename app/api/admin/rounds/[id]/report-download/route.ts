import { NextRequest, NextResponse } from 'next/server'
import { isSameOriginRequest, isUuid, jsonError, requireAdmin } from '@/lib/server-utils'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) return jsonError('Invalid request origin.', 403)

  const auth = await requireAdmin()
  if (!auth) return jsonError('Admin sign-in required.', 401)

  const { id } = await context.params
  if (!isUuid(id)) return jsonError('Round not found.', 404)

  const { data, error } = await auth.admin
    .from('booking_rounds')
    .update({ report_downloaded_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) return jsonError('Could not save the report download status.', 503)
  if (!data) return jsonError('Round not found.', 404)

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
