/**
 * Due-date pill. Port of DueDatePill in DesignSystem.swift.
 *
 * Amber normally, red once overdue. "Overdue" compares against the START OF
 * TODAY, not now - an item due today is never overdue, whatever the clock says.
 */

export function formatDue(date: Date, now: Date = new Date()): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round(
    (startOf(date).getTime() - startOf(now).getTime()) / 86_400_000,
  )
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function isOverdue(date: Date, now: Date = new Date()): boolean {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return date.getTime() < startOfToday.getTime()
}

export function DueDatePill({ date }: { date: Date }) {
  const overdue = isOverdue(date)
  const color = overdue ? 'var(--color-overdue)' : 'var(--color-due)'
  return (
    <span
      className="inline-flex shrink-0 items-center text-[11px] font-medium"
      style={{
        color,
        borderRadius: 'var(--radius-pill)',
        padding: '2px 8px',
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      {formatDue(date)}
    </span>
  )
}
