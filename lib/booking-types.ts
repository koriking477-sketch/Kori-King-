export type SlotState = 'available' | 'held' | 'booked' | 'paid'

export type BookingRound = {
  id: string
  name: string
  first_number: number
  last_number: number
  opens_at: string
  closes_at: string
  status: 'scheduled' | 'open' | 'closed' | 'archived'
  created_at?: string
  report_downloaded_at?: string | null
}

export type NumberSlot = {
  id: string
  round_id: string
  slot_number: number
  status: SlotState
  hold_expires_at: string | null
}

export type BookingRecord = {
  id: string
  round_id: string
  slot_id: string
  slot_number: number
  customer_name: string | null
  mobile: string
  state: 'held' | 'booked' | 'paid' | 'released'
  created_at: string
  booked_at: string | null
  expires_at: string | null
}

export type PublicRoundResponse = {
  activeRound: BookingRound | null
  upcomingRound: BookingRound | null
  slots: NumberSlot[]
}

export type AdminOverviewResponse = {
  rounds: BookingRound[]
  selectedRound: BookingRound | null
  bookings: BookingRecord[]
}
