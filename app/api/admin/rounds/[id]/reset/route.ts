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

  // Clearing a round destroys customer records, so the report must be saved
  // first. This mirrors the delete guard and cannot be bypassed by calling the
  // API directly.
  const { data: round, error: roundError } = await auth.admin
    .from('booking_rounds')
    .select('report_downloaded_at')
    .eq('id', id)
    .maybeSingle()
  if (roundError) return jsonError('Could not verify the round report status.', 503)
  if (!round) return jsonError('Round not found.', 404)
  if (!round.report_downloaded_at) {
    return jsonError('Download the round report before clearing its records.', 409)
  }

  const { data, error } = await auth.admin.rpc('reset_booking_round', { p_round_id: id })
  if (error || !data) return jsonError('Could not clear this round.', 409)
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
