import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Developer Terms & Conditions — Pixova Studio',
}

export default function DeveloperTermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
      <Link href="/terms" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#54805e', textDecoration: 'none', marginBottom: 32 }}>
        <ArrowLeft size={15} aria-hidden="true" /> Back to Terms &amp; Conditions
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Developer Terms &amp; Conditions</h1>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>Pixova Studio · Website Design &amp; Development</p>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 40 }}>
        This page clarifies the role of Pixova Studio in relation to{' '}
        <a href="https://personalinfo-zeta.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: '#54805e' }}>personalinfo-zeta.vercel.app</a>.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>1. Role of Pixova Studio</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>
          Pixova Studio is a website design and development company. Our work for this project was limited to building and delivering the technical platform. We do not own, operate or manage this website or the business behind it.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>2. Website Ownership</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>
          This website is owned and operated independently by its registered owner. All business content, services, pricing, offers and communications on this platform are entirely the responsibility of the website owner, not Pixova Studio.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>3. Independent Operations</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>
          Pixova Studio has no involvement in the day-to-day operations, transactions or user interactions on this website. Any business decisions, promotions or activities carried out through this platform are made solely by the website owner.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>4. Content Responsibility</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>
          All content, images, descriptions and information displayed on this website were provided by the website owner. Pixova Studio does not independently verify or endorse any of this content.
        </p>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>5. Contact</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>
          For any queries about this website or its services, please contact the website owner directly. For enquiries about Pixova Studio&apos;s development services, visit{' '}
          <a href="https://pixova.co4.in" target="_blank" rel="noopener noreferrer" style={{ color: '#54805e' }}>pixova.co4.in</a>.
        </p>
      </section>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24, fontSize: 14, color: '#666' }}>
        <p style={{ fontWeight: 600, color: '#333', marginBottom: 2 }}>Pixova Studio</p>
        <p style={{ marginBottom: 4 }}>Website Design &amp; Development</p>
        <a href="https://pixova.co4.in" target="_blank" rel="noopener noreferrer" style={{ color: '#54805e' }}>pixova.co4.in</a>
      </div>
    </main>
  )
}
