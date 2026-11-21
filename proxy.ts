import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  const response = await updateSession(request)

  // For the admin HTML page, attach a cache-busting header so the browser
  // never serves it from the back/forward cache. The Cache-Control header in
  // next.config.mjs covers most cases; this ensures it also lands on the
  // initial navigation response coming through the proxy layer.
  const { pathname } = request.nextUrl
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
  }

  return response
}

export const config = {
  // Match /admin exactly and all sub-paths, plus the API and auth routes.
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*', '/api/auth/:path*', '/auth/:path*'],
}
