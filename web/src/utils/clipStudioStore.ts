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
import {
  BOTH_PERSONALITY,
  MURPHY_PERSONALITY,
  RILEY_PERSONALITY,
  STUDIO_SEED_REVISION,
  createDogLibrary,
  createSeedStudioState,
} from '../data/clipStudioSeed'
import { normalizePersonality } from './dogPersonality'
import { publicAssetUrl } from '../lib/urls'

export const STUDIO_STORAGE_KEY = 'dog-facetime-clips.studio.v1'

const listeners = new Set<() => void>()
let memory: ClipStudioState | null = null
let revision = 0

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

function rehydratePublicPhotos(state: ClipStudioState): ClipStudioState {
  const next = cloneState(state)
  for (const dog of next.dogs) {
    dog.defaultPhoto = rehydratePhoto(dog.defaultPhoto)
    for (const intent of dog.intents) {
      for (const slot of intent.clipSlots) {
        if (slot.sourcePhoto) slot.sourcePhoto = rehydratePhoto(slot.sourcePhoto)
      }
    }
  }
  return next
}

function persist(state: ClipStudioState): void {
  if (!canUseStorage()) return
  try {
    const serializable = cloneState(state)
    for (const dog of serializable.dogs) {
      if (dog.defaultPhoto?.publicPath) {
        dog.defaultPhoto.url = publicAssetUrl(dog.defaultPhoto.publicPath)
      }
      for (const intent of dog.intents) {
        for (const slot of intent.clipSlots) {
          if (slot.sourcePhoto) {
            if (slot.sourcePhoto.blobKey) {
              slot.sourcePhoto.url = ''
            } else if (slot.sourcePhoto.publicPath) {
              slot.sourcePhoto.url = publicAssetUrl(slot.sourcePhoto.publicPath)
            }
          }
          if (slot.resultVideo) {
            delete slot.resultVideo.objectUrl
          }
        }
      }
    }
    window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(serializable))
  } catch {
    /* quota / private mode */
  }
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

/** Fold baked Murphy/Riley/Both photos + personality radios into older localStorage studios. */
export function migrateStudioState(state: ClipStudioState): ClipStudioState {
  const revision = state.seedRevision ?? 1
  if (revision >= 2 && state.dogs.some((dog) => dog.id === 'both')) {
    return withNormalizedPersonalities(state)
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

  return withNormalizedPersonalities({
    ...state,
    dogs,
    activeDogId: state.activeDogId || dogs[0]?.id || seed.activeDogId,
  })
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
  if (dog?.defaultPhoto) {
    return { ...dog.defaultPhoto, url: sourcePhotoDisplayUrl(dog.defaultPhoto) }
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
        intents: [...dog.intents, action.intent],
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
          clipSlots: [...intent.clipSlots, withDerivedStatus(action.slot)],
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
      return mapDog(state, action.dogId, (dog) =>
        mapIntent(dog, action.intentId, (intent) => ({
          ...intent,
          clipSlots: intent.clipSlots.filter((slot) => slot.id !== action.slotId),
        })),
      )
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
  memory = createSeedStudioState()
  persist(memory)
  notify()
  return memory
}

export function ensureStudioHydrated(): ClipStudioState {
  return getStudioState()
}

/** Restore object URLs for IndexedDB-backed photos/videos after a reload. */
export async function hydrateStudioMedia(loadBlob: (key: string) => Promise<Blob | null>): Promise<void> {
  const state = getStudioState()
  const next = cloneState(state)
  let changed = false
  for (const dog of next.dogs) {
    for (const intent of dog.intents) {
      for (const slot of intent.clipSlots) {
        if (slot.sourcePhoto?.blobKey && !slot.sourcePhoto.url) {
          const blob = await loadBlob(slot.sourcePhoto.blobKey)
          if (blob) {
            slot.sourcePhoto.url = URL.createObjectURL(blob)
            changed = true
          }
        }
        if (slot.resultVideo?.blobKey && !slot.resultVideo.objectUrl) {
          const blob = await loadBlob(slot.resultVideo.blobKey)
          if (blob) {
            slot.resultVideo.objectUrl = URL.createObjectURL(blob)
            changed = true
          }
        }
      }
    }
  }
  if (!changed) return
  memory = next
  notify()
}
