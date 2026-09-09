import type {
  ClipSlot,
  ClipSlotStatus,
  ClipSourcePhoto,
  ClipStudioState,
  DogLibrary,
  IntentBucket,
  StudioAction,
} from '../types/clipStudio'
import {
  CALL_MODES,
  defaultSourcePhotoForMode,
  isKeySeedIntent,
} from '../data/callModes'
import { isUserAttachedPhoto, repairSeedIdentityPhotos } from './callIdentity'
import { fullImageDualFraming } from './focalPoint'
import {
  BOTH_PERSONALITY,
  MURPHY_PERSONALITY,
  RILEY_PERSONALITY,
  STUDIO_SEED_REVISION,
  cloneGenerationStillForSlot,
  createDogLibrary,
  createSeedStudioState,
  ensureHolidayIntents,
} from '../data/clipStudioSeed'
import { isUnknownIntent, UNKNOWN_INTENT_ID } from '../data/reactionCatalog'
import { normalizePersonality } from './dogPersonality'
import { publicAssetUrl } from '../lib/urls'

export const STUDIO_STORAGE_KEY = 'dog-facetime-clips.studio.v1'

const listeners = new Set<() => void>()
let memory: ClipStudioState | null = null
let revision = 0
let skipCloudPush = false
let cloudSyncHandler: ((state: ClipStudioState) => void) | null = null

