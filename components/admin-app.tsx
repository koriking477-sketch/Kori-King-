'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import useSWR from 'swr'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clipboard,
  Clock3,
  FileText,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  LogOut,
  MessageCircle,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Shuffle,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { AdminLogin } from '@/components/admin-login'
import { BrandMark } from '@/components/brand-mark'
import { createClient } from '@/lib/supabase/client'
import type { AdminOverviewResponse, BookingRecord, BookingRound } from '@/lib/booking-types'

type AdminSection = 'overview' | 'bookings' | 'rounds' | 'random' | 'settings'
type BookingFilter = 'all' | 'held' | 'booked' | 'paid' | 'released'
type ApiError = Error & { status?: number }
type ApiPayload = {
  error?: string
  id?: string
  requiresRoundDeletion?: string
  bookings?: BookingRecord[]
}

/** Parses a response body without throwing when the server returns non-JSON. */
async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    return {} as T
  }
}

async function fetchAdminOverview(key: string) {
  const response = await fetch(key, { cache: 'no-store', credentials: 'same-origin' })
  const payload = await readJson<AdminOverviewResponse & { error?: string }>(response)
  if (!response.ok) {
    const error = new Error(payload.error ?? 'Could not load the admin workspace.') as ApiError
    error.status = response.status
    throw error
  }
  return payload
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function phoneLabel(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  return value
}

function whatsappChatUrl(value: string) {
  return `https://wa.me/${value.replace(/\D/g, '')}`
}

function stateTitle(state: BookingRecord['state']) {
  if (state === 'paid') return 'Paid'
  if (state === 'held') return 'On hold'
  if (state === 'released') return 'Released'
  return 'Unpaid'
}

async function createPdf(round: BookingRound, bookings: BookingRecord[]) {
  const { jsPDF } = await import('jspdf')
  const document = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14
  const pageWidth = document.internal.pageSize.getWidth()
  const rightEdge = pageWidth - margin
  const sorted = [...bookings]
    .filter((row) => row.state !== 'held' && Boolean(row.customer_name?.trim()))
    .sort((a, b) => a.slot_number - b.slot_number)

  function addPageHeader(isFirstPage: boolean) {
    document.setFillColor(35, 80, 59)
    document.rect(0, 0, pageWidth, isFirstPage ? 37 : 27, 'F')
    document.setTextColor(246, 249, 243)
    document.setFont('helvetica', 'bold')
    document.setFontSize(9)
    document.text('PERSONAL INFO', margin, 11)
    document.setFont('helvetica', 'normal')
    document.setFontSize(7)
    document.text('ROUND BOOKING REPORT', rightEdge, 11, { align: 'right' })
    document.setFont('helvetica', 'bold')
    document.setFontSize(isFirstPage ? 15 : 11)
    document.text(round.name, margin, isFirstPage ? 23 : 20)
    if (isFirstPage) {
      document.setFont('helvetica', 'normal')
      document.setFontSize(8)
      document.text(`${dateLabel(round.opens_at)} — ${dateLabel(round.closes_at)}`, margin, 31)
    }
    document.setTextColor(39, 59, 45)
  }

  function addTableHeader(y: number) {
    document.setFillColor(238, 243, 235)
    document.roundedRect(margin, y - 5, rightEdge - margin, 10, 1.5, 1.5, 'F')
    document.setFont('helvetica', 'bold')
    document.setFontSize(7)
    document.setTextColor(75, 99, 79)
    document.text('NO.', margin + 3, y + 1)
    document.text('NAME', margin + 22, y + 1)
    document.text('MOBILE', margin + 92, y + 1)
    document.text('STATUS', rightEdge - 3, y + 1, { align: 'right' })
    document.setTextColor(39, 59, 45)
    return y + 13
  }

  addPageHeader(true)
  const paidCount = sorted.filter((row) => row.state === 'paid').length
  const bookedCount = sorted.filter((row) => row.state === 'booked').length
  const releasedCount = sorted.filter((row) => row.state === 'released').length
  document.setFont('helvetica', 'normal')
  document.setFontSize(8)
  document.setTextColor(104, 120, 106)
  document.text(`${sorted.length} records    ·    ${bookedCount} unpaid    ·    ${paidCount} paid    ·    ${releasedCount} released`, margin, 47)
  document.setDrawColor(228, 234, 225)
  document.line(margin, 53, rightEdge, 53)

  let y = addTableHeader(62)
  document.setFont('helvetica', 'normal')
  document.setFontSize(8)
  for (const row of sorted) {
    if (y > 277) {
      document.addPage()
      addPageHeader(false)
      y = addTableHeader(36)
      document.setFont('helvetica', 'normal')
      document.setFontSize(8)
    }
    const nameLines = document.splitTextToSize(row.customer_name || 'Name not provided', 58).slice(0, 2)
    const mobileLines = document.splitTextToSize(phoneLabel(row.mobile), 47).slice(0, 2)
    const rowHeight = Math.max(11, Math.max(nameLines.length, mobileLines.length) * 4 + 4)
    if (row.slot_number % 2 === 0) {
      document.setFillColor(250, 251, 248)
      document.rect(margin, y - 5, rightEdge - margin, rowHeight, 'F')
    }
    document.setTextColor(40, 71, 49)
    document.setFont('helvetica', 'bold')
    document.text(String(row.slot_number), margin + 3, y + 1)
    document.setFont('helvetica', 'normal')
    document.setTextColor(69, 84, 71)
    document.text(nameLines, margin + 22, y + 1)
    document.text(mobileLines, margin + 92, y + 1)
    document.setFont('helvetica', 'bold')
    document.setFontSize(7)
    const statusColor = row.state === 'paid' ? [37, 139, 81] : row.state === 'held' ? [168, 114, 36] : [181, 76, 66]
    document.setTextColor(statusColor[0], statusColor[1], statusColor[2])
    document.text(stateTitle(row.state).toUpperCase(), rightEdge - 3, y + 1, { align: 'right' })
    document.setDrawColor(238, 241, 235)
    document.line(margin, y + rowHeight - 3, rightEdge, y + rowHeight - 3)
    y += rowHeight
    document.setFontSize(8)
  }

  document.setFont('helvetica', 'normal')
  document.setFontSize(7)
  document.setTextColor(142, 151, 142)
  document.text(`Generated ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, margin, 286)
  document.save(`${round.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-booking-report.pdf`)
}

const VALID_SECTIONS: AdminSection[] = ['overview', 'bookings', 'rounds', 'random', 'settings']
function hashToSection(hash: string): AdminSection {
  const val = hash.replace('#', '')
  return (VALID_SECTIONS.includes(val as AdminSection) ? val : 'overview') as AdminSection
}

export function AdminApp() {
  const [section, setSection] = useState<AdminSection>('overview')
  const [selectedRoundId, setSelectedRoundId] = useState('')
  const overviewKey = `/api/admin/overview${selectedRoundId ? `?roundId=${encodeURIComponent(selectedRoundId)}` : ''}`
  const { data, error, isLoading, mutate } = useSWR<AdminOverviewResponse, ApiError>(overviewKey, fetchAdminOverview, {
    refreshInterval: 12000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  })
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState(false)
  const [busyKey, setBusyKey] = useState('')
  const [deleteCandidate, setDeleteCandidate] = useState<BookingRound | null>(null)
  const [search, setSearch] = useState('')
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>('all')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [randomWinner, setRandomWinner] = useState<BookingRecord | null>(null)
  const [authNotice, setAuthNotice] = useState('')


  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('authError')) {
      setAuthNotice('That sign-in link is invalid or has expired. Sign in again.')
      window.history.replaceState(null, '', '/admin')
    }
  }, [])

  // Re-checks the session when a page is restored from the browser's back/forward
  // cache. If the session is gone, force a hard reload so the browser discards
  // the cached page entirely — the user must sign in again from scratch.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return
      // Hard reload forces the browser to re-request the page from the server,
      // which will return a fresh 401 and show the login screen. This prevents
      // any cached admin view from being visible even for a split second.
      window.location.reload()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  // If the session is revoked in another tab, drop straight back to sign-in.
  useEffect(() => {
    let client: ReturnType<typeof createClient>
    try {
      client = createClient()
    } catch {
      return
    }
    const { data: authListener } = client.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return
      void mutate().catch(() => undefined)
    })
    return () => authListener.subscription.unsubscribe()
  }, [mutate])

  const visibleBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return (data?.bookings ?? []).filter((booking) => {
      const matchesFilter = bookingFilter === 'all' || booking.state === bookingFilter
      const matchesSearch = !normalizedSearch
        || String(booking.slot_number).includes(normalizedSearch)
        || (booking.customer_name ?? '').toLowerCase().includes(normalizedSearch)
        || booking.mobile.toLowerCase().includes(normalizedSearch)
      return matchesFilter && matchesSearch
    })
  }, [bookingFilter, data?.bookings, search])

  if (error?.status === 401) {
    return <AdminLogin initialNotice={authNotice} onAuthenticated={async () => {
      // The /api/auth/signin route already verified admin membership and wrote
      // session cookies into the HTTP response. A hard reload picks them up.
      window.location.replace('/admin')
    }} />
  }

  if (error && error.status !== 401) {
    return <main className="admin-login-shell"><section className="admin-login-card">
      <a className="brand-lockup" href="/"><BrandMark /><span className="brand-name">personal<span>info</span></span></a>
      <h1 className="admin-login-title">Admin workspace unavailable</h1>
      <p className="admin-login-subtitle">The secure admin data service could not be reached. Check the project setup and retry.</p>
      <button className="admin-form-button" type="button" onClick={() => void mutate()}><RefreshCw aria-hidden="true" /> Try again</button>
      <a className="back-link" href="/"><ArrowLeft aria-hidden="true" /> Back to booking page</a>
    </section></main>
  }

  const rounds = data?.rounds ?? []
  const selectedRound = data?.selectedRound ?? null
  const deleteCandidateRound = deleteCandidate
    ? rounds.find((round) => round.id === deleteCandidate.id) ?? deleteCandidate
    : null
  const bookings = data?.bookings ?? []
  const capacity = selectedRound ? selectedRound.last_number - selectedRound.first_number + 1 : 0
  const heldCount = bookings.filter((row) => row.state === 'held').length
  const bookedCount = bookings.filter((row) => row.state === 'booked').length
  const paidCount = bookings.filter((row) => row.state === 'paid').length
  const activeReservationCount = heldCount + bookedCount + paidCount
  const submittedCount = bookedCount + paidCount
  const isRoundClosed = Boolean(selectedRound && new Date(selectedRound.closes_at).getTime() <= Date.now())

  async function performAction(key: string, url: string, method: string, body?: object) {
    setBusyKey(key)
    setActionMessage('')
    setActionError(false)
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      const payload = await readJson<ApiPayload>(response)
      if (!response.ok) throw new Error(payload.error ?? 'This action could not be completed.')
      setActionMessage('Changes saved.')
      await mutate()
    } catch (cause) {
      setActionError(true)
      setActionMessage(cause instanceof Error ? cause.message : 'This action could not be completed.')
      await mutate()
    } finally {
      setBusyKey('')
    }
  }

  async function copyBookings() {
    const text = visibleBookings
      .map((row) => `${row.slot_number} — ${row.customer_name || 'Name not provided'} — ${phoneLabel(row.mobile)} — ${stateTitle(row.state)}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setActionError(false)
      setActionMessage(`${visibleBookings.length} booking details copied.`)
    } catch {
      setActionError(true)
      setActionMessage('Clipboard access is unavailable in this browser.')
    }
  }

  async function downloadRoundReport(round: BookingRound) {
    setBusyKey(`report-${round.id}`)
    setActionMessage('')
    setActionError(false)
    try {
      let reportBookings = data?.selectedRound?.id === round.id ? data.bookings : null
      if (!reportBookings) {
        const response = await fetch(`/api/admin/overview?roundId=${encodeURIComponent(round.id)}`, { cache: 'no-store', credentials: 'same-origin' })
        const payload = await readJson<AdminOverviewResponse & { error?: string }>(response)
        if (!response.ok) throw new Error(payload.error ?? 'Could not load that round report.')
        reportBookings = payload.bookings ?? []
      }
      await createPdf(round, reportBookings ?? [])
      const trackingResponse = await fetch(`/api/admin/rounds/${round.id}/report-download`, { method: 'POST', credentials: 'same-origin' })
      const trackingPayload = await readJson<ApiPayload>(trackingResponse)
      if (!trackingResponse.ok) throw new Error(trackingPayload.error ?? 'The PDF was downloaded, but its saved status could not be recorded.')
      await mutate().catch(() => undefined)
      setActionError(false)
      setActionMessage('Report downloaded and its status saved.')
    } catch (cause) {
      setActionError(true)
      setActionMessage(cause instanceof Error ? cause.message : 'Could not create the report.')
    } finally {
      setBusyKey('')
    }
  }


  async function deleteRound(round: BookingRound) {
    if (!round.report_downloaded_at) {
      setActionError(true)
      setActionMessage('Download the round report before deleting this round.')
      return
    }
    setBusyKey(`delete-round-${round.id}`)
    setActionMessage('')
    setActionError(false)
    try {
      const response = await fetch(`/api/admin/rounds/${round.id}`, { method: 'DELETE', credentials: 'same-origin' })
      const payload = await readJson<ApiPayload>(response)
      if (!response.ok) throw new Error(payload.error ?? 'Could not delete this round.')
      setSelectedRoundId((current) => current === round.id ? '' : current)
      setDeleteCandidate(null)
      setActionMessage('The round, its numbers, bookings, and report status were deleted.')
      await mutate().catch(() => undefined)
    } catch (cause) {
      setActionError(true)
      setActionMessage(cause instanceof Error ? cause.message : 'Could not delete this round.')
    } finally {
      setBusyKey('')
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusyKey('password')
    setActionMessage('')
    setActionError(false)

    try {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user?.email) throw new Error('Your session expired. Sign in again to change your password.')

      // Require the current password so a hijacked session cannot silently
      // replace the admin's credentials.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (verifyError) throw new Error('Your current password is incorrect.')

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        throw new Error(updateError.message.toLowerCase().includes('weak')
          ? 'Choose a stronger password.'
          : 'Password could not be changed. Please try again.')
      }

      await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined)
      setCurrentPassword('')
      setNewPassword('')
      setActionMessage('Your password has been changed. Other sessions were signed out.')
    } catch (cause) {
      setActionError(true)
      setActionMessage(cause instanceof Error ? cause.message : 'Password could not be changed. Please try again.')
    } finally {
      setBusyKey('')
    }
  }

  async function signOutAdmin() {
    try {
      await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' })
    } catch {
      // Fall through to the client-side sign-out below.
    }
    try {
      await createClient().auth.signOut()
    } catch {
      // The server route already cleared the session cookies.
    }
    // A full navigation (instead of a soft update) guarantees the dashboard is
    // not left in the back/forward cache after signing out.
    window.location.replace('/admin')
  }

  async function pickRandomWinner() {
    const eligible = bookings.filter((row) => row.state === 'booked' || row.state === 'paid')
    if (!eligible.length) {
      setRandomWinner(null)
      setActionError(true)
      setActionMessage('There are no submitted bookings in this round yet.')
      return
    }
    setActionMessage('')
    setActionError(false)
    const random = new Uint32Array(1)
    window.crypto.getRandomValues(random)
    setRandomWinner(eligible[random[0] % eligible.length])
  }

  async function clearRound(round: BookingRound) {
    if (!round.report_downloaded_at) {
      setActionError(true)
      setActionMessage('Download the round report before clearing its records.')
      return
    }
    if (!window.confirm(`Clear every booking record and archive “${round.name}”? This cannot be undone.`)) return
    await performAction(`reset-${round.id}`, `/api/admin/rounds/${round.id}/reset`, 'POST')
  }

  const sections: { id: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'bookings', label: 'Bookings', icon: ListFilter },
    { id: 'rounds', label: 'Rounds', icon: CalendarDays },
    { id: 'random', label: 'Random draw', icon: Shuffle },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ]

  // Keep section in sync with the browser back/forward buttons.
  useEffect(() => {
    // Read initial hash on mount — do NOT push to history, just set state.
    const initial = hashToSection(window.location.hash)
    if (initial !== 'overview') setSection(initial)

    function onPopState() {
      setSection(hashToSection(window.location.hash))
      setActionMessage('')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function selectSection(next: AdminSection) {
    setSection(next)
    setActionMessage('')
    // Use replaceState for overview (the default), pushState for all others
    // so the back button skips straight past overview back to wherever the
    // user came from, rather than bouncing between overview and overview.
    if (next === 'overview') {
      window.history.replaceState(null, '', '/admin')
    } else {
      window.history.pushState(null, '', `/admin#${next}`)
    }
  }

  if (isLoading && !data) {
    return <main className="admin-login-shell"><section className="admin-login-card"><p className="admin-eyebrow">PERSONAL INFO ADMIN</p><h1 className="admin-login-title">Loading workspace</h1><p className="admin-login-subtitle">Checking your secure session…</p></section></main>
  }

  return <main className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/">
        <BrandMark />
        <span className="admin-brand-name"><strong>personalinfo</strong><small>BOOKING ADMIN</small></span>
      </a>
      <p className="admin-nav-label">Workspace</p>
      <nav className="admin-nav" aria-label="Admin sections">
        {sections.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={section === id ? 'active' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => selectSection(id)}><Icon aria-hidden="true" />{label}</button>)}
      </nav>
      <div className="admin-sidebar-bottom">
        <p>Current round · {selectedRound?.name ?? 'Not created'}</p>
        <a href="/"><ArrowLeft aria-hidden="true" /> View booking page</a>
      </div>
    </aside>

    <section className="admin-main">
      <header className="admin-topbar">
        <div className="admin-breadcrumb"><span>Workspace</span><ArrowRight aria-hidden="true" /><strong>{sections.find((item) => item.id === section)?.label}</strong></div>
        <div className="admin-top-actions"><span className="live-pill is-connected" role="status" aria-live="polite" title="Bookings refresh automatically every 12 seconds."><i aria-hidden="true" />Auto-refresh on</span><span className="admin-avatar" role="img" aria-label="Administrator">A</span><button type="button" className="row-action" onClick={() => void signOutAdmin()}><LogOut aria-hidden="true" /> Sign out</button></div>
      </header>

      <div className="admin-content">
        <div className="admin-page-heading">
          <div><p className="admin-eyebrow">PERSONAL INFO / ADMIN</p><h1>{section === 'overview' ? 'Booking overview' : sections.find((item) => item.id === section)?.label}</h1><p>{selectedRound ? `${selectedRound.name} · ${dateLabel(selectedRound.opens_at)} — ${dateLabel(selectedRound.closes_at)}` : 'Create a round to begin accepting bookings.'}</p></div>
          {rounds.length > 0 && <div className="admin-field" style={{ minWidth: 185 }}><label htmlFor="round-selector">Active round</label><select id="round-selector" value={selectedRound?.id ?? ''} onChange={(event) => { setSelectedRoundId(event.target.value); setRandomWinner(null) }}>{rounds.map((round) => <option key={round.id} value={round.id}>{round.name} · {round.status}</option>)}</select></div>}
        </div>

        {actionMessage && <div className={`admin-alert ${actionError ? '' : 'success'}`} role={actionError ? 'alert' : 'status'}>{actionMessage}</div>}

        {section === 'overview' && <>
          <div className="admin-stats">
            <StatCard label="Numbers in this round" value={capacity} note={selectedRound ? `${selectedRound.first_number} to ${selectedRound.last_number}` : 'No round yet'} icon={<UsersRound aria-hidden="true" />} />
            <StatCard label="Available" value={Math.max(0, capacity - activeReservationCount)} note="Ready to reserve" icon={<Check aria-hidden="true" />} />
            <StatCard label="Unpaid" value={bookedCount} note={`${paidCount} paid`} icon={<CalendarDays aria-hidden="true" />} />
            <StatCard label="On hold" value={heldCount} note="Auto-releases after 1 minute" icon={<Clock3 aria-hidden="true" />} />
          </div>
          <section className="admin-panel">
            <div className="admin-panel-heading"><div className="panel-heading-copy"><h2>Latest bookings</h2><p>New reservations appear here live</p></div><button className="panel-action" type="button" onClick={() => selectSection('bookings')}>View all <ArrowRight aria-hidden="true" /></button></div>
            {bookings.length ? <BookingTable bookings={bookings.slice(0, 7)} busyKey={busyKey} onAction={performAction} /> : <EmptyState title="No bookings in this round yet" body="Once a customer reserves a number, it will appear here automatically." />}
          </section>
        </>}

        {section === 'bookings' && <section className="admin-panel">
          <div className="admin-panel-heading"><div className="panel-heading-copy"><h2>Customer bookings</h2><p>{visibleBookings.length} records in {selectedRound?.name ?? 'this round'}</p></div><div className="booking-toolbar">
            <label className="search-control"><Search aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, mobile, number" aria-label="Search bookings" /></label>
            <select className="filter-select" aria-label="Filter by booking status" value={bookingFilter} onChange={(event) => setBookingFilter(event.target.value as BookingFilter)}><option value="all">All statuses</option><option value="held">On hold</option><option value="booked">Unpaid</option><option value="paid">Paid</option><option value="released">Released</option></select>
            <button className="row-action" type="button" onClick={() => void copyBookings()} disabled={!visibleBookings.length}><Clipboard aria-hidden="true" /> Copy list</button>
            <button className="row-action" type="button" onClick={() => selectedRound && void downloadRoundReport(selectedRound)} disabled={!selectedRound || busyKey.startsWith('report-')}><ArrowDownToLine aria-hidden="true" /> PDF</button>
          </div></div>
          {visibleBookings.length ? <BookingTable bookings={visibleBookings} busyKey={busyKey} onAction={performAction} /> : <EmptyState title={bookings.length ? 'No bookings match your search' : 'No customer bookings yet'} body="When someone confirms a number, their details will appear in this list." />}
        </section>}

        {section === 'rounds' && <div className="admin-grid-two">
          <section className="admin-card"><h2>Create a new round</h2><p>Set a name, number range and opening window. Numbers are generated automatically.</p>
            <form className="admin-form" onSubmit={(e) => { e.preventDefault(); void (async () => {
              const form = e.currentTarget
              const data = new FormData(form)
              const name = (data.get('roundName') as string).trim()
              const first = parseInt(data.get('firstNumber') as string, 10)
              const last = parseInt(data.get('lastNumber') as string, 10)
              const opensAt = data.get('opensAt') as string
              const closesAt = data.get('closesAt') as string
              await performAction('create-round', '/api/admin/rounds', 'POST', {
                name, firstNumber: first, lastNumber: last,
                opensAt: new Date(opensAt).toISOString(),
                closesAt: new Date(closesAt).toISOString(),
              })
              form.reset()
              await mutate()
            })() }}>
              <div className="admin-field"><label>Round name</label><input name="roundName" type="text" placeholder="e.g. Round 1" maxLength={80} required /></div>
              <div className="admin-field"><label>First number</label><input name="firstNumber" type="number" min={1} max={9999} required /></div>
              <div className="admin-field"><label>Last number</label><input name="lastNumber" type="number" min={1} max={9999} required /></div>
              <div className="admin-field"><label>Opens at</label><input name="opensAt" type="datetime-local" required /></div>
              <div className="admin-field"><label>Closes at</label><input name="closesAt" type="datetime-local" required /></div>
              <button className="admin-form-button" type="submit" disabled={busyKey === 'create-round'}>Create round</button>
            </form>
          </section>
          <section className="admin-card"><h2>Round history</h2><p>Open any round to review its bookings. Delete permanently removes its numbers, booking records, and saved report status.</p>
            {rounds.length ? <div className="admin-round-list">{rounds.map((round) => {
              const expired = new Date(round.closes_at).getTime() <= Date.now()
              return <div className="admin-round-item" key={round.id}>
                <div><strong>{round.name}</strong><small>{round.first_number}–{round.last_number} · {dateLabel(round.opens_at)}</small></div>
                <div className="admin-round-right"><span className={`state-badge ${round.status === 'open' ? 'available' : 'held'}`}>{round.status}</span><div className="admin-round-actions">
                  <button className="row-action" type="button" onClick={() => { setSelectedRoundId(round.id); selectSection('bookings') }}>View</button>
                  {expired && <button className="row-action" type="button" onClick={() => void downloadRoundReport(round)} disabled={busyKey === `report-${round.id}`}><ArrowDownToLine aria-hidden="true" /> Report</button>}
                  {round.report_downloaded_at && <button className="row-action delete-action" type="button" onClick={() => void clearRound(round)} disabled={busyKey === `reset-${round.id}`}><Trash2 aria-hidden="true" /> Clear data</button>}
                  <button className="row-action delete-action" type="button" onClick={() => { setActionMessage(''); setActionError(false); setDeleteCandidate(round) }} disabled={busyKey === `delete-round-${round.id}`} aria-label={`Delete round ${round.name} and all its booking records`}><Trash2 aria-hidden="true" /> Delete</button>
                </div></div>
              </div>
            })}</div> : <EmptyState title="No rounds yet" body="Create a round above to get started." />}
          </section>
        </div>}

        {section === 'random' && <div className="admin-grid-two">
          <section className="admin-random-card">
            <p className="admin-eyebrow">RANDOM DRAW / {selectedRound?.name ?? 'NO ROUND'}</p>
            {randomWinner ? <><span className="random-number">{randomWinner.slot_number}</span><p className="random-name">{randomWinner.customer_name || 'Name not provided'}</p><p className="random-mobile">{phoneLabel(randomWinner.mobile)} · {stateTitle(randomWinner.state)}</p></> : <><Shuffle aria-hidden="true" style={{ width: 24, height: 24, color: '#7b987f' }} /><p className="random-name" style={{ marginTop: 14 }}>A fair draw from confirmed bookings</p><p className="random-mobile">Booked and paid numbers are eligible.</p></>}
            <button className="admin-form-button" type="button" onClick={() => void pickRandomWinner()} disabled={submittedCount === 0}><Shuffle aria-hidden="true" /> Pick a number</button>
            {selectedRound && <p className="admin-login-footer">{submittedCount} eligible booking{submittedCount === 1 ? '' : 's'} in this round</p>}
          </section>
          <section className="admin-card"><h2>How the draw works</h2><p>The draw uses only numbers with a confirmed booking or payment. Open holds and available numbers are excluded.</p><div className="admin-round-list"><div className="admin-round-item"><div><strong>Cryptographically secure randomness</strong><small>Generated in your browser with the Web Crypto API.</small></div><ShieldCheck aria-hidden="true" style={{ width: 17, height: 17, color: '#54805e' }} /></div><div className="admin-round-item"><div><strong>One result at a time</strong><small>Pick again to draw another eligible booking.</small></div><RefreshCw aria-hidden="true" style={{ width: 15, height: 15, color: '#809184' }} /></div></div></section>
        </div>}

        {section === 'settings' && <div className="admin-grid-two">
          <section className="admin-card"><h2>Change your password</h2><p>Update the password for your current admin account.</p>
            <form className="admin-form" onSubmit={(event) => void changePassword(event)}><div className="admin-field"><label htmlFor="current-admin-password">Current password</label><input id="current-admin-password" type="password" autoComplete="current-password" maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Confirm it is you" required /></div><div className="admin-field"><label htmlFor="new-admin-password">New password</label><input id="new-admin-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" required /></div><button className="admin-form-button" type="submit" disabled={busyKey === 'password'}>{busyKey === 'password' ? 'Updating…' : 'Change password'}<LockKeyhole aria-hidden="true" /></button></form>
          </section>
          <section className="admin-card"><h2>Round reports</h2><p>Each PDF contains named bookings with their selected numbers, mobile numbers, statuses, and round schedule. Temporary holds and records without a name are omitted. Clearing a round permanently deletes its customer records.</p>
            {selectedRound ? <div className="admin-form"><button className="admin-form-button secondary" type="button" onClick={() => void downloadRoundReport(selectedRound)} disabled={busyKey === `report-${selectedRound.id}`}><FileText aria-hidden="true" /> Download current report</button>{isRoundClosed && selectedRound.report_downloaded_at && <button className="admin-form-button danger" type="button" onClick={() => void clearRound(selectedRound)}><Trash2 aria-hidden="true" /> Clear records and archive</button>}</div> : <p>Create a round before downloading a report.</p>}
          </section>
        </div>}
      </div>

      <nav className="admin-tabbar" aria-label="Admin sections">
        {sections.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={section === id ? 'active' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => selectSection(id)}><Icon aria-hidden="true" /><span>{label}</span></button>)}
      </nav>
      <RoundDeleteDialog
        round={deleteCandidateRound}
        busyKey={busyKey}
        actionMessage={actionMessage}
        actionError={actionError}
        onClose={() => setDeleteCandidate(null)}
        onDownload={(round) => void downloadRoundReport(round)}
        onDelete={(round) => void deleteRound(round)}
      />
    </section>
  </main>
}

