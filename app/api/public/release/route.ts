import { NextRequest } from 'next/server'
import { allowPublicRequest, hashValue, isUuid, jsonError, normalizeIndianMobile } from '@/lib/server-utils'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Please try selecting those numbers again.', 400)
  }

  const mobile = normalizeIndianMobile(body.mobile)
  const roundId = body.roundId
  const token = body.token
  if (!mobile || !isUuid(roundId) || !isUuid(token)) {
    return jsonError('Your temporary selection could not be released. Please try again.', 400)
  }

  try {
    if (!(await allowPublicRequest(request, 'reserve', mobile))) {
      return jsonError('Too many attempts. Please wait a minute and try again.', 429)
    }

    const admin = createAdminClient()
    const { data, error } = await admin.rpc('release_number_holds', {
      p_round_id: roundId,
      p_mobile: mobile,
      p_token_hash: hashValue(token),
    })
    if (error) return jsonError('Your temporary selection could not be released. Please try again.', 400)

    return Response.json({ released: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return jsonError('Live availability is temporarily unavailable. Please try again.', 503)
  }
}