/** Debounced cloud upsert; StudioSyncProvider registers this when signed in. */
export function setStudioCloudSyncHandler(
  handler: ((state: ClipStudioState) => void) | null,
): void {
  cloudSyncHandler = handler
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function cloneState(state: ClipStudioState): ClipStudioState {
  return structuredClone(state)
}

export function getStudioRevision(): number {
  return revision
}

export function subscribeStudio(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify(): void {
  revision += 1
  for (const listener of listeners) listener()
}

function rehydratePhoto(photo: ClipSourcePhoto | null | undefined): ClipSourcePhoto | null {
  if (!photo) return null
  if (photo.publicPath && !photo.url) {
    return { ...photo, url: publicAssetUrl(photo.publicPath) }
  }
  if (photo.publicPath) {
    return { ...photo, url: publicAssetUrl(photo.publicPath) }
  }
  return photo
}

function persistPhoto(photo: ClipSourcePhoto | null | undefined): void {
  if (!photo) return
  if (photo.blobKey) {
    photo.url = ''
  } else if (photo.publicPath) {
    photo.url = publicAssetUrl(photo.publicPath)
  }
}

export function slotHasOwnSourcePhoto(slot: ClipSlot): boolean {
  const photo = slot.sourcePhoto
  if (!photo) return false
  return Boolean(photo.url || photo.publicPath || photo.blobKey)
}

/** Slot-owned IndexedDB keys (`photo:${slotId}`). Shared generation blobs must not be deleted. */
export function isSlotOwnedPhotoBlobKey(slotId: string, blobKey?: string): boolean {
  return Boolean(blobKey && blobKey === `photo:${slotId}`)
}

/**
 * Seed/avatar stills and copies of the generation portrait can be replaced.
 * Slot-owned custom photos (IndexedDB `photo:${slotId}`) stay unless forced.
 */
export function slotUsesReplaceableStill(slot: ClipSlot): boolean {
  if (!slotHasOwnSourcePhoto(slot)) return true
  return !isUserAttachedPhoto(slot.sourcePhoto)
}

function withCopiedGenerationStill(
  slot: ClipSlot,
  photo: ClipSourcePhoto | null | undefined,
  options?: { replaceCustom?: boolean },
): ClipSlot {
  if (!photo) return withDerivedStatus(slot)
  if (!options?.replaceCustom && !slotUsesReplaceableStill(slot)) {
    return withDerivedStatus(slot)
  }
  return withDerivedStatus({
    ...slot,
    sourcePhoto: cloneGenerationStillForSlot(photo, slot.id),
  })
}

export function applyGenerationStillToDog(
  dog: DogLibrary,
  photo: ClipSourcePhoto,
  options?: { replaceCustom?: boolean },
): DogLibrary {
  const still: ClipSourcePhoto = {
    ...structuredClone(photo),
    framing: fullImageDualFraming(),
  }
  return {
    ...dog,
    generationPhoto: still,
    intents: dog.intents.map((intent) => ({
      ...intent,
      clipSlots: intent.clipSlots.map((slot) =>
        withCopiedGenerationStill(slot, still, options),
      ),
    })),
  }
}

function isFullFrameStill(framing: ClipSourcePhoto['framing'] | undefined): boolean {
  if (!framing) return false
  return [framing.portrait, framing.landscape].every(
    (side) =>
      side.focalX === 0.5 &&
      side.focalY === 0.5 &&
      (side.cropWidth == null || side.cropWidth === 1) &&
      (side.cropHeight == null || side.cropHeight === 1),
  )
}

function slotAlreadyHasGenerationStill(
  slot: ClipSlot,
  photo: ClipSourcePhoto,
): boolean {
  const current = slot.sourcePhoto
  if (!current) return false
  const sameBlob = Boolean(photo.blobKey && current.blobKey === photo.blobKey)
  const samePublic =
    Boolean(photo.publicPath && current.publicPath === photo.publicPath) && !photo.blobKey
  return (sameBlob || samePublic) && isFullFrameStill(current.framing)
}

export function countGenerationStillTargets(
  dog: DogLibrary,
  replaceCustom = false,
): number {
  const photo = dog.generationPhoto
  if (!photo) return 0
  return dog.intents.reduce((sum, intent) => {
    return (
      sum +
      intent.clipSlots.filter((slot) => {
        if (!replaceCustom && !slotUsesReplaceableStill(slot)) return false
        return !slotAlreadyHasGenerationStill(slot, photo)
      }).length
    )
  }, 0)
}

function rehydratePublicPhotos(state: ClipStudioState): ClipStudioState {
  const next = cloneState(state)
  for (const dog of next.dogs) {
    dog.defaultPhoto = rehydratePhoto(dog.defaultPhoto)
    dog.generationPhoto = rehydratePhoto(dog.generationPhoto)
    for (const intent of dog.intents) {
      for (const slot of intent.clipSlots) {
        if (slot.sourcePhoto) slot.sourcePhoto = rehydratePhoto(slot.sourcePhoto)
      }
    }
  }
  return next
}

/** JSON-safe library (no blob: object URLs). IndexedDB / Storage hold the bytes. */
export function toPersistedStudioState(state: ClipStudioState): ClipStudioState {
  const serializable = cloneState(state)
  for (const dog of serializable.dogs) {
    persistPhoto(dog.defaultPhoto)
    persistPhoto(dog.generationPhoto)
    for (const intent of dog.intents) {
      for (const slot of intent.clipSlots) {
        persistPhoto(slot.sourcePhoto)
        if (slot.resultVideo) {
          delete slot.resultVideo.objectUrl
        }
      }
    }
  }
  return serializable
}

function persist(state: ClipStudioState): void {
  if (!canUseStorage()) {
    if (!skipCloudPush) cloudSyncHandler?.(state)
    return
  }
  try {
    window.localStorage.setItem(
      STUDIO_STORAGE_KEY,
      JSON.stringify(toPersistedStudioState(state)),
    )
  } catch {
    /* quota / private mode */
  }
  if (!skipCloudPush) cloudSyncHandler?.(state)
}

function readStored(): ClipStudioState | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(STUDIO_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ClipStudioState
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.dogs)) return null
    return parsed
  } catch {
    return null
  }
}

function seedPhotoForDog(dog: DogLibrary): ClipSourcePhoto | null {
  if (dog.defaultPhoto) return structuredClone(dog.defaultPhoto)
  const mode = CALL_MODES.find(
    (item) => item.id === dog.id || item.dogName.toLowerCase() === dog.name.toLowerCase(),
  )
  return mode ? defaultSourcePhotoForMode(mode) : null
}

