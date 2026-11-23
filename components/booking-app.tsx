'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Clock3,
  LockKeyhole,
  Phone,
  RefreshCw,
} from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { createClient } from '@/lib/supabase/client'
import type { NumberSlot, PublicRoundResponse } from '@/lib/booking-types'

type BookingStep = 'phone' | 'slots' | 'name'
type ApiError = Error & { status?: number }

const MAX_NUMBERS_PER_BOOKING = 2
const WHATSAPP_NUMBER = '919353658262'

type Hold = { token: string; expiresAt: string }

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    return {} as T
  }
}

async function getRound() {
  const response = await fetch('/api/public/round', { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Could not load availability.')
  return data as PublicRoundResponse
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatMobile(value: string) {
  const nationalNumber = value.replace(/^\+91/, '')
  return nationalNumber.length === 10
    ? `+91 ${nationalNumber.slice(0, 5)} ${nationalNumber.slice(5)}`
    : value
}

function formatCountdown(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function joinNumbers(numbers: number[]) {
  return numbers.join(' & ')
}

export function BookingApp() {
  const { data, error, isLoading, mutate } = useSWR<PublicRoundResponse>('/api/public/round', getRound, {
    refreshInterval: 15000,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    revalidateOnFocus: true,
    shouldRetryOnError: true,
  })
  const [step, setStep] = useState<BookingStep>('phone')
  const [phoneDigits, setPhoneDigits] = useState('')
  const [mobile, setMobile] = useState('')
  const [name, setName] = useState('')
  const [selectedSlotNumbers, setSelectedSlotNumbers] = useState<number[]>([])
  const [heldSlotNumbers, setHeldSlotNumbers] = useState<number[]>([])
  const [hold, setHold] = useState<Hold | null>(null)
  const [message, setMessage] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const reservationInFlight = useRef(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const roundId = data?.activeRound?.id
  useEffect(() => {
    if (!roundId) return
    const client = createClient()
    const channel = client
      .channel(`round-slots-${roundId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'number_slots', filter: `round_id=eq.${roundId}` }, (payload) => {
        const incoming = (payload.eventType === 'DELETE' ? payload.old : payload.new) as NumberSlot
        if (!incoming?.id) return
        void mutate((current) => {
          if (!current) return current
          if (payload.eventType === 'DELETE') {
            return { ...current, slots: current.slots.filter((slot) => slot.id !== incoming.id) }
          }
          const found = current.slots.some((slot) => slot.id === incoming.id)
          const slots = found
            ? current.slots.map((slot) => slot.id === incoming.id ? { ...slot, ...incoming } : slot)
            : [...current.slots, incoming].sort((a, b) => a.slot_number - b.slot_number)
          return { ...current, slots }
        }, false)
      })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [roundId, mutate])

  const visibleSlots = useMemo(
    () => (data?.slots ?? []).map((slot) =>
      slot.status === 'held' && slot.hold_expires_at && new Date(slot.hold_expires_at).getTime() <= now
        ? { ...slot, status: 'available' as const, hold_expires_at: null }
        : slot,
    ),
    [data?.slots, now],
  )

  const counts = useMemo(() => {
    return {
      available: visibleSlots.filter((slot) => slot.status === 'available').length,
      held: visibleSlots.filter((slot) => slot.status === 'held').length,
      booked: visibleSlots.filter((slot) => slot.status === 'booked').length,
      paid: visibleSlots.filter((slot) => slot.status === 'paid').length,
    }
  }, [visibleSlots])

  const availableNumbers = useMemo(
    () => new Set(visibleSlots.filter((slot) => slot.status === 'available').map((slot) => slot.slot_number)),
    [visibleSlots],
  )
  const holdIsActive = Boolean(hold && new Date(hold.expiresAt).getTime() > now)
  const activeSelection = selectedSlotNumbers.filter(
    (number) => availableNumbers.has(number) || (holdIsActive && heldSlotNumbers.includes(number)),
  )
  const remainingSeconds = hold ? Math.max(0, Math.ceil((new Date(hold.expiresAt).getTime() - now) / 1000)) : 0
  const activeRound = data?.activeRound
  const upcomingRound = data?.upcomingRound

  useEffect(() => {
    if (!hold || holdIsActive) return
    setHold(null)
    setHeldSlotNumbers([])
    setSelectedSlotNumbers([])
    if (step === 'name') setStep('slots')
    setMessage('Your one-minute hold expired. Select the number again to hold it.')
    void mutate()
  }, [hold, holdIsActive, mutate, step])

  async function continueWithPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
      setMessage('Enter a valid 10-digit Indian mobile number.')
      return
    }
    if (!activeRound) {
      setMessage('There is no open round right now. Please check back when the next round opens.')
      return
    }
    setMobile(`+91${phoneDigits}`)
    setStep('slots')
  }

  async function releaseHold(currentHold: Hold) {
    const response = await fetch('/api/public/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId: activeRound?.id, mobile, token: currentHold.token }),
    })
    if (!response.ok) {
      const result = await readJson<{ error?: string }>(response)
      throw new Error(result.error ?? 'Could not release your selection.')
    }
  }

  async function updateHeldSelection(numbersToHold: number[]) {
    if (!activeRound || reservationInFlight.current) return
    const currentHold = hold
    reservationInFlight.current = true
    setIsWorking(true)
    setMessage('')
    try {
      // Release the old hold before requesting the new one. Reserving on top of
      // an existing hold makes the server treat the numbers as unavailable.
      if (currentHold) {
        await releaseHold(currentHold)
        setHold(null)
        setHeldSlotNumbers([])
      }

      if (numbersToHold.length > 0) {
        const response = await fetch('/api/public/reserve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roundId: activeRound.id, slotNumbers: numbersToHold, mobile }),
        })
        const result = await readJson<{ token?: string; expiresAt?: string; error?: string }>(response)
        if (!response.ok || !result.token || !result.expiresAt) {
          throw new Error(result.error ?? 'Could not hold those numbers.')
        }
        setHold({ token: result.token, expiresAt: result.expiresAt })
        setHeldSlotNumbers(numbersToHold)
        setSelectedSlotNumbers(numbersToHold)
      } else {
        setSelectedSlotNumbers([])
      }
      await mutate()
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not update your selection. Please try again.')
      void mutate()
    } finally {
      reservationInFlight.current = false
      setIsWorking(false)
    }
  }

  function toggleSlot(slot: NumberSlot) {
    if (isWorking) return
    const ownsSlot = holdIsActive && heldSlotNumbers.includes(slot.slot_number)
    if (slot.status !== 'available' && !ownsSlot) return
    const nextSelection = activeSelection.includes(slot.slot_number)
      ? activeSelection.filter((number) => number !== slot.slot_number)
      : [...activeSelection, slot.slot_number].sort((a, b) => a - b)
    if (nextSelection.length > MAX_NUMBERS_PER_BOOKING) {
      setMessage(`You can book up to ${MAX_NUMBERS_PER_BOOKING} numbers at once.`)
      return
    }
    void updateHeldSelection(nextSelection)
  }

  function continueToDetails() {
    if (!holdIsActive || activeSelection.length === 0) {
      setMessage('Your one-minute hold expired. Select the number again to hold it.')
      return
    }
    setMessage('')
    setStep('name')
  }

  async function confirmBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeRound || heldSlotNumbers.length === 0 || !hold) return
    setMessage('')
    setIsWorking(true)
    let whatsappWindow: Window | null = null
    try {
      whatsappWindow = window.open('about:blank', '_blank')
      if (whatsappWindow) whatsappWindow.opener = null

      const response = await fetch('/api/public/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: activeRound.id,
          slotNumbers: heldSlotNumbers,
          mobile,
          token: hold.token,
          name: name.trim(),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Could not complete your booking.')

      const whatsappMessage = `Hi, I have booked\n*Number:* *${joinNumbers(heldSlotNumbers)}*\n*Mobile number:* *${formatMobile(mobile)}*\n*Name:* *${name.trim()}*\n\nPlease share the QR for the payment.`
      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`

      setHold(null)
      setHeldSlotNumbers([])
      setSelectedSlotNumbers([])
      setStep('phone')
      setPhoneDigits('')
      setMobile('')
      setName('')
      setMessage(whatsappWindow ? 'Booking saved. WhatsApp opened in a new tab.' : '')
      void mutate()

      if (whatsappWindow) {
        whatsappWindow.location.replace(whatsappUrl)
      } else {
        window.location.assign(whatsappUrl)
      }
    } catch (cause) {
      whatsappWindow?.close()
      setMessage(cause instanceof Error ? cause.message : 'Could not complete your booking.')
      if (hold && new Date(hold.expiresAt).getTime() <= Date.now()) {
        setHold(null)
        setHeldSlotNumbers([])
        setSelectedSlotNumbers([])
        setStep('slots')
      }
      await mutate()
    } finally {
      setIsWorking(false)
    }
  }

  async function returnToPhone() {
    const currentHold = hold
    setMessage('')
    if (currentHold && activeRound) {
      try {
        await releaseHold(currentHold)
      } catch {
        setMessage('Your selection may remain held until the countdown ends.')
      }
    }
    setStep('phone')
    setSelectedSlotNumbers([])
    setHeldSlotNumbers([])
    setHold(null)
    void mutate()
  }

  return (
    <main className="public-shell">
      <div className="booking-frame">
        <header className="site-header">
          <a className="brand-lockup" href="/" aria-label="Personal Info booking">
            <BrandMark className="public-brand-mark" />
            <span className="public-brand-copy">
              <span className="brand-name">PERSONAL INFO</span>
              <span className="brand-subtitle">Member Access</span>
            </span>
          </a>
        </header>

        <section className="booking-card" aria-labelledby="booking-heading">
          <div className="member-intro">
            <h1 id="booking-heading">{step === 'phone' ? 'Book a Number' : step === 'slots' ? 'Choose Your Numbers' : 'Almost There'}</h1>
            {step !== 'slots' && <p className="member-description">{step === 'phone' ? 'Enter your WhatsApp number to see available numbers.' : 'Add your name to complete the booking.'}</p>}
            {step === 'phone' && <div className="round-meta">
              <span className={`status-pulse ${activeRound ? 'is-live' : ''}`} aria-hidden="true" />
              <span>{isLoading ? 'Checking the next round' : activeRound ? 'Round is open' : 'No round open right now'}</span>
              {activeRound && <strong>{activeRound.name}</strong>}
              {!activeRound && upcomingRound && <small>Opens {formatDate(upcomingRound.opens_at)}</small>}
            </div>}
          </div>

          {step !== 'slots' && <div className="progress-track" aria-label={`Step ${step === 'phone' ? '1' : '3'} of 3`}>
            <span className={step === 'phone' ? 'active' : 'done'} />
            <span className={step === 'name' ? 'done' : ''} />
            <span className={step === 'name' ? 'active' : ''} />
          </div>}

          {step === 'phone' && <form className="booking-form" onSubmit={continueWithPhone}>
            <label htmlFor="mobile-number">WhatsApp mobile number</label>
            <div className="phone-control">
              <span className="country-code">+91</span>
              <span className="phone-divider" aria-hidden="true" />
              <input
                id="mobile-number"
                inputMode="numeric"
                autoComplete="tel-national"
                type="tel"
                maxLength={10}
                value={phoneDigits}
                onChange={(event) => setPhoneDigits(event.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit number"
                aria-describedby="mobile-help"
                required
              />
              <Phone className="phone-icon" aria-hidden="true" />
            </div>
            <p id="mobile-help" className="field-help">Enter your 10-digit Indian mobile number.</p>
            {message && <p className="form-message" role="alert">{message}</p>}
            {error && <p className="form-message" role="alert">{error.message}</p>}
            <button className="primary-button" type="submit" disabled={!activeRound || isLoading}>
              {activeRound ? 'View available numbers' : isLoading ? 'Checking availability' : 'No open round'}
              {isLoading ? <RefreshCw className="spin-icon" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
            </button>
            <p className="no-otp-note"><LockKeyhole aria-hidden="true" /> No password or verification code required.</p>
          </form>}

          {step === 'slots' && <div className={`selection-panel${activeSelection.length > 0 ? ' has-selection' : ''}`}>
            <div className="selection-person"><span className="person-icon"><Phone aria-hidden="true" /></span><span><small>Booking as</small><strong>{formatMobile(mobile)}</strong></span><button type="button" className="text-button" onClick={() => void returnToPhone()} disabled={isWorking}>Change</button></div>
            <div className="slot-picker-heading">
              <div>
                <p className="slot-picker-eyebrow">NUMBER SELECTION</p>
                <h2 id="slot-picker-title">Choose up to {MAX_NUMBERS_PER_BOOKING}</h2>
              </div>
              <span className="availability-count" aria-live="polite" aria-atomic="true">{counts.available} open</span>
            </div>
            <p className="slot-picker-hint">Tap to hold for 1 minute; others see its countdown.</p>
            <div className="availability-summary" aria-label="Number availability legend">
              <span><i className="legend-dot available" />Available</span>
              <span><i className="legend-dot held" />Held · 1 min</span>
              <span><i className="legend-dot booked" />Booked</span>
              <span><i className="legend-dot paid" />Paid</span>
            </div>
            {message && <p className="form-message" role="alert">{message}</p>}
            <div className="number-grid" role="group" aria-labelledby="slot-picker-title" aria-busy={isWorking}>
              {visibleSlots.map((slot) => {
                const isSelected = activeSelection.includes(slot.slot_number)
                const isOwnHold = holdIsActive && heldSlotNumbers.includes(slot.slot_number)
                const slotExpiresAt = isOwnHold ? hold?.expiresAt : slot.hold_expires_at
                const slotRemaining = slotExpiresAt
                  ? Math.max(0, Math.ceil((new Date(slotExpiresAt).getTime() - now) / 1000))
                  : 0
                const slotDescription = isOwnHold
                  ? `selected, ${formatCountdown(slotRemaining)} remaining`
                  : slot.status === 'held'
                    ? `held, unlocks in ${formatCountdown(slotRemaining)}`
                    : slot.status
                return <button
                  key={slot.id}
                  type="button"
                  className={`number-tile tile-${slot.status}${isSelected ? ' is-selected' : ''}`}
                  disabled={(slot.status !== 'available' && !isOwnHold) || isWorking}
                  onClick={() => toggleSlot(slot)}
                  aria-label={`Number ${slot.slot_number}, ${slotDescription}`}
                  aria-pressed={isSelected}
                >
                  <span>{slot.slot_number}</span>
                  {(slot.status === 'held' || isOwnHold) && slotExpiresAt && <span className="tile-timer" aria-hidden="true">{formatCountdown(slotRemaining)}</span>}
                </button>
              })}
            </div>
            {visibleSlots.length === 0 && <div className="empty-slots"><CalendarClock aria-hidden="true" /><p>No numbers are configured for this round yet.</p></div>}
            {isWorking && <p className="subtle-status" role="status">Updating your temporary hold…</p>}
            <button type="button" className="back-link" onClick={() => void returnToPhone()} disabled={isWorking}><ArrowLeft aria-hidden="true" /> Back to mobile number</button>

            {activeSelection.length > 0 && <div className="selection-next-bar">
              <button type="button" className="primary-button selection-next-button" onClick={continueToDetails} disabled={isWorking}>
                {isWorking ? 'Holding numbers' : `Next · ${activeSelection.length} selected`}
                {isWorking ? <RefreshCw className="spin-icon" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
              </button>
            </div>}
          </div>}

          {step === 'name' && heldSlotNumbers.length > 0 && <form className="booking-form details-form" onSubmit={(event) => void confirmBooking(event)}>
            <div className="chosen-number"><span className="chosen-label">{heldSlotNumbers.length > 1 ? 'NUMBERS SELECTED' : 'NUMBER SELECTED'}</span><strong>{joinNumbers(heldSlotNumbers)}</strong><span className="hold-clock"><Clock3 aria-hidden="true" /> {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')} left to finish</span></div>
            <label htmlFor="customer-name">Your full name</label>
            <input className="text-input" id="customer-name" autoComplete="name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="As you’d like it listed" required />
            <p className="field-help">Your name and mobile will be shared with the round admin.</p>
            {message && <p className="form-message" role="alert">{message}</p>}
            <button className="primary-button" type="submit" disabled={isWorking || remainingSeconds <= 0 || name.trim().length < 2}>
              {isWorking ? 'Confirming booking' : 'Confirm my numbers'}
              {isWorking ? <RefreshCw className="spin-icon" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
            </button>
            <button type="button" className="back-link" onClick={() => { setSelectedSlotNumbers(heldSlotNumbers); setStep('slots'); setMessage('') }}><ArrowLeft aria-hidden="true" /> Choose different numbers</button>
          </form>}

        </section>
      </div>

      <footer className="site-footer">
        <span>PERSONAL INFO <span className="footer-divider">/</span> Token Booking</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <span>{activeRound ? `${counts.available} of ${data?.slots.length ?? 0} numbers available` : upcomingRound ? `Next round · ${formatDate(upcomingRound.opens_at)}` : 'Availability updates automatically'}</span>
          <a href="/terms" style={{ fontSize: 12, opacity: 0.7, textDecoration: 'underline' }}>Terms &amp; Conditions</a>
        </span>
      </footer>
    </main>
  )
}
