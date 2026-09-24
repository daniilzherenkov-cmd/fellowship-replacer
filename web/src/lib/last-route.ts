/**
 * Remembering the last screen.
 *
 * Fellow reopens where you left off. Landing on an empty "select a meeting"
 * pane after a reload, when you had a note open, reads as the app having
 * forgotten what you were doing.
 *
 * Stored per browser. Deliberately NOT server-side: it is a per-device
 * convenience, and syncing it would mean two tabs fighting over one value.
 */

export const LAST_ROUTE_KEY = 'fellow.last-route'

/**
 * Only same-origin app paths may be restored.
 *
 * The value goes straight into router.replace, so it is treated as untrusted
 * input even though this app wrote it. A protocol-relative "//evil.com" is a
 * valid-looking path that navigates off-site, which is why the check is for
 * a single leading slash rather than merely startsWith('/').
 */
export function isRestorableRoute(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false
  // No scheme, no backslash tricks, no fragment-only values.
  if (/[\\:]/.test(path)) return false
  // The root would bounce back through this same logic forever.
  if (path === '/') return false
  return /^\/(calendar|actions|people|meetings|settings)(\/|\?|$)/.test(path)
}

/**
 * Persist a route, validating it first.
 *
 * Exported so that code which edits the URL directly through
 * window.history.replaceState (the calendar's view and day, which must not
 * cost a server round trip) records the change too. Relying on the
 * usePathname/useSearchParams effect alone would silently drop those.
 */
export function rememberRoute(path: string): void {
  if (!isRestorableRoute(path)) return
  try {
    localStorage.setItem(LAST_ROUTE_KEY, path)
  } catch {
    // Blocked storage just means the next load starts at the calendar.
  }
}