function fillMissingSlotPhotos(dog: DogLibrary, defaultPhoto: ClipSourcePhoto | null): DogLibrary {
  if (!defaultPhoto) return dog
  return {
    ...dog,
    defaultPhoto: dog.defaultPhoto ?? structuredClone(defaultPhoto),
    avatarPath: dog.avatarPath ?? defaultPhoto.publicPath,
    intents: dog.intents.map((intent) => ({
      ...intent,
      clipSlots: intent.clipSlots.map((slot) => {
        if (slot.sourcePhoto) return slot
        if (!isKeySeedIntent(intent.id)) return slot
        return {
          ...slot,
          sourcePhoto: {
            ...structuredClone(defaultPhoto),
            id: `${defaultPhoto.id}-${slot.id}`,
          },
          status: slot.status === 'needs_redo' ? 'needs_redo' : 'photo_ready',
        }
      }),
    })),
  }
}

function personalityForSeedId(id: string) {
  if (id === 'riley') return RILEY_PERSONALITY
  if (id === 'both') return BOTH_PERSONALITY
  return MURPHY_PERSONALITY
}

function withNormalizedPersonalities(state: ClipStudioState): ClipStudioState {
  return {
    ...state,
    dogs: state.dogs.map((dog) => ({
      ...dog,
      personality: normalizePersonality(dog.personality, dog.id, dog.name),
    })),
    seedRevision: STUDIO_SEED_REVISION,
  }
}

function isRileyOrBothDog(dog: DogLibrary): boolean {
  const key = (dog.id || dog.name).trim().toLowerCase()
  return key === 'riley' || key === 'both'
}

/**
 * One-time: leftover silent seed on Riley/Both → soft Foley radios.
 * Does not rewrite slot prompts (Murphy untouched; Riley/Both Suggest next).
 */
function withRileyBothSoftFoleyDefaults(state: ClipStudioState): ClipStudioState {
  return {
    ...state,
    dogs: state.dogs.map((dog) => {
      if (!isRileyOrBothDog(dog)) return dog
      if (dog.personality.vocalStyle !== 'silent') return dog
      return {
        ...dog,
        personality: {
          ...dog.personality,
          vocalStyle: 'soft',
          notes: dog.personality.notes.filter((note) => !/remarkably non-vocal/i.test(note)),
        },
      }
    }),
    seedRevision: STUDIO_SEED_REVISION,
  }
}

function withHolidayIntents(state: ClipStudioState): ClipStudioState {
  return {
    ...state,
    dogs: state.dogs.map((dog) => ensureHolidayIntents(dog)),
    seedRevision: STUDIO_SEED_REVISION,
  }
}

function ensureUnknownIntent(dog: DogLibrary): DogLibrary {
  if (dog.intents.some((intent) => isUnknownIntent(intent.id))) return dog
  const seed = createDogLibrary(dog.name, dog.personality, {
    id: dog.id,
    defaultPhoto: seedPhotoForDog(dog),
    avatarPath: dog.avatarPath,
  })
  const unknown = seed.intents.find((intent) => intent.id === UNKNOWN_INTENT_ID)
  if (!unknown) return dog
  return { ...dog, intents: [...dog.intents, unknown] }
}

/** Fold baked Murphy/Riley/Both photos + personality radios + unknown intent into older localStorage studios. */
function finalizeStudioMigration(state: ClipStudioState, fromRevision: number): ClipStudioState {
  const next = withHolidayIntents(withNormalizedPersonalities(state))
  if (fromRevision < 7) {
    return withRileyBothSoftFoleyDefaults(next)
  }
  return next
}

