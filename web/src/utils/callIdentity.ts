/**
 * Resolve which still / idle clip a demo or Studio-backed call should show.
 *
 * Seed dogs stay locked to their mode photo (`modes/murphy.jpg` tan folded-ear
 * huskita, `modes/riley.jpg` black huskita, `modes/both.jpg` together). Stale
 * localStorage publicPaths that point at another dog’s still are ignored.
 * User-attached photos/videos (IndexedDB blob) win once hydrated.
 */
import type { ClipSlot, ClipSourcePhoto, DogLibrary } from '../types/clipStudio'
import {
  CALL_MODES,
  callModeForName,
  defaultSourcePhotoForMode,
  modePhotoUrl,
  type CallMode,
} from '../data/callModes'
import { IDLE_CLIP_PATHS } from '../data/reactionCatalog'
import { publicAssetUrl } from '../lib/urls'
import type { DualFraming } from './focalPoint'

export interface IdentityStill {
  url: string
  publicPath?: string
  framing: DualFraming
  imageAspect?: number
}

export type IdlePlaybackPlan =
  | { kind: 'user-video'; urls: string[] }
  | { kind: 'still'; url: string }
  | { kind: 'placeholder'; urls: string[] }

export function isModeAssetPath(path?: string): boolean {
  if (!path) return false
  const normalized = path.replace(/^\//, '')
  return CALL_MODES.some((mode) => mode.photoPath === normalized)
}

export function expectedModePhotoPath(dogName?: string): string | undefined {
  return callModeForName(dogName)?.photoPath
}

export function isMismatchedModePhoto(
  publicPath: string | undefined,
  dogName?: string,
): boolean {
  if (!publicPath || !isModeAssetPath(publicPath)) return false
  const expected = expectedModePhotoPath(dogName)
  if (!expected) return false
  return publicPath.replace(/^\//, '') !== expected
}

/** IndexedDB keys for the dog-level clip-source portrait (`photo:generation:…`). */
export function isGenerationPhotoBlobKey(blobKey?: string): boolean {
  return Boolean(blobKey && blobKey.startsWith('photo:generation:'))
}

export function isUserAttachedPhoto(photo: ClipSourcePhoto | null | undefined): boolean {
  if (!photo) return false
  if (isGenerationPhotoBlobKey(photo.blobKey)) return false
  if (photo.blobKey) return true
  if (photo.publicPath && isModeAssetPath(photo.publicPath)) return false
  return Boolean(
    photo.url &&
      (photo.url.startsWith('blob:') ||
        photo.url.startsWith('data:') ||
        photo.url.startsWith('http://') ||
        photo.url.startsWith('https:')),
  )
}

/** Playback URL for a user-attached MP4. Ignores colored placeholder clips. */
export function userVideoPlaybackPath(slot: ClipSlot): string | undefined {
  const video = slot.resultVideo
  if (!video || video.origin !== 'user') return undefined
  if (video.objectUrl) return video.objectUrl
  if (video.path) return video.path
  return undefined
}

function displayUrlForPhoto(photo: ClipSourcePhoto): string {
  if (
    photo.url &&
    (photo.url.startsWith('blob:') ||
      photo.url.startsWith('data:') ||
      photo.url.startsWith('http://') ||
      photo.url.startsWith('https:'))
  ) {
    return photo.url
  }
  if (photo.publicPath) return publicAssetUrl(photo.publicPath)
  return photo.url
}

function stillFromMode(mode: CallMode): IdentityStill {
  return {
    url: modePhotoUrl(mode),
    publicPath: mode.photoPath,
    framing: structuredClone(mode.framing),
    imageAspect: mode.imageAspect,
  }
}

function stillFromPhoto(
  photo: ClipSourcePhoto,
  fallback: IdentityStill,
): IdentityStill {
  const url = displayUrlForPhoto(photo)
  if (!url) return fallback
  return {
    url,
    publicPath: photo.publicPath ?? fallback.publicPath,
    framing: structuredClone(photo.framing ?? fallback.framing),
    imageAspect: fallback.imageAspect,
  }
}

function idleSlots(dog?: DogLibrary | null): ClipSlot[] {
  if (!dog) return []
  return dog.intents.find((intent) => intent.id === 'idle')?.clipSlots ?? []
}

/**
 * Canonical FaceTime still for a dog. Never returns another seed dog’s
 * `modes/*.jpg`. User-uploaded stills (blob/data) are allowed once hydrated,
 * except the Studio **generation still** (clip source portrait) — that stays
 * off the home / demo picker and incoming avatar.
 */
export function identityStillForDog(
  dogName?: string,
  dog?: DogLibrary | null,
): IdentityStill | null {
  const mode = callModeForName(dogName) ?? callModeForName(dog?.name) ?? callModeForName(dog?.id)
  const fallback = mode ? stillFromMode(mode) : null
  const identityName = mode?.dogName ?? dogName ?? dog?.name

  const candidates: ClipSourcePhoto[] = []
  if (dog?.defaultPhoto) candidates.push(dog.defaultPhoto)
  for (const slot of idleSlots(dog)) {
    if (slot.sourcePhoto) candidates.push(slot.sourcePhoto)
  }

  for (const photo of candidates) {
    if (isGenerationPhotoBlobKey(photo.blobKey)) continue
    if (isMismatchedModePhoto(photo.publicPath, identityName)) continue
    if (!isUserAttachedPhoto(photo)) continue
    const url = displayUrlForPhoto(photo)
    if (!url) continue
    return stillFromPhoto(
      photo,
      fallback ?? {
        url,
        publicPath: photo.publicPath,
        framing: photo.framing,
      },
    )
  }

  return fallback
}

function playableIdleSlots(dog?: DogLibrary | null): ClipSlot[] {
  return idleSlots(dog).filter((slot) => slot.weight > 0)
}

/** Idle variants with a real attached MP4 (not the colored placeholder). */
export function attachedIdleSlots(dog?: DogLibrary | null): ClipSlot[] {
  return playableIdleSlots(dog).filter(
    (slot) =>
      slot.resultVideo?.origin === 'user' &&
      Boolean(userVideoPlaybackPath(slot) || slot.resultVideo.blobKey),
  )
}

/** Slot Mark picked as the looping FaceTime hold, or the first attached idle. */
export function chosenIdleSlot(dog?: DogLibrary | null): ClipSlot | undefined {
  const slots = playableIdleSlots(dog)
  if (slots.length === 0) return undefined
  const preferredId = dog?.preferredIdleSlotId
  const preferred = preferredId
    ? slots.find((slot) => slot.id === preferredId)
    : undefined
  if (preferred && (userVideoPlaybackPath(preferred) || preferred.resultVideo?.origin === 'user')) {
    return preferred
  }
  return (
    slots.find((slot) => userVideoPlaybackPath(slot)) ??
    slots.find((slot) => slot.resultVideo?.origin === 'user')
  )
}

export function userIdlePlaybackUrls(dog?: DogLibrary | null): string[] {
  const slots = playableIdleSlots(dog)
  const chosen = chosenIdleSlot(dog)
  const urls: string[] = []
  const primary = chosen ? userVideoPlaybackPath(chosen) : undefined
  if (primary) urls.push(primary)
  for (const slot of slots) {
    const path = userVideoPlaybackPath(slot)
    if (path && path !== primary) urls.push(path)
  }
  return urls
}

export function hasPendingChosenIdle(dog?: DogLibrary | null): boolean {
  const chosen = chosenIdleSlot(dog)
  if (!chosen || userVideoPlaybackPath(chosen)) return false
  return (
    chosen.resultVideo?.origin === 'user' && Boolean(chosen.resultVideo.blobKey)
  )
}

/**
 * Looping FaceTime hold: Mark's chosen/first attached idle MP4, else the
 * identity still. Placeholder slate-blue idle MP4s are last resort when
 * there is no still at all.
 */
export function resolveIdlePlayback(
  dogName?: string,
  dog?: DogLibrary | null,
  hasProfileStill = false,
): IdlePlaybackPlan {
  const userUrls = userIdlePlaybackUrls(dog)
  if (userUrls.length > 0) return { kind: 'user-video', urls: userUrls }

  const still = identityStillForDog(dogName, dog)
  if (still?.url || hasProfileStill || hasPendingChosenIdle(dog)) {
    return { kind: 'still', url: still?.url ?? '' }
  }

  return { kind: 'placeholder', urls: [...IDLE_CLIP_PATHS] }
}

/** Fix Murphy/Riley/Both seed stills that point at the wrong mode asset. */
export function repairSeedIdentityPhotos(dog: DogLibrary): DogLibrary {
  const mode =
    CALL_MODES.find(
      (item) =>
        item.id === dog.id || item.dogName.toLowerCase() === dog.name.toLowerCase(),
    ) ?? callModeForName(dog.name) ?? callModeForName(dog.id)
  if (!mode) return dog

  const expected = defaultSourcePhotoForMode(mode)
  const identityName = mode.dogName

  const repairPhoto = (
    photo: ClipSourcePhoto | null | undefined,
    slotId?: string,
  ): ClipSourcePhoto | null | undefined => {
    if (!photo) return photo
    if (!isMismatchedModePhoto(photo.publicPath, identityName)) return photo
    return {
      ...structuredClone(expected),
      id: slotId ? `${expected.id}-${slotId}` : expected.id,
    }
  }

  const defaultPhoto = repairPhoto(dog.defaultPhoto) ?? dog.defaultPhoto ?? structuredClone(expected)
  const avatarPath = isMismatchedModePhoto(dog.avatarPath, identityName)
    ? mode.photoPath
    : (dog.avatarPath ?? mode.photoPath)

  return {
    ...dog,
    defaultPhoto,
    avatarPath,
    intents: dog.intents.map((intent) => ({
      ...intent,
      clipSlots: intent.clipSlots.map((slot) => {
        const nextPhoto = repairPhoto(slot.sourcePhoto, slot.id)
        if (nextPhoto === slot.sourcePhoto) return slot
        return { ...slot, sourcePhoto: nextPhoto ?? null }
      }),
    })),
  }
}
