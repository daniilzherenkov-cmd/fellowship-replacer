import { SkeletonLine, SkeletonAnnounce } from '@/components/ui/Skeleton'

export default function LoadingSettings() {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 'var(--note-max-width)', padding: 32 }}>
      <SkeletonAnnounce label="Loading settings" />
      <SkeletonLine width={130} height={24} />
      {Array.from({ length: 2 }, (_, i) => (
        <div
          key={i}
          className="mt-6 p-4"
          style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-card)' }}
        >
          <SkeletonLine width={170} height={16} />
          <SkeletonLine width="85%" height={12} className="mt-3" />
          <SkeletonLine width="60%" height={12} className="mt-2" />
          <SkeletonLine width={150} height={30} className="mt-4" />
        </div>
      ))}
    </div>
  )
}
