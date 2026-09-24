import { SkeletonLine, SkeletonAnnounce } from '@/components/ui/Skeleton'

/**
 * Mirrors the calendar's two panes so the agenda column does not jump when
 * the real one arrives.
 */
export default function LoadingCalendar() {
  return (
    <div className="flex h-full">
      <SkeletonAnnounce label="Loading calendar" />
      <aside
        className="flex shrink-0 flex-col"
        style={{ width: 'var(--agenda-width)', borderRight: '1px solid var(--color-hairline)' }}
      >
        <div className="px-3 py-3">
          <SkeletonLine width={120} height={16} />
        </div>
        <div className="mx-2 mb-2">
          <SkeletonLine height={28} />
        </div>
        <div className="mx-2 mb-2">
          <SkeletonLine height={30} />
        </div>
        <div className="px-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="mb-3">
              <SkeletonLine width="70%" height={13} />
              <SkeletonLine width="40%" height={11} className="mt-[6px]" />
            </div>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1 p-5">
        <SkeletonLine width={110} height={18} />
        <div className="mt-6 grid gap-2" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: 21 }, (_, i) => (
            <SkeletonLine key={i} height={i % 3 === 0 ? 38 : 22} />
          ))}
        </div>
      </div>
    </div>
  )
}
