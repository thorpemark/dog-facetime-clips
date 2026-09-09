import type { DualFraming } from '../utils/focalPoint'

/** Clip generation pipeline status. Placeholder demo MP4s do not count as attached. */
export type ClipSlotStatus = 'empty' | 'photo_ready' | 'video_attached' | 'needs_redo'

export type VideoOrigin = 'placeholder' | 'user'

export const GENERATOR_LABELS = ['Pika', 'Gemini', 'Grok'] as const
export type KnownGenerator = (typeof GENERATOR_LABELS)[number]

export interface ClipSourcePhoto {
  id: string
  /** Object URL, data URL, or resolved public URL for the editor / thumb. */
  url: string
  /** IndexedDB / cloud storage key when the file is not a publicPath seed still. */
  blobKey?: string
  /** Private `studio-media` object path (`{userId}/{encodedBlobKey}`) when uploaded. */
  storagePath?: string
  /** Path under `web/public/` for baked seed stills (e.g. `modes/murphy.jpg`). */
  publicPath?: string
  framing: DualFraming
}

export interface ClipResultVideo {
  /** Committed public path under clips/, if any. */
  path?: string
  /** Session object URL for an uploaded file. */
  objectUrl?: string
  /** IndexedDB / cloud storage key when persisted. */
  blobKey?: string
  /** Private `studio-media` object path when this MP4 is in the cloud. */
  storagePath?: string
  /** Original File.name from the last attach/replace. */
  fileName?: string
  /** Alias of the original upload name (same value as fileName when captured). */
  originalName?: string
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

export const VOCAL_STYLES = ['silent', 'soft', 'barks', 'howler', 'talker'] as const
export type VocalStyle = (typeof VOCAL_STYLES)[number]

export const VOICE_SIZES = ['small_high', 'medium', 'large_low'] as const
export type VoiceSize = (typeof VOICE_SIZES)[number]

export const ENERGY_LEVELS = ['calm', 'normal', 'hyper'] as const
export type EnergyLevel = (typeof ENERGY_LEVELS)[number]

export const EYE_STYLES = ['soft_sad', 'alert', 'goofy'] as const
export type EyeStyle = (typeof EYE_STYLES)[number]

export const MOUTH_STYLES = ['dry', 'slobberer'] as const
export type MouthStyle = (typeof MOUTH_STYLES)[number]

export const TOUCH_STYLES = ['cuddly', 'grumble_hug'] as const
export type TouchStyle = (typeof TOUCH_STYLES)[number]

export interface DogPersonality {
  breed: string
  notes: string[]
  /** How the dog typically uses its voice. Silent is silence-first. Soft invites faint Foley. */
  vocalStyle: VocalStyle
  /** Register for allowed vocalization. Unused in AUDIO when vocalStyle is silent (except howl/play exceptions). */
  voiceSize: VoiceSize
  energy: EnergyLevel
  eyes: EyeStyle
  mouth: MouthStyle
  touch: TouchStyle
}

export interface DogLibrary {
  id: string
  name: string
  personality: DogPersonality
  intents: IntentBucket[]
  /** Public path used for Studio / picker avatars (home cards stay on seed modes). */
  avatarPath?: string
  /** Dog-level avatar still (picker / incoming). Not used as the Grok source. */
  defaultPhoto?: ClipSourcePhoto | null
  /**
   * Portrait used as the Grok / clip source for this dog. Copied onto new
   * intents at full frame. Not the Studio tab or demo-picker avatar
   * (`defaultPhoto` / `modes/*.jpg`).
   */
  generationPhoto?: ClipSourcePhoto | null
  /** Idle-intent slot used as the looping FaceTime hold. */
  preferredIdleSlotId?: string
}

export interface ClipStudioState {
  version: 1
  /** Bumped when baked seed dogs/photos change so existing browsers pick them up. */
  seedRevision?: number
  activeDogId: string
  dogs: DogLibrary[]
}

export type StudioAction =
  | { type: 'selectDog'; dogId: string }
  | { type: 'addDog'; dog: DogLibrary }
  | { type: 'updateDog'; dogId: string; patch: Partial<Pick<DogLibrary, 'name' | 'personality' | 'preferredIdleSlotId'>> }
  | { type: 'setPreferredIdle'; dogId: string; slotId: string | null }
  | {
      type: 'setGenerationPhoto'
      dogId: string
      photo: ClipSourcePhoto | null
      /** Copy onto empty + seed/avatar slots. Default true. */
      fillEmptySlots?: boolean
    }
  | {
      type: 'applyGenerationStill'
      dogId: string
      /** Also replace custom unique slot photos. Default false. */
      replaceCustom?: boolean
    }
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
