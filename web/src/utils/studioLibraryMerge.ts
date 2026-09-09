import type {
  ClipResultVideo,
  ClipSlot,
  ClipSourcePhoto,
  ClipStudioState,
  DogLibrary,
  IntentBucket,
} from '../types/clipStudio'
import { fullImageDualFraming } from './focalPoint'
import { attachedIdleSlots, chosenIdleSlot } from './callIdentity'
import { migrateStudioState, withDerivedStatus } from './clipStudioStore'

function clone<T>(value: T): T {
  return structuredClone(value)
}

export function isStudioVideoBlobKey(key?: string): boolean {
  return Boolean(key && key.startsWith('video:'))
}

export function isStudioPhotoBlobKey(key?: string): boolean {
  return Boolean(key && key.startsWith('photo:'))
}

export function isStudioMediaBlobKey(key?: string): boolean {
  return isStudioVideoBlobKey(key) || isStudioPhotoBlobKey(key)
}

export function slotIdFromVideoBlobKey(key: string): string | null {
  if (!isStudioVideoBlobKey(key)) return null
  return key.slice('video:'.length) || null
}

export function slotIdFromPhotoBlobKey(key: string): string | null {
  if (!key.startsWith('photo:') || key.startsWith('photo:generation:')) return null
  return key.slice('photo:'.length) || null
}

