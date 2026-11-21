import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { allowPublicRequest, hashValue, isUuid, jsonError, normalizeIndianMobile } from '@/lib/server-utils'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const MAX_NUMBERS_PER_BOOKING = 2

function parseSlotNumbers(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_NUMBERS_PER_BOOKING) return null
  const numbers = value.filter((item): item is number => typeof item === 'number')
  if (numbers.length !== value.length) return null
  const valid = numbers.every((number) => Number.isInteger(number) && number >= 1)
  return valid && new Set(numbers).size === numbers.length ? numbers : null
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Please try selecting those numbers again.', 400)
  }

  const mobile = normalizeIndianMobile(body.mobile)
  const roundId = body.roundId
  const slotNumbers = parseSlotNumbers(body.slotNumbers)
  if (!mobile || !isUuid(roundId) || !slotNumbers) {
    return jsonError('Enter a valid Indian mobile number and choose up to two available numbers.', 400)
  }

  try {
    if (!(await allowPublicRequest(request, 'reserve', mobile))) {
      return jsonError('Too many attempts. Please wait a minute and try again.', 429)
    }
    const token = randomUUID()
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('reserve_numbers', {
      p_round_id: roundId,
      p_slot_numbers: slotNumbers,
      p_mobile: mobile,
      p_token_hash: hashValue(token),
    })
    if (error) {
      const message = error.message
      if (message.includes('slot_unavailable')) return jsonError('One of those numbers was just taken. Choose again.', 409)
      if (message.includes('mobile_already_booked')) return jsonError('This mobile number already has a booking in this round.', 409)
      if (message.includes('round_not_open')) return jsonError('This round is not open for booking.', 409)
      return jsonError('We could not hold those numbers. Please try again.', 400)
    }
    return NextResponse.json(
      { token, expiresAt: data.expires_at, slotNumbers },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return jsonError('Live availability is temporarily unavailable. Please try again.', 503)
  }
}
