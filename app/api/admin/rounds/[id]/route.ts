import { NextRequest, NextResponse } from 'next/server'
import { isSameOriginRequest, isUuid, jsonError, requireAdmin, sanitizeText } from '@/lib/server-utils'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

type RoundInput = {
  name: string
  firstNumber: number
  lastNumber: number
  opensAt: Date
  closesAt: Date
}

function parseInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function parseRoundInput(body: Record<string, unknown>): RoundInput | null {
  const name = sanitizeText(body.name, 2, 80)
  const firstNumber = parseInteger(body.firstNumber)
  const lastNumber = parseInteger(body.lastNumber)
  const opensAt = typeof body.opensAt === 'string' ? new Date(body.opensAt) : null
  const closesAt = typeof body.closesAt === 'string' ? new Date(body.closesAt) : null

  if (!name || firstNumber === null || lastNumber === null
    || firstNumber < 1 || lastNumber < firstNumber || lastNumber - firstNumber > 4999
    || !opensAt || !closesAt || Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime()) || closesAt <= opensAt) {
    return null
  }

  return { name, firstNumber, lastNumber, opensAt, closesAt }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) return jsonError('Invalid request origin.', 403)

  const auth = await requireAdmin()
  if (!auth) return jsonError('Admin sign-in required.', 401)

  const { id } = await context.params
  if (!isUuid(id)) return jsonError('Round not found.', 404)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Check the round details and try again.', 400)
  }

  const input = parseRoundInput(body)
  if (!input) return jsonError('Check the name, number range, and opening/closing times.', 400)

  const { data, error } = await auth.admin.rpc('update_booking_round', {
    p_round_id: id,
    p_name: input.name,
    p_first_number: input.firstNumber,
    p_last_number: input.lastNumber,
    p_opens_at: input.opensAt.toISOString(),
    p_closes_at: input.closesAt.toISOString(),
  })

  if (error) {
    if (error.message.includes('round_name_conflict') || error.message.includes('booking_rounds_name_normalized_uidx')) {
      return jsonError('A round with this name already exists.', 409)
    }
    if (error.message.includes('round_time_conflict')) return jsonError('Another round overlaps this time.', 409)
    if (error.message.includes('round_slots_in_use')) return jsonError('The number range cannot exclude numbers that already have booking records.', 409)
    if (error.message.includes('round_not_found')) return jsonError('Round not found.', 404)
    return jsonError('Could not update this round. Check the details and try again.', 400)
  }

  return NextResponse.json({ id: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) return jsonError('Invalid request origin.', 403)

  const auth = await requireAdmin()
  if (!auth) return jsonError('Admin sign-in required.', 401)

  const { id } = await context.params
  if (!isUuid(id)) return jsonError('Round not found.', 404)

  const { data: round, error: roundError } = await auth.admin
    .from('booking_rounds')
    .select('report_downloaded_at')
    .eq('id', id)
    .maybeSingle()

  if (roundError) return jsonError('Could not verify the round report status.', 503)
  if (!round) return jsonError('Round not found.', 404)
  if (!round.report_downloaded_at) {
    return jsonError('Download the round report before deleting this round.', 409)
  }

  const { data, error } = await auth.admin.rpc('delete_booking_round', { p_round_id: id })
  if (error) return jsonError('Could not delete this round.', 409)
  if (!data) return jsonError('Round not found.', 404)

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
