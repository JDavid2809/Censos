import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies()

  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  // Sanitize trailing /rest/v1/ or slashes
  if (url.endsWith('/rest/v1/')) url = url.slice(0, -'/rest/v1/'.length)
  if (url.endsWith('/rest/v1')) url = url.slice(0, -'/rest/v1'.length)
  url = url.replace(/\/+$/, '')

  return createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  )
}
