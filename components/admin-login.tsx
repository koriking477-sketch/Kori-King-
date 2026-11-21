'use client'

import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'

type Props = { onAuthenticated: () => Promise<void>; initialNotice?: string }

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('email not confirmed')) return 'Check your inbox and confirm your email before signing in.'
  if (normalized.includes('rate limit') || normalized.includes('too many')) return 'Too many attempts. Wait a little and try again.'
  if (normalized.includes('invalid email')) return 'Enter a valid email address.'
  if (normalized.includes('invalid login') || normalized.includes('invalid credentials') || normalized.includes('user already registered')) return 'Invalid email or password.'
  return 'Something unexpected went wrong. Please try again.'
}

export function AdminLogin({ onAuthenticated, initialNotice = '' }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState(initialNotice)
  const [isError, setIsError] = useState(Boolean(initialNotice))
  const [isWorking, setIsWorking] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice('')
    setIsError(false)
    setIsWorking(true)

    try {
      // Sign in server-side so cookies are written into the HTTP response,
      // which is more reliable than writing to document.cookie from the browser.
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const payload = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok) {
        const msg = payload.error ?? 'Unexpected authentication error.'
        throw new Error(msg)
      }
      await onAuthenticated()
    } catch (cause) {
      setIsError(true)
      const message = cause instanceof Error ? cause.message : 'Unexpected authentication error.'
      setNotice(message)
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <main className="admin-login-shell">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <a className="brand-lockup" href="/" aria-label="Back to Personal Info booking">
          <BrandMark />
          <span className="brand-name">personal<span>info</span></span>
        </a>
        <p className="admin-eyebrow" style={{ marginTop: 30 }}>PRIVATE ADMIN ACCESS</p>
        <h1 id="admin-login-title" className="admin-login-title">Welcome back</h1>
        <p className="admin-login-subtitle">Sign in to manage booking rounds, customer records and settings.</p>
        {notice && <p className={isError ? 'admin-auth-error' : 'admin-auth-success'} role={isError ? 'alert' : 'status'}>{notice}</p>}
        <form className="admin-form" onSubmit={(event) => void submit(event)}>
          <div className="admin-field">
            <label htmlFor="admin-email">Admin email</label>
            <input id="admin-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required />
          </div>
          <div className="admin-field">
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" type="password" autoComplete="current-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" required />
          </div>
          <button className="admin-form-button" type="submit" disabled={isWorking}>
            {isWorking ? 'Please wait…' : 'Sign in securely'}
            {isWorking ? <LockKeyhole aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          </button>
        </form>
        <p className="admin-login-footer"><LockKeyhole aria-hidden="true" /> Only admin accounts registered in this project can sign in.</p>
        <a className="back-link" style={{ marginTop: 18 }} href="/"><ArrowLeft aria-hidden="true" /> Back to booking page</a>
      </section>
    </main>
  )
}
