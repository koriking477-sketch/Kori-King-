import { AdminApp } from '@/components/admin-app'

// Never prerender or cache the admin shell: it must always be re-checked
// against the live session so the back button cannot reveal a stale dashboard.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Admin — Personal Info',
  description: 'Manage booking rounds, reservations and settings.',
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return <AdminApp />
}
