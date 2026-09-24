import { SkeletonLine, SkeletonRow, SkeletonAnnounce } from '@/components/ui/Skeleton'

/** Mirrors the Actions page: heading, tab strip, filter row, grouped items. */
export default function LoadingActions() {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 'var(--note-max-width)', padding: 32 }}>
      <SkeletonAnnounce label="Loading action items" />
      <SkeletonLine width={170} height={24} />
      <div className="mt-5 flex gap-4">
        <SkeletonLine width={80} height={14} />
        <SkeletonLine width={140} height={14} />
      </div>
      <div className="mt-5 flex gap-2">
        <SkeletonLine width={200} height={28} />
        <SkeletonLine width={110} height={28} />
        <SkeletonLine width={110} height={28} />
      </div>
      {Array.from({ length: 2 }, (_, group) => (
        <div key={group} className="mt-7">
          <SkeletonLine width={100} height={14} className="mb-2" />
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonRow key={i} avatar={false} />
          ))}
        </div>
      ))}
    </div>
  )
}