export function migrateStudioState(state: ClipStudioState): ClipStudioState {
  const revision = state.seedRevision ?? 1
  const hasBoth = state.dogs.some((dog) => dog.id === 'both')
  const missingUnknown = state.dogs.some(
    (dog) => !dog.intents.some((intent) => isUnknownIntent(intent.id)),
  )
  if (revision >= 2 && hasBoth && !missingUnknown) {
    return finalizeStudioMigration(
      {
        ...state,
        dogs: state.dogs.map((dog) => repairSeedIdentityPhotos(dog)),
      },
      revision,
    )
  }

  const seed = createSeedStudioState()
  const dogs = state.dogs.map((dog) => fillMissingSlotPhotos(dog, seedPhotoForDog(dog)))

  for (const seedDog of seed.dogs) {
    const exists = dogs.some(
      (dog) =>
        dog.id === seedDog.id || dog.name.toLowerCase() === seedDog.name.toLowerCase(),
    )
    if (!exists) {
      dogs.push(seedDog)
    }
  }

  for (const mode of CALL_MODES) {
    const exists = dogs.some(
      (dog) =>
        dog.id === mode.id || dog.name.toLowerCase() === mode.dogName.toLowerCase(),
    )
    if (exists) continue
    const photo = defaultSourcePhotoForMode(mode)
    dogs.push(
      createDogLibrary(mode.dogName, personalityForSeedId(mode.id), {
        id: mode.id,
        defaultPhoto: photo,
        avatarPath: mode.photoPath,
      }),
    )
  }

  const withUnknown = dogs.map((dog) =>
    repairSeedIdentityPhotos(
      fillMissingSlotPhotos(ensureUnknownIntent(dog), seedPhotoForDog(dog)),
    ),
  )

  return finalizeStudioMigration(
    {
      ...state,
      dogs: withUnknown,
      activeDogId: state.activeDogId || withUnknown[0]?.id || seed.activeDogId,
    },
    revision,
  )
}

export function getStudioState(): ClipStudioState {
  if (!memory) {
    const stored = readStored()
    const next = rehydratePublicPhotos(
      stored ? migrateStudioState(stored) : createSeedStudioState(),
    )
    memory = next
    if (stored) persist(next)
  }
  return memory
}

export function findDog(state: ClipStudioState, dogIdOrName?: string): DogLibrary | undefined {
  if (!dogIdOrName) {
    return state.dogs.find((dog) => dog.id === state.activeDogId) ?? state.dogs[0]
  }
  const needle = dogIdOrName.toLowerCase()
  return (
    state.dogs.find((dog) => dog.id.toLowerCase() === needle) ??
    state.dogs.find((dog) => dog.name.toLowerCase() === needle)
  )
}

function mapDog(
  state: ClipStudioState,
  dogId: string,
  updater: (dog: DogLibrary) => DogLibrary,
): ClipStudioState {
  return {
    ...state,
    dogs: state.dogs.map((dog) => (dog.id === dogId ? updater(dog) : dog)),
  }
}

function mapIntent(
  dog: DogLibrary,
  intentId: string,
  updater: (intent: IntentBucket) => IntentBucket,
): DogLibrary {
  return {
    ...dog,
    intents: dog.intents.map((intent) => (intent.id === intentId ? updater(intent) : intent)),
  }
}

export function sourcePhotoDisplayUrl(photo: ClipSourcePhoto | null | undefined): string {
  if (!photo) return ''
  if (
    photo.url &&
    (photo.url.startsWith('blob:') ||
      photo.url.startsWith('data:') ||
      photo.url.startsWith('http://') ||
      photo.url.startsWith('https://'))
  ) {
    return photo.url
  }
  if (photo.publicPath) return publicAssetUrl(photo.publicPath)
  return photo.url ?? ''
}

export function resolveSourcePhoto(
  slot: ClipSlot,
  dog?: DogLibrary,
): ClipSourcePhoto | null {
  const attached = slot.sourcePhoto
  if (attached && (attached.url || attached.publicPath || attached.blobKey)) {
    return { ...attached, url: sourcePhotoDisplayUrl(attached) }
  }
  if (dog?.generationPhoto) {
    return { ...dog.generationPhoto, url: sourcePhotoDisplayUrl(dog.generationPhoto) }
  }
  return null
}

export function deriveSlotStatus(slot: ClipSlot): ClipSlotStatus {
  if (slot.status === 'needs_redo') return 'needs_redo'
  const hasUserVideo =
    slot.resultVideo?.origin === 'user' &&
    Boolean(slot.resultVideo.objectUrl || slot.resultVideo.blobKey || slot.resultVideo.path)
  if (hasUserVideo) return 'video_attached'
  if (slot.sourcePhoto?.url || slot.sourcePhoto?.publicPath || slot.sourcePhoto?.blobKey) {
    return 'photo_ready'
  }
  return 'empty'
}

export function withDerivedStatus(slot: ClipSlot): ClipSlot {
  if (slot.status === 'needs_redo') return slot
  return { ...slot, status: deriveSlotStatus({ ...slot, status: 'empty' }) }
}

