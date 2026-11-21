import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NumberSlot } from '@/lib/booking-types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const { data: rounds, error: roundsError } = await admin
      .from('booking_rounds')
      .select('id,name,first_number,last_number,opens_at,closes_at,status,created_at')
      .in('status', ['open', 'scheduled'])
      .gt('closes_at', now)
      .order('opens_at', { ascending: true })
      .limit(10)
    if (roundsError) throw roundsError

    const activeRound = rounds?.find((round) => new Date(round.opens_at).getTime() <= Date.now()) ?? null
    const upcomingRound = rounds?.find((round) => new Date(round.opens_at).getTime() > Date.now()) ?? null

    let slots: NumberSlot[] = []
    if (activeRound) {
      const { data, error } = await admin
        .from('number_slots')
        .select('id,round_id,slot_number,status,hold_expires_at')
        .eq('round_id', activeRound.id)
        .order('slot_number', { ascending: true })
      if (error) throw error
      const nowMs = Date.now()
      slots = (data ?? []).map((slot): NumberSlot =>
        slot.status === 'held' && slot.hold_expires_at && new Date(slot.hold_expires_at).getTime() <= nowMs
          ? { ...slot, status: 'available', hold_expires_at: null }
          : slot,
      )
    }

    return NextResponse.json(
      { activeRound, upcomingRound, slots },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json({ error: 'Live availability is temporarily unavailable.' }, { status: 503 })
  }
}
