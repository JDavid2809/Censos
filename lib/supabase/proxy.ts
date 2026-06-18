import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  // Sanitize trailing /rest/v1/ or slashes
  if (url.endsWith('/rest/v1/')) url = url.slice(0, -'/rest/v1/'.length)
  if (url.endsWith('/rest/v1')) url = url.slice(0, -'/rest/v1'.length)
  url = url.replace(/\/+$/, '')

  const supabase = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Wrap in try/catch: a network failure to Supabase must not crash the
  // middleware (and every page with it). If the check fails we allow the
  // request through; sessions are re-validated on the next successful call.
  let user = null
  try {
    const {
      data: { user: u },
    } = await supabase.auth.getUser()
    user = u
  } catch {
    // Network error — Supabase unreachable. Let the request continue.
    // /dashboard is still protected below as a safe fallback (cookie check).
  }

  if (
    // Protect /dashboard routes — redirect unauthenticated users to login
    request.nextUrl.pathname.startsWith('/dashboard') &&
    !user
  ) {
    // Only redirect if there are no auth cookies at all (avoids redirect loop
    // on transient network errors when the user IS logged in).
    const hasAuthCookie = request.cookies.getAll().some(
      (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    )
    if (!hasAuthCookie) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
