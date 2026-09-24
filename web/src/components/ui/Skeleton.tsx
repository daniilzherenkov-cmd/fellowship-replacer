/**
 * Loading placeholders.
 *
 * WHY THESE EXIST: switching tabs took ~600ms with no visual response at all,
 * which reads as a dead click rather than a slow one. The work to make the
 * pages fast is done; this is about the gap between clicking and seeing,
 * where perceived speed is mostly about whether anything acknowledges you.
 *
 * Deliberately SHAPED like the page each one stands in for, not a centred
 * spinner: a skeleton that matches the real layout makes the swap to real
 * content almost invisible, whereas a spinner replaces one jarring moment
 * with two.
 *
 * Server components, so they cost nothing at runtime and stream instantly.
 */

export function SkeletonLine({
  width = '100%',
  height = 12,
  className = '',
}: {
  width?: string | number
  height?: number
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`block ${className}`}
      style={{
        width,
        height,
        borderRadius: 4,
        background: 'var(--color-hover)',
        animation: 'fellow-pulse 1.4s ease-in-out infinite',
      }}
    />
  )
}

export function SkeletonCircle({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="block shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: 'var(--color-hover)',
        animation: 'fellow-pulse 1.4s ease-in-out infinite',
      }}
    />
  )
}

/**
 * Announce loading once for the whole page.
 *
 * The skeleton itself is aria-hidden so a screen reader is not read a wall of
 * meaningless boxes; this is the single polite message instead.
 */
export function SkeletonAnnounce({ label }: { label: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {label}
    </span>
  )
}

/** A row of text lines with an avatar, the shape most lists here use. */
export function SkeletonRow({ avatar = true }: { avatar?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-2 py-2">
      {avatar && <SkeletonCircle />}
      <div className="min-w-0 flex-1">
        <SkeletonLine width="42%" height={13} />
        <SkeletonLine width="24%" height={11} className="mt-[6px]" />
      </div>
    </div>
  )
}

/**
 * NOTE ON WHERE THESE GO.
 *
 * Deliberately NOT on routes that can call notFound(): /meetings/[id] and
 * /people/[id]. A `loading.tsx` makes Next stream the response, which commits
 * HTTP 200 before the server component runs, so a meeting belonging to
 * someone else answered 200 instead of 404. No data leaked and the 404 page
 * still rendered, but the status code is part of the isolation contract and
 * the per-user test asserts it.
 *
 * Those pages load a single row and are fast, so the skeleton bought little.
 * The list pages, which were the actual ~600ms complaint, keep theirs.
 */