function RoundDeleteDialog({
  round,
  busyKey,
  actionMessage,
  actionError,
  onClose,
  onDownload,
  onDelete,
}: {
  round: BookingRound | null
  busyKey: string
  actionMessage: string
  actionError: boolean
  onClose: () => void
  onDownload: (round: BookingRound) => void
  onDelete: (round: BookingRound) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (round && !dialog.open) dialog.showModal()
    if (!round && dialog.open) dialog.close()
  }, [round])

  return <dialog
    ref={dialogRef}
    className="round-delete-dialog"
    aria-labelledby="round-delete-title"
    aria-describedby="round-delete-description"
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
  >
    {round && <>
      <div className="round-delete-dialog-heading">
        <div>
          <p className="admin-eyebrow">Round cleanup</p>
          <h2 id="round-delete-title">Delete {round.name}?</h2>
        </div>
        <button className="round-delete-close" type="button" onClick={onClose} aria-label="Close deletion dialog"><X aria-hidden="true" /></button>
      </div>
      <p className="round-delete-description" id="round-delete-description">Deleting permanently removes this round, all its numbers and booking records, and its saved report-download status. This cannot be undone.</p>
      {round.report_downloaded_at
        ? <p className="round-delete-status" role="status">Report downloaded {dateLabel(round.report_downloaded_at)}. Its saved status will be deleted with the round.</p>
        : <p className="round-delete-status" role="status">Download the report to enable deleting this round.</p>}
      {actionMessage && <p className={actionError ? 'round-delete-error' : 'round-delete-status'} role={actionError ? 'alert' : 'status'}>{actionMessage}</p>}
      <div className="round-delete-actions">
        {!round.report_downloaded_at && <button className="admin-form-button secondary" type="button" onClick={() => onDownload(round)} disabled={busyKey === `report-${round.id}` || busyKey === `delete-round-${round.id}`}><FileText aria-hidden="true" /> {busyKey === `report-${round.id}` ? 'Preparing report…' : 'Download report'}</button>}
        <button className="admin-form-button danger" type="button" onClick={() => onDelete(round)} disabled={!round.report_downloaded_at || busyKey === `delete-round-${round.id}` || busyKey === `report-${round.id}`}><Trash2 aria-hidden="true" /> {busyKey === `delete-round-${round.id}` ? 'Deleting…' : 'Delete round'}</button>
      </div>
    </>}
  </dialog>
}