export function applyStudioAction(
  state: ClipStudioState,
  action: StudioAction,
): ClipStudioState {
  switch (action.type) {
    case 'replaceState':
      return cloneState(action.state)
    case 'selectDog':
      if (!state.dogs.some((dog) => dog.id === action.dogId)) return state
      return { ...state, activeDogId: action.dogId }
    case 'addDog': {
      const dog = action.dog
      return {
        ...state,
        activeDogId: dog.id,
        dogs: [...state.dogs, dog],
      }
    }
    case 'updateDog':
      return mapDog(state, action.dogId, (dog) => ({
        ...dog,
        ...action.patch,
        personality: normalizePersonality(
          action.patch.personality ?? dog.personality,
          dog.id,
          action.patch.name ?? dog.name,
        ),
      }))
    case 'setPreferredIdle':
      return mapDog(state, action.dogId, (dog) => ({
        ...dog,
        preferredIdleSlotId: action.slotId ?? undefined,
      }))
    case 'setGenerationPhoto':
      return mapDog(state, action.dogId, (dog) => {
        let photo = action.photo ? structuredClone(action.photo) : null
        if (photo && action.fillEmptySlots !== false) {
          photo = { ...photo, framing: fullImageDualFraming() }
        }
        const next: DogLibrary = { ...dog, generationPhoto: photo }
        if (!photo || action.fillEmptySlots === false) return next
        return applyGenerationStillToDog(next, photo)
      })
    case 'applyGenerationStill':
      return mapDog(state, action.dogId, (dog) => {
        if (!dog.generationPhoto) return dog
        return applyGenerationStillToDog(dog, dog.generationPhoto, {
          replaceCustom: action.replaceCustom === true,
        })
      })
    case 'removeDog': {
      const dogs = state.dogs.filter((dog) => dog.id !== action.dogId)
      if (dogs.length === 0) return state
      const activeDogId =
        state.activeDogId === action.dogId ? dogs[0].id : state.activeDogId
      return { ...state, dogs, activeDogId }
    }
    case 'addIntent':
      return mapDog(state, action.dogId, (dog) => ({
        ...dog,
        intents: [
          ...dog.intents,
          {
            ...action.intent,
            clipSlots: action.intent.clipSlots.map((slot) =>
              withCopiedGenerationStill(slot, dog.generationPhoto),
            ),
          },
        ],
      }))
    case 'updateIntent':
      return mapDog(state, action.dogId, (dog) =>
        mapIntent(dog, action.intentId, (intent) => ({
          ...intent,
          ...action.patch,
        })),
      )
    case 'removeIntent':
      return mapDog(state, action.dogId, (dog) => ({
        ...dog,
        intents: dog.intents.filter((intent) => intent.id !== action.intentId),
      }))
    case 'addPhrase':
      return mapDog(state, action.dogId, (dog) =>
        mapIntent(dog, action.intentId, (intent) => {
          const phrase = action.phrase.trim().toLowerCase()
          if (!phrase || intent.phrases.includes(phrase)) return intent
          return { ...intent, phrases: [...intent.phrases, phrase] }
        }),
      )
    case 'removePhrase':
      return mapDog(state, action.dogId, (dog) =>
        mapIntent(dog, action.intentId, (intent) => ({
          ...intent,
          phrases: intent.phrases.filter((phrase) => phrase !== action.phrase),
        })),
      )
    case 'addSlot':
      return mapDog(state, action.dogId, (dog) =>
        mapIntent(dog, action.intentId, (intent) => ({
          ...intent,
          clipSlots: [
            ...intent.clipSlots,
            withCopiedGenerationStill(action.slot, dog.generationPhoto),
          ],
        })),
      )
    case 'updateSlot':
      return mapDog(state, action.dogId, (dog) =>
        mapIntent(dog, action.intentId, (intent) => ({
          ...intent,
          clipSlots: intent.clipSlots.map((slot) =>
            slot.id === action.slotId
              ? withDerivedStatus({ ...slot, ...action.patch })
              : slot,
          ),
        })),
      )
    case 'removeSlot':
      return mapDog(state, action.dogId, (dog) => {
        const next = mapIntent(dog, action.intentId, (intent) => ({
          ...intent,
          clipSlots: intent.clipSlots.filter((slot) => slot.id !== action.slotId),
        }))
        if (dog.preferredIdleSlotId === action.slotId) {
          return { ...next, preferredIdleSlotId: undefined }
        }
        return next
      })
    default:
      return state
  }
}