function isPlaceholderClipPath(path?: string): boolean {
  if (!path) return false
  const normalized = path.replace(/^\//, '')
  return normalized.startsWith('clips/')
}

function videoIsUser(video: ClipResultVideo | null | undefined): boolean {
  if (!video) return false
  if (video.origin === 'user') return true
  if (isStudioVideoBlobKey(video.blobKey)) return true
  if (video.storagePath) return true
  return false
}

function slotHasUserVideo(slot: ClipSlot | undefined): boolean {
  const video = slot?.resultVideo
  if (!video || !videoIsUser(video)) return false
  return Boolean(video.blobKey || video.objectUrl || video.storagePath || (video.path && !isPlaceholderClipPath(video.path)))
}

function asUserVideo(video: ClipResultVideo, blobKey?: string): ClipResultVideo {
  const key = blobKey || video.blobKey
  const path = isPlaceholderClipPath(video.path) ? undefined : video.path
  return {
    ...video,
    blobKey: key,
    path,
    origin: 'user',
  }
}

function photoRank(photo: ClipSourcePhoto | null | undefined): number {
  if (!photo) return 0
  if (photo.blobKey) return 3
  if (
    photo.url &&
    (photo.url.startsWith('blob:') ||
      photo.url.startsWith('data:') ||
      photo.url.startsWith('http://') ||
      photo.url.startsWith('https://'))
  ) {
    return 2
  }
  if (photo.publicPath) return 1
  return 0
}

export function countUserAttachedVideos(state: ClipStudioState): number {
  let count = 0
  for (const dog of state.dogs) {
    for (const intent of dog.intents) {
      for (const slot of intent.clipSlots) {
        if (slotHasUserVideo(slot)) count += 1
      }
    }
  }
  return count
}

export function collectStudioBlobKeys(state: ClipStudioState): string[] {
  const keys = new Set<string>()
  const add = (key?: string) => {
    if (key) keys.add(key)
  }
  for (const dog of state.dogs) {
    add(dog.defaultPhoto?.blobKey)
    add(dog.generationPhoto?.blobKey)
    for (const intent of dog.intents) {
      for (const slot of intent.clipSlots) {
        add(slot.sourcePhoto?.blobKey)
        if (videoIsUser(slot.resultVideo) || isStudioVideoBlobKey(slot.resultVideo?.blobKey)) {
          add(slot.resultVideo?.blobKey)
        }
      }
    }
  }
  return [...keys]
}

export function countLocalVideoBlobKeys(localKeys: Iterable<string>): number {
  let count = 0
  for (const key of localKeys) {
    if (isStudioVideoBlobKey(key)) count += 1
  }
  return count
}

function findSlot(state: ClipStudioState, slotId: string): ClipSlot | undefined {
  for (const dog of state.dogs) {
    for (const intent of dog.intents) {
      const slot = intent.clipSlots.find((item) => item.id === slotId)
      if (slot) return slot
    }
  }
  return undefined
}

function withDerivedSlots(state: ClipStudioState): ClipStudioState {
  return {
    ...state,
    dogs: state.dogs.map((dog) => ({
      ...dog,
      intents: dog.intents.map((intent) => ({
        ...intent,
        clipSlots: intent.clipSlots.map((slot) => withDerivedStatus(slot)),
      })),
    })),
  }
}

/**
 * Reattach IndexedDB `video:` / `photo:` blobs onto matching clip slots when
 * cloud/local JSON was overwritten by a seed library (phone-first sync).
 */
export function adoptLocalStudioBlobs(
  state: ClipStudioState,
  localKeys: Iterable<string>,
): ClipStudioState {
  const keys = [...new Set(localKeys)].filter(isStudioMediaBlobKey)
  if (keys.length === 0) return state
  const next = clone(state)

  for (const key of keys) {
    const videoSlotId = slotIdFromVideoBlobKey(key)
    if (videoSlotId) {
      const slot = findSlot(next, videoSlotId)
      if (!slot) continue
      slot.resultVideo = asUserVideo(slot.resultVideo ?? { origin: 'user' }, key)
      continue
    }

    if (key.startsWith('photo:generation:')) {
      const rest = key.slice('photo:generation:'.length)
      const dogId = rest.split(':')[0]
      const dog = next.dogs.find((item) => item.id === dogId || item.name.toLowerCase() === dogId)
      if (!dog) continue
      if (dog.generationPhoto?.blobKey && dog.generationPhoto.blobKey !== key) continue
      dog.generationPhoto = {
        id: dog.generationPhoto?.id ?? rest,
        url: dog.generationPhoto?.url ?? '',
        blobKey: key,
        publicPath: dog.generationPhoto?.publicPath,
        storagePath: dog.generationPhoto?.storagePath,
        framing: dog.generationPhoto?.framing ?? fullImageDualFraming(),
      }
      continue
    }

    const photoSlotId = slotIdFromPhotoBlobKey(key)
    if (!photoSlotId) continue
    const slot = findSlot(next, photoSlotId)
    if (!slot) continue
    if (slot.sourcePhoto?.blobKey && slot.sourcePhoto.blobKey !== key) continue
    slot.sourcePhoto = {
      id: slot.sourcePhoto?.id ?? photoSlotId,
      url: slot.sourcePhoto?.url ?? '',
      blobKey: key,
      publicPath: slot.sourcePhoto?.publicPath,
      storagePath: slot.sourcePhoto?.storagePath,
      framing: slot.sourcePhoto?.framing ?? fullImageDualFraming(),
    }
  }

  return withDerivedSlots(next)
}

export function stampCloudMediaPaths(
  state: ClipStudioState,
  pathFor: (blobKey: string) => string,
  presentKeys: Iterable<string>,
): ClipStudioState {
  const present = new Set(presentKeys)
  const next = clone(state)
  const stampPhoto = (
    photo: ClipSourcePhoto | null | undefined,
  ): ClipSourcePhoto | null => {
    if (!photo) return photo ?? null
    if (!photo.blobKey || !present.has(photo.blobKey)) return photo
    return { ...photo, storagePath: pathFor(photo.blobKey) }
  }
  for (const dog of next.dogs) {
    dog.defaultPhoto = stampPhoto(dog.defaultPhoto)
    dog.generationPhoto = stampPhoto(dog.generationPhoto)
    for (const intent of dog.intents) {
      for (const slot of intent.clipSlots) {
        slot.sourcePhoto = stampPhoto(slot.sourcePhoto)
        if (slot.resultVideo?.blobKey && present.has(slot.resultVideo.blobKey)) {
          slot.resultVideo = asUserVideo({
            ...slot.resultVideo,
            storagePath: pathFor(slot.resultVideo.blobKey),
          })
        }
      }
    }
  }
  return withDerivedSlots(next)
}

/** Do not upsert a seed/placeholder library over a cloud copy that already has MP4s. */
export function shouldWriteRemoteLibrary(
  merged: ClipStudioState,
  remote: ClipStudioState | null,
): boolean {
  if (!remote) return true
  const mergedVideos = countUserAttachedVideos(merged)
  const remoteVideos = countUserAttachedVideos(remote)
  if (mergedVideos < remoteVideos) return false
  return true
}

function pickPhoto(
  local: ClipSourcePhoto | null | undefined,
  remote: ClipSourcePhoto | null | undefined,
): ClipSourcePhoto | null {
  if (photoRank(local) >= photoRank(remote)) {
    return local ? clone(local) : remote ? clone(remote) : null
  }
  return remote ? clone(remote) : local ? clone(local) : null
}

function pickVideo(
  local: ClipResultVideo | null | undefined,
  remote: ClipResultVideo | null | undefined,
): ClipResultVideo | null {
  const localUser = videoIsUser(local)
  const remoteUser = videoIsUser(remote)
  if (localUser && !remoteUser) return asUserVideo(clone(local!))
  if (remoteUser && !localUser) return asUserVideo(clone(remote!))
  if (localUser && remoteUser) {
    const chosen = clone(local!)
    return asUserVideo({
      ...chosen,
      blobKey: chosen.blobKey || remote?.blobKey,
      storagePath: chosen.storagePath || remote?.storagePath,
      fileName: chosen.fileName || remote?.fileName,
    })
  }
  return local ? clone(local) : remote ? clone(remote) : null
}

function mergeSlot(local: ClipSlot | undefined, remote: ClipSlot | undefined): ClipSlot {
  const base = local ?? remote
  if (!base) {
    throw new Error('mergeSlot requires at least one slot')
  }
  const other = local && remote ? (local === base ? remote : local) : undefined
  const sourcePhoto = pickPhoto(local?.sourcePhoto, remote?.sourcePhoto)
  const resultVideo = pickVideo(local?.resultVideo, remote?.resultVideo)
  const preferred: ClipSlot =
    (local && slotHasUserVideo(local) ? local : undefined) ??
    (remote && slotHasUserVideo(remote) ? remote : undefined) ??
    base
  return withDerivedStatus({
    ...clone(preferred),
    sourcePhoto,
    resultVideo,
    prompt: preferred.prompt || other?.prompt || base.prompt,
    label: preferred.label || other?.label || base.label,
    notes: preferred.notes || other?.notes,
    weight: preferred.weight || other?.weight || base.weight,
    generatorUsed: preferred.generatorUsed || other?.generatorUsed,
  })
}

function mergeIntent(local?: IntentBucket, remote?: IntentBucket): IntentBucket {
  const base = local ?? remote
  if (!base) {
    throw new Error('mergeIntent requires at least one intent')
  }
  const slotIds = new Set<string>()
  const slots: ClipSlot[] = []
  for (const slot of local?.clipSlots ?? []) {
    slotIds.add(slot.id)
    const counterpart = remote?.clipSlots.find((item) => item.id === slot.id)
    slots.push(mergeSlot(slot, counterpart))
  }
  for (const slot of remote?.clipSlots ?? []) {
    if (slotIds.has(slot.id)) continue
    slots.push(mergeSlot(undefined, slot))
  }
  const phrases = [...new Set([...(local?.phrases ?? []), ...(remote?.phrases ?? [])])]
  const preferred = local && remote
    ? (local.clipSlots.filter(slotHasUserVideo).length >=
        remote.clipSlots.filter(slotHasUserVideo).length
        ? local
        : remote)
    : base
  return {
    ...clone(preferred),
    phrases,
    clipSlots: slots,
    description: preferred.description || base.description,
    semanticHints: preferred.semanticHints || base.semanticHints,
  }
}

function dogKey(dog: DogLibrary): string {
  return dog.id.toLowerCase()
}

function dogNameKey(dog: DogLibrary): string {
  return dog.name.trim().toLowerCase()
}

function findCounterpart(dog: DogLibrary, pool: DogLibrary[]): DogLibrary | undefined {
  return (
    pool.find((item) => dogKey(item) === dogKey(dog)) ??
    pool.find((item) => dogNameKey(item) === dogNameKey(dog))
  )
}

function mergePreferredIdle(merged: DogLibrary, local?: DogLibrary, remote?: DogLibrary): string | undefined {
  const candidates = [local?.preferredIdleSlotId, remote?.preferredIdleSlotId].filter(
    (id): id is string => Boolean(id),
  )
  const attached = new Set(attachedIdleSlots(merged).map((slot) => slot.id))
  for (const id of candidates) {
    if (attached.has(id)) return id
  }
  return chosenIdleSlot(merged)?.id
}

function mergeDog(local?: DogLibrary, remote?: DogLibrary): DogLibrary {
  const base = local ?? remote
  if (!base) {
    throw new Error('mergeDog requires at least one dog')
  }
  const intentIds = new Set<string>()
  const intents: IntentBucket[] = []
  for (const intent of local?.intents ?? []) {
    intentIds.add(intent.id)
    const counterpart = remote?.intents.find((item) => item.id === intent.id)
    intents.push(mergeIntent(intent, counterpart))
  }
  for (const intent of remote?.intents ?? []) {
    if (intentIds.has(intent.id)) continue
    intents.push(mergeIntent(undefined, intent))
  }

  const localVideos = local ? local.intents.flatMap((intent) => intent.clipSlots).filter(slotHasUserVideo).length : 0
  const remoteVideos = remote
    ? remote.intents.flatMap((intent) => intent.clipSlots).filter(slotHasUserVideo).length
    : 0
  const preferredMeta = (localVideos >= remoteVideos ? local : remote) ?? base

  const merged: DogLibrary = {
    ...clone(preferredMeta),
    name: preferredMeta.name || base.name,
    defaultPhoto: pickPhoto(local?.defaultPhoto, remote?.defaultPhoto),
    generationPhoto: pickPhoto(local?.generationPhoto, remote?.generationPhoto),
    avatarPath: preferredMeta.avatarPath || base.avatarPath,
    intents,
  }
  merged.preferredIdleSlotId = mergePreferredIdle(merged, local, remote)
  return merged
}

/**
 * Union two Studio libraries without dropping user MP4s or generation stills.
 * Local user-attached videos win over cloud placeholders (PC upload path).
 * Cloud user-attached videos win over local seed placeholders (phone download path).
 */
export function mergeStudioLibraries(
  local: ClipStudioState,
  remote: ClipStudioState | null,
): ClipStudioState {
  if (!remote) return migrateStudioState(clone(local))

  const dogs: DogLibrary[] = []
  const usedRemote = new Set<string>()

  for (const localDog of local.dogs) {
    const counterpart = findCounterpart(localDog, remote.dogs)
    if (counterpart) usedRemote.add(dogKey(counterpart))
    dogs.push(mergeDog(localDog, counterpart))
  }
  for (const remoteDog of remote.dogs) {
    if (usedRemote.has(dogKey(remoteDog))) continue
    if (dogs.some((dog) => dogNameKey(dog) === dogNameKey(remoteDog))) continue
    dogs.push(mergeDog(undefined, remoteDog))
  }

  const localVideos = countUserAttachedVideos(local)
  const remoteVideos = countUserAttachedVideos(remote)
  const preferredActive =
    localVideos >= remoteVideos
      ? local.activeDogId
      : remote.activeDogId || local.activeDogId

  return migrateStudioState({
    version: 1,
    seedRevision: Math.max(local.seedRevision ?? 1, remote.seedRevision ?? 1),
    activeDogId: dogs.some((dog) => dog.id === preferredActive)
      ? preferredActive
      : (dogs[0]?.id ?? local.activeDogId),
    dogs,
  })
}

export function isDifferentAccountLocalLibrary(
  lastSyncedUserId: string | null,
  currentUserId: string,
): boolean {
  return Boolean(lastSyncedUserId && lastSyncedUserId !== currentUserId)
}
