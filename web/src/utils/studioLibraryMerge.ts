import type {
  ClipResultVideo,
  ClipSlot,
  ClipSourcePhoto,
  ClipStudioState,
  DogLibrary,
  IntentBucket,
} from '../types/clipStudio'
import { attachedIdleSlots, chosenIdleSlot } from './callIdentity'
import { migrateStudioState, withDerivedStatus } from './clipStudioStore'

function clone<T>(value: T): T {
  return structuredClone(value)
}

function slotHasUserVideo(slot: ClipSlot | undefined): boolean {
  const video = slot?.resultVideo
  if (!video || video.origin !== 'user') return false
  return Boolean(video.blobKey || video.objectUrl || video.path)
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
        if (slot.resultVideo?.origin === 'user') add(slot.resultVideo.blobKey)
      }
    }
  }
  return [...keys]
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
  const localUser = local?.origin === 'user'
  const remoteUser = remote?.origin === 'user'
  if (localUser && !remoteUser) return clone(local!)
  if (remoteUser && !localUser) return clone(remote!)
  if (localUser && remoteUser) return clone(local!)
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
