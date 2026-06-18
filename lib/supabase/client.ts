import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  // Sanitize trailing /rest/v1/ or slashes
  if (url.endsWith('/rest/v1/')) url = url.slice(0, -'/rest/v1/'.length)
  if (url.endsWith('/rest/v1')) url = url.slice(0, -'/rest/v1'.length)
  url = url.replace(/\/+$/, '')

  return createBrowserClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
