import { NextRequest, NextResponse } from 'next/server'
import { isSameOriginRequest, isUuid, jsonError, requireAdmin } from '@/lib/server-utils'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) return jsonError('Invalid request origin.', 403)

  const auth = await requireAdmin()
  if (!auth) return jsonError('Admin sign-in required.', 401)
  const { id } = await context.params
  if (!isUuid(id)) return jsonError('Booking not found.', 404)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Choose a valid booking action.', 400)
  }
  const state = body.state
  if (state !== 'paid' && state !== 'released') return jsonError('Choose paid or release.', 400)
  const { data, error } = await auth.admin.rpc('update_booking_state', { p_reservation_id: id, p_state: state })
  if (error || !data) return jsonError('Could not update this booking.', 409)
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) return jsonError('Invalid request origin.', 403)

  const auth = await requireAdmin()
  if (!auth) return jsonError('Admin sign-in required.', 401)
  const { id } = await context.params
  if (!isUuid(id)) return jsonError('Booking not found.', 404)
  const { data, error } = await auth.admin.rpc('delete_booking', { p_reservation_id: id })
  if (error || !data) return jsonError('Could not remove this booking.', 409)
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
