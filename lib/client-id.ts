'use client'

// A stable per-browser identity for the anonymous push subscription. The push endpoint changes
// every time the user toggles notifications off and back on (and rotates on its own), so it
// can't be the key that ties a browser to its saved commute. This UUID is generated once, kept
// in localStorage, and sent with every /api/subscribe and /api/config call so the server can
// update the existing subscription row in place instead of inserting a new, unlinked one.

const STORAGE_KEY = 'transit-cue:client-id'

let cached: string | null = null

export function getClientId(): string {
  if (cached) return cached

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    cached = existing ?? crypto.randomUUID()
    if (!existing) window.localStorage.setItem(STORAGE_KEY, cached)
  } catch {
    // localStorage blocked (private mode, storage disabled): fall back to an id that lives only
    // for this page session. The app still works; it just can't recognise the browser after a
    // reload, and the orphaned row is cleaned up by 404/410 pruning on the next send.
    cached = cached ?? crypto.randomUUID()
  }

  return cached
}
