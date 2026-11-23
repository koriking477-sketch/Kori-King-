import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms & Conditions — Personal Info',
}

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#54805e', textDecoration: 'none', marginBottom: 32 }}>
        <ArrowLeft size={15} aria-hidden="true" /> Back to booking
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Terms &amp; Conditions</h1>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 40 }}>Last updated: November 2026 · <a href="https://personalinfo-zeta.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: '#54805e' }}>personalinfo-zeta.vercel.app</a></p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>1. Acceptance of Terms</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>By accessing or using this website, you agree to be bound by these terms and conditions. If you do not agree, please do not use the site.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>2. Booking &amp; Payments</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>All token bookings are subject to availability. Slots are held for a limited time after selection. The website owner reserves the right to cancel or modify rounds at any time.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>3. User Responsibilities</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>You are responsible for providing accurate information during booking. Any fraudulent, misleading or unauthorised use of this platform is strictly prohibited.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>4. Privacy</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>Your mobile number and name are collected solely for the purpose of this booking. They will not be shared with third parties without your consent.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>5. Limitation of Liability</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>personalinfo-zeta.vercel.app and its operators are not liable for any direct, indirect or consequential losses arising from the use of this service.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>6. Changes to Terms</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>We may update these terms at any time. Continued use of the site after changes constitutes acceptance of the revised terms.</p>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>7. Contact</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>For any questions regarding these terms, please contact the website owner through the booking page.</p>
      </section>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24, fontSize: 14, color: '#666' }}>
        <p>This website was developed by <a href="https://pixova.co4.in" target="_blank" rel="noopener noreferrer" style={{ color: '#54805e' }}>Pixova Studio</a>. For developer terms and responsibilities, see the <Link href="/terms/developer" style={{ color: '#54805e' }}>Developer Terms &amp; Conditions</Link>.</p>
      </div>
    </main>
  )
}
