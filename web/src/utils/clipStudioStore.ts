import type {
  ClipSlot,
  ClipSlotStatus,
  ClipStudioState,
  DogLibrary,
  IntentBucket,
  StudioAction,
} from '../types/clipStudio'
import { createSeedStudioState } from '../data/clipStudioSeed'

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

function persist(state: ClipStudioState): void {
  if (!canUseStorage()) return
  try {
    const serializable = cloneState(state)
    for (const dog of serializable.dogs) {
      for (const intent of dog.intents) {
        for (const slot of intent.clipSlots) {
          if (slot.sourcePhoto) {
            if (slot.sourcePhoto.blobKey) {
              slot.sourcePhoto.url = ''
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

export function getStudioState(): ClipStudioState {
  if (!memory) {
    memory = readStored() ?? createSeedStudioState()
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

export function deriveSlotStatus(slot: ClipSlot): ClipSlotStatus {
  if (slot.status === 'needs_redo') return 'needs_redo'
  const hasUserVideo =
    slot.resultVideo?.origin === 'user' &&
    Boolean(slot.resultVideo.objectUrl || slot.resultVideo.blobKey || slot.resultVideo.path)
  if (hasUserVideo) return 'video_attached'
  if (slot.sourcePhoto) return 'photo_ready'
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
        personality: action.patch.personality ?? dog.personality,
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