function StatCard({ label, value, note, icon }: { label: string; value: number; note: string; icon: ReactNode }) {
  return <div className="admin-stat-card"><div className="admin-stat-top"><span>{label}</span><i>{icon}</i></div><strong>{value.toLocaleString('en-IN')}</strong><small>{note}</small></div>
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="admin-empty"><CalendarDays aria-hidden="true" /><strong>{title}</strong><p>{body}</p></div>
}

function BookingTable({ bookings, busyKey, onAction }: { bookings: BookingRecord[]; busyKey: string; onAction: (key: string, url: string, method: string, body?: object) => Promise<void> }) {
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>NUMBER</th><th>CUSTOMER</th><th>STATUS</th><th>BOOKED</th><th>ACTIONS</th></tr></thead><tbody>
    {bookings.map((booking) => <tr key={booking.id}>
      <td className="table-number">{booking.slot_number}</td>
      <td><span className="table-person"><strong>{booking.customer_name || 'Name not provided'}</strong><small>{phoneLabel(booking.mobile)}</small></span></td>
      <td><span className={`state-badge ${booking.state}`}>{stateTitle(booking.state)}</span></td>
      <td>{booking.booked_at ? dateLabel(booking.booked_at) : booking.expires_at ? `Until ${dateLabel(booking.expires_at)}` : dateLabel(booking.created_at)}</td>
      <td><span className="row-actions">
        {booking.state === 'booked' && <a className="row-action whatsapp-action" href={whatsappChatUrl(booking.mobile)} target="_blank" rel="noreferrer" aria-label={`Open WhatsApp chat with ${booking.customer_name || phoneLabel(booking.mobile)}`} title="Open WhatsApp chat to verify payment"><MessageCircle aria-hidden="true" /> WhatsApp</a>}
        {booking.state === 'booked' && <button type="button" className="row-action paid-action" disabled={busyKey === `paid-${booking.id}`} onClick={() => void onAction(`paid-${booking.id}`, `/api/admin/bookings/${booking.id}`, 'PATCH', { state: 'paid' })}><Check aria-hidden="true" /> Mark paid</button>}
        {(booking.state === 'held' || booking.state === 'booked' || booking.state === 'paid') && <button type="button" className="row-action release-action" disabled={busyKey === `release-${booking.id}`} onClick={() => void onAction(`release-${booking.id}`, `/api/admin/bookings/${booking.id}`, 'PATCH', { state: 'released' })}><X aria-hidden="true" /> Release</button>}
        <button type="button" className="row-action delete-action" aria-label={`Delete booking for number ${booking.slot_number}`} disabled={busyKey === `delete-${booking.id}`} onClick={() => { if (window.confirm(`Permanently delete the booking for number ${booking.slot_number}?`)) void onAction(`delete-${booking.id}`, `/api/admin/bookings/${booking.id}`, 'DELETE') }}><Trash2 aria-hidden="true" /></button>
      </span></td>
    </tr>)}
  </tbody></table></div>
}
