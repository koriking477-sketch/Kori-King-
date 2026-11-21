import { NextRequest, NextResponse } from 'next/server'
import { allowPublicRequest, hashValue, isUuid, jsonError, normalizeIndianMobile, sanitizeText } from '@/lib/server-utils'
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
    return jsonError('Please check your details and try again.', 400)
  }

  const mobile = normalizeIndianMobile(body.mobile)
  const roundId = body.roundId
  const token = body.token
  const name = sanitizeText(body.name, 2, 80)
  const slotNumbers = parseSlotNumbers(body.slotNumbers)
  if (!mobile || !isUuid(roundId) || !isUuid(token) || !slotNumbers || !name) {
    return jsonError('Enter your name and check the selected numbers.', 400)
  }

  try {
    if (!(await allowPublicRequest(request, 'confirm', mobile))) {
      return jsonError('Too many attempts. Please wait a minute and try again.', 429)
    }
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('confirm_number_bookings', {
      p_round_id: roundId,
      p_slot_numbers: slotNumbers,
      p_mobile: mobile,
      p_token_hash: hashValue(token),
      p_customer_name: name,
    })
    if (error) {
      if (error.message.includes('hold_expired') || error.message.includes('reservation_not_found')) {
        return jsonError('Your one-minute hold has expired. Select your numbers again.', 409)
      }
      return jsonError('We could not complete this booking. Please try again.', 409)
    }
    const reservations = (data.reservations as { reservation_id: string; slot_number: number }[]).map((reservation) => ({
      reservationId: reservation.reservation_id,
      slotNumber: reservation.slot_number,
    }))
    return NextResponse.json(
      { reservations },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return jsonError('Booking is temporarily unavailable. Please try again.', 503)
  }
}
