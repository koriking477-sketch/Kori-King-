import { NextRequest, NextResponse } from 'next/server'
import { isUuid, isSameOriginRequest, jsonError, requireAdmin } from '@/lib/server-utils'
import type { AdminOverviewResponse } from '@/lib/booking-types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isSameOriginRequest(request)) return jsonError('Invalid request origin.', 403)

  const context = await requireAdmin()
  if (!context) return jsonError('Admin sign-in required.', 401)

  const { admin } = context
  const { searchParams } = new URL(request.url)
  const requestedRound = searchParams.get('roundId')
  if (requestedRound && !isUuid(requestedRound)) return jsonError('Round not found.', 404)

  const { data: rounds, error: roundsError } = await admin
    .from('booking_rounds')
    .select('id,name,first_number,last_number,opens_at,closes_at,status,created_at,report_downloaded_at')
    .order('opens_at', { ascending: false })
    .limit(1000)
  if (roundsError) return jsonError('Could not load rounds.', 503)

  const now = Date.now()
  const selectedRound = rounds?.find((round) => round.id === requestedRound)
    ?? rounds?.find((round) => round.status !== 'archived' && new Date(round.closes_at).getTime() > now && new Date(round.opens_at).getTime() <= now)
    ?? rounds?.find((round) => round.status !== 'archived' && new Date(round.closes_at).getTime() > now)
    ?? rounds?.find((round) => round.status !== 'archived')
    ?? rounds?.[0]
    ?? null

  let bookings: AdminOverviewResponse['bookings'] = []
  if (selectedRound) {
    const pageSize = 1000
    const pageCount = 5
    const reservationPages = await Promise.all(Array.from({ length: pageCount }, (_, page) => admin
      .from('reservations')
      .select('id,round_id,slot_id,customer_name,mobile,state,created_at,booked_at,expires_at')
      .eq('round_id', selectedRound.id)
      .in('state', ['held', 'booked', 'paid', 'released'])
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1)))
    if (reservationPages.some((page) => page.error)) {
      return jsonError('Could not load bookings.', 503)
    }
    const rows = reservationPages.flatMap((page) => page.data ?? [])
    const slotPages = await Promise.all(Array.from({ length: pageCount }, (_, page) => admin
      .from('number_slots')
      .select('id,slot_number')
      .eq('round_id', selectedRound.id)
      .order('slot_number', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1)))
    if (slotPages.some((page) => page.error)) {
      return jsonError('Could not load booking numbers.', 503)
    }
    const numbers = new Map(slotPages.flatMap((page) => page.data ?? []).map((slot) => [slot.id, slot.slot_number]))
    bookings = rows.map((row) => ({ ...row, slot_number: numbers.get(row.slot_id) ?? 0 }))
  }

  const payload: AdminOverviewResponse = {
    rounds: rounds ?? [],
    selectedRound,
    bookings,
  }
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
}
