import type { CallMode } from '../data/callModes'
import { callModeForName, modePhotoUrl } from '../data/callModes'
import { identityStillForDog } from '../utils/callIdentity'
import { findDog, getStudioState } from '../utils/clipStudioStore'

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

/** Incoming / home face — identity still, never another dog’s seed photo. */
export function IdentityAvatar({
  dogName,
  url,
  className,
}: {
  dogName: string
  url?: string
  className?: string
}) {
  const mode = callModeForName(dogName)
  const still = identityStillForDog(dogName, findDog(getStudioState(), dogName))
  const src = still?.url ?? url ?? (mode ? modePhotoUrl(mode) : undefined)
  if (!src) return <span>🐾</span>
  const pos = still?.framing.portrait ?? mode?.framing.portrait
  return (
    <img
      src={src}
      alt={dogName}
      className={className}
      style={
        pos
          ? { objectPosition: `${pos.focalX * 100}% ${pos.focalY * 100}%` }
          : undefined
      }
    />
  )
}
