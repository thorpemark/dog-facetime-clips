import type { DualFraming } from '../utils/focalPoint'

/** Clip generation pipeline status. Placeholder demo MP4s do not count as attached. */
export type ClipSlotStatus = 'empty' | 'photo_ready' | 'video_attached' | 'needs_redo'

export type VideoOrigin = 'placeholder' | 'user'

export const GENERATOR_LABELS = ['Pika', 'Gemini', 'Grok'] as const
export type KnownGenerator = (typeof GENERATOR_LABELS)[number]

export interface ClipSourcePhoto {
  id: string
  /** Object URL or data URL for the editor / thumb. */
  url: string
  /** IndexedDB key when persisted (demo mode). */
  blobKey?: string
  framing: DualFraming
}

export interface ClipResultVideo {
  /** Committed public path under clips/, if any. */
  path?: string
  /** Session object URL for an uploaded file. */
  objectUrl?: string
  /** IndexedDB key when persisted (demo mode). */
  blobKey?: string
  fileName?: string
  origin: VideoOrigin
}

export interface ClipSlot {
  id: string
  weight: number
  prompt: string
  label: string
  /** Optional extra direction for Suggest prompt (this variant only). */
  notes?: string
  sourcePhoto: ClipSourcePhoto | null
  resultVideo: ClipResultVideo | null
  status: ClipSlotStatus
  /** Optional label only — no live generator APIs. */
  generatorUsed?: string
}

export interface IntentBucket {
  /** Free-form id (come, hug, custom-slug). Not a closed union. */
  id: string
  description: string
  phrases: string[]
  semanticHints: string
  priority: number
  clipSlots: ClipSlot[]
}

export interface DogPersonality {
  breed: string
  notes: string[]
}

export interface DogLibrary {
  id: string
  name: string
  personality: DogPersonality
  intents: IntentBucket[]
}

export interface ClipStudioState {
  version: 1
  activeDogId: string
  dogs: DogLibrary[]
}

export type StudioAction =
  | { type: 'selectDog'; dogId: string }
  | { type: 'addDog'; dog: DogLibrary }
  | { type: 'updateDog'; dogId: string; patch: Partial<Pick<DogLibrary, 'name' | 'personality'>> }
  | { type: 'removeDog'; dogId: string }
  | { type: 'addIntent'; dogId: string; intent: IntentBucket }
  | { type: 'updateIntent'; dogId: string; intentId: string; patch: Partial<Omit<IntentBucket, 'id' | 'clipSlots'>> }
  | { type: 'removeIntent'; dogId: string; intentId: string }
  | { type: 'addPhrase'; dogId: string; intentId: string; phrase: string }
  | { type: 'removePhrase'; dogId: string; intentId: string; phrase: string }
  | { type: 'addSlot'; dogId: string; intentId: string; slot: ClipSlot }
  | { type: 'updateSlot'; dogId: string; intentId: string; slotId: string; patch: Partial<ClipSlot> }
  | { type: 'removeSlot'; dogId: string; intentId: string; slotId: string }
  | { type: 'replaceState'; state: ClipStudioState }
