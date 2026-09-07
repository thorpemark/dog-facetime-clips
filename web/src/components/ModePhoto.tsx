import type { CallMode } from '../data/callModes'
import { modePhotoUrl } from '../data/callModes'

export function ModePhoto({
  mode,
  alt,
  className,
}: {
  mode: CallMode
  alt?: string
  className?: string
}) {
  const { focalX, focalY } = mode.framing.portrait
  return (
    <img
      src={modePhotoUrl(mode)}
      alt={alt ?? mode.name}
      className={className}
      style={{ objectPosition: `${focalX * 100}% ${focalY * 100}%` }}
    />
  )
}
