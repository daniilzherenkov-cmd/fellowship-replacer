/**
 * Circular initials avatar. Port of AvatarView in DesignSystem.swift.
 *
 * Two details from the Swift original that are easy to lose:
 *  - the fill is `Color(hex:).gradient`, SwiftUI's automatic vertical
 *    light-to-dark ramp, not a flat colour;
 *  - initials are the first letter of the first two space-separated name parts,
 *    sized at 0.42 x the avatar (Models.swift:42).
 */

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
}

/** Lighten a hex colour by `amount` (0-1) for the gradient's top stop. */
function lighten(hex: string, amount: number): string {
  const raw = hex.replace('#', '')
  const num = parseInt(raw, 16)
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amount))
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount))
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount))
  return `rgb(${r} ${g} ${b})`
}

export function Avatar({
  name,
  colorHex = '#2563EB',
  size = 24,
  ring = false,
}: {
  name: string
  colorHex?: string
  size?: number
  /** Canvas-coloured ring, for overlapping attendee stacks. */
  ring?: boolean
}) {
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(to bottom, ${lighten(colorHex, 0.12)}, ${colorHex})`,
        boxShadow: ring ? '0 0 0 1.5px var(--color-canvas)' : undefined,
      }}
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white"
    >
      {initialsOf(name)}
    </span>
  )
}

/** Overlapping avatar row. Swift used HStack(spacing: -6) with a canvas ring. */
export function AvatarStack({
  people,
  size = 22,
  max = 3,
}: {
  people: { name: string; colorHex?: string }[]
  size?: number
  max?: number
}) {
  const shown = people.slice(0, max)
  const overflow = people.length - shown.length
  return (
    <span className="inline-flex items-center" style={{ gap: -6 }}>
      {shown.map((p, i) => (
        <span key={`${p.name}-${i}`} style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <Avatar name={p.name} colorHex={p.colorHex} size={size} ring />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="ml-1 text-[11px]"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          +{overflow}
        </span>
      )}
    </span>
  )
}
