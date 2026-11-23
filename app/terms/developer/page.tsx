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
      <p style={{ fontSize: 14, color: '#666', marginBottom: 40 }}>Issued for the development of <strong>Personalinfo.in</strong></p>

      <p style={{ lineHeight: 1.75, color: '#333', marginBottom: 36 }}>
        Dear Client,<br /><br />
        Thank you for choosing <strong>Pixova Studio</strong> for the website development of <strong>Personalinfo.in</strong>.<br /><br />
        Before proceeding with the development, we would like to clarify the responsibilities of both parties to ensure transparency and avoid any misunderstandings in the future.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>1. Client Responsibilities</h2>
        <ul style={{ lineHeight: 1.85, color: '#333', paddingLeft: 20 }}>
          <li>The client is solely responsible for the legality and authenticity of all business information, content, images, products and services provided for publication on Personalinfo.in.</li>
          <li>The client is responsible for obtaining all necessary business licences, registrations, permissions and regulatory approvals.</li>
          <li>All business operations, transactions, customer interactions and activities conducted through the website are the responsibility of the website owner.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>2. Developer Responsibilities</h2>
        <ul style={{ lineHeight: 1.85, color: '#333', paddingLeft: 20 }}>
          <li>Pixova Studio is responsible for providing website design and development services according to the mutually agreed requirements.</li>
          <li>Pixova Studio does not own or operate the client&apos;s business.</li>
          <li>Pixova Studio does not independently verify or guarantee the legality of the client&apos;s business activities, products, services or supplied content.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>3. Limitation of Liability</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>Pixova Studio shall not be responsible for illegal, fraudulent, misleading or unauthorised activities independently conducted by the website owner or its users, provided Pixova Studio has not knowingly participated in, facilitated or contributed to such activities.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>4. Website Ownership &amp; Management</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>Upon project completion and agreed handover, the client is responsible for managing website content, business activities and user interactions, subject to any separately agreed hosting or maintenance services.</p>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>5. Acceptance</h2>
        <p style={{ lineHeight: 1.75, color: '#333' }}>By proceeding with the website development project, you acknowledge and agree to the responsibilities and conditions mentioned above.</p>
        <div style={{ marginTop: 20, padding: '16px 20px', background: '#f6faf7', borderLeft: '3px solid #54805e', borderRadius: 4 }}>
          <p style={{ fontSize: 14, color: '#333', fontStyle: 'italic', margin: 0 }}>&ldquo;I have read, understood and agree to the above terms and conditions.&rdquo;</p>
        </div>
      </section>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24, fontSize: 14, color: '#666' }}>
        <p style={{ marginBottom: 4 }}>Best regards,</p>
        <p style={{ fontWeight: 600, color: '#333', marginBottom: 2 }}>Pixova Studio</p>
        <p style={{ marginBottom: 4 }}>Website Design &amp; Development</p>
        <a href="https://pixova.co4.in" target="_blank" rel="noopener noreferrer" style={{ color: '#54805e' }}>pixova.co4.in</a>
      </div>
    </main>
  )
}
