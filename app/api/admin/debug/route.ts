import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// TEMPORARY debug endpoint — remove after fixing admin login.
// Visit /api/admin/debug while signed in to see exactly what fails.
export async function GET(request: NextRequest) {
  const result: Record<string, unknown> = {}

  // Log all cookie names the server sees
  const cookieStore = await cookies()
  result.cookieNames = cookieStore.getAll().map((c) => c.name)

  try {
    const sessionClient = await createClient()
    const { data: { user }, error } = await sessionClient.auth.getUser()
    result.sessionError = error?.message ?? null
    result.userId = user?.id ?? null
    result.userEmail = user?.email ?? null
    result.emailConfirmedAt = user?.email_confirmed_at ?? null

    if (user) {
      const admin = createAdminClient()
      const { data: membership, error: membershipError } = await admin
        .from('admin_members')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      result.membershipError = membershipError?.message ?? null
      result.membershipFound = !!membership
    }
  } catch (e) {
    result.thrown = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