export function dispatchStudio(action: StudioAction): ClipStudioState {
  const next = applyStudioAction(getStudioState(), action)
  memory = next
  persist(next)
  notify()
  return next
}

export function resetStudioToSeed(): ClipStudioState {
  const previousSkip = skipCloudPush
  skipCloudPush = true
  memory = createSeedStudioState()
  persist(memory)
  skipCloudPush = previousSkip
  notify()
  return memory
}

/** Replace in-memory + local library. `syncCloud: false` skips the signed-in upsert (reset / inbound pull). */
export function replaceStudioState(
  state: ClipStudioState,
  options?: { syncCloud?: boolean },
): ClipStudioState {
  const previousSkip = skipCloudPush
  if (options?.syncCloud === false) skipCloudPush = true
  memory = cloneState(state)
  persist(memory)
  skipCloudPush = previousSkip
  notify()
  return memory
}

export function ensureStudioHydrated(): ClipStudioState {
  return getStudioState()
}

/** Restore object URLs for IndexedDB-backed photos/videos after a reload. */
export async function hydrateStudioMedia(loadBlob: (key: string) => Promise<Blob | null>): Promise<void> {
  const keys = new Set<string>()
  const collectKeys = (state: ClipStudioState) => {
    for (const dog of state.dogs) {
      if (dog.defaultPhoto?.blobKey) keys.add(dog.defaultPhoto.blobKey)
      if (dog.generationPhoto?.blobKey) keys.add(dog.generationPhoto.blobKey)
      for (const intent of dog.intents) {
        for (const slot of intent.clipSlots) {
          if (slot.sourcePhoto?.blobKey) keys.add(slot.sourcePhoto.blobKey)
          if (slot.resultVideo?.blobKey) keys.add(slot.resultVideo.blobKey)
        }
      }
    }
  }

  collectKeys(getStudioState())
  const blobs = new Map<string, Blob>()
  for (const key of keys) {
    const blob = await loadBlob(key)
    if (blob) blobs.set(key, blob)
  }

  collectKeys(getStudioState())
  for (const key of keys) {
    if (blobs.has(key)) continue
    const blob = await loadBlob(key)
    if (blob) blobs.set(key, blob)
  }
  if (blobs.size === 0) return

  const next = cloneState(getStudioState())
  let changed = false
  const objectUrls = new Map<string, string>()
  const urlFor = (key: string): string => {
    const existing = objectUrls.get(key)
    if (existing) return existing
    const blob = blobs.get(key)
    if (!blob) return ''
    const url = URL.createObjectURL(blob)
    objectUrls.set(key, url)
    return url
  }

  for (const dog of next.dogs) {
    if (dog.defaultPhoto?.blobKey && !dog.defaultPhoto.url && blobs.has(dog.defaultPhoto.blobKey)) {
      dog.defaultPhoto.url = urlFor(dog.defaultPhoto.blobKey)
      changed = true
    }
    if (dog.generationPhoto?.blobKey && !dog.generationPhoto.url && blobs.has(dog.generationPhoto.blobKey)) {
      dog.generationPhoto.url = urlFor(dog.generationPhoto.blobKey)
      changed = true
    }
    for (const intent of dog.intents) {
      for (const slot of intent.clipSlots) {
        if (slot.sourcePhoto?.blobKey && !slot.sourcePhoto.url && blobs.has(slot.sourcePhoto.blobKey)) {
          slot.sourcePhoto.url = urlFor(slot.sourcePhoto.blobKey)
          changed = true
        }
        if (
          slot.resultVideo?.blobKey &&
          !slot.resultVideo.objectUrl &&
          blobs.has(slot.resultVideo.blobKey)
        ) {
          slot.resultVideo.objectUrl = urlFor(slot.resultVideo.blobKey)
          changed = true
        }
      }
    }
  }
  if (!changed) return
  memory = next
  notify()
}
