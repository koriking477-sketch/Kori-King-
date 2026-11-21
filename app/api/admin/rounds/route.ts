import { NextRequest, NextResponse } from 'next/server'
import { isSameOriginRequest, jsonError, requireAdmin, sanitizeText } from '@/lib/server-utils'

export const dynamic = 'force-dynamic'

function parseInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return jsonError('Invalid request origin.', 403)

  const context = await requireAdmin()
  if (!context) return jsonError('Admin sign-in required.', 401)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Check the round details and try again.', 400)
  }

  const name = sanitizeText(body.name, 2, 80)
  const firstNumber = parseInteger(body.firstNumber)
  const lastNumber = parseInteger(body.lastNumber)
  const opensAt = typeof body.opensAt === 'string' ? new Date(body.opensAt) : null
  const closesAt = typeof body.closesAt === 'string' ? new Date(body.closesAt) : null
  if (!name || firstNumber === null || lastNumber === null
    || firstNumber < 1 || lastNumber < firstNumber || lastNumber - firstNumber > 4999
    || !opensAt || !closesAt || Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime()) || closesAt <= opensAt) {
    return jsonError('Check the name, number range, and opening/closing times.', 400)
  }

  const { admin } = context
  const { data: previousRound, error: previousError } = await admin
    .from('booking_rounds')
    .select('id,name,closes_at')
    .lte('closes_at', opensAt.toISOString())
    .order('closes_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (previousError) return jsonError('Could not check previous rounds.', 503)
  if (previousRound) {
    return NextResponse.json(
      { error: `Delete "${previousRound.name}" before creating a new round.`, requiresRoundDeletion: previousRound.id },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const { data: roundId, error } = await admin.rpc('create_booking_round', {
    p_name: name,
    p_first_number: firstNumber,
    p_last_number: lastNumber,
    p_opens_at: opensAt.toISOString(),
    p_closes_at: closesAt.toISOString(),
  })
  if (error) {
    if (error.message.includes('previous_round_exists')) {
      return jsonError('A previous round must be deleted before creating a new round.', 409)
    }
    if (error.message.includes('round_name_conflict') || error.message.includes('booking_rounds_name_normalized_uidx')) {
      return jsonError('A round with this name already exists.', 409)
    }
    if (error.message.includes('round_time_conflict')) return jsonError('Another round overlaps this time.', 409)
    return jsonError('Could not create this round. Check the details and try again.', 400)
  }
  return NextResponse.json({ id: roundId }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
