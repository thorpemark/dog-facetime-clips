import type {
  ClipSlot,
  ClipSourcePhoto,
  ClipStudioState,
  DogLibrary,
  DogPersonality,
  IntentBucket,
} from '../types/clipStudio'
import {
  CALL_MODES,
  defaultSourcePhotoForMode,
  isKeySeedIntent,
  type CallMode,
} from './callModes'
import { HOLIDAY_INTENTS, dogHasHolidayIntent } from './holidayIntents'
import {
  REACTION_CATALOG,
  isUnknownIntent,
  type ReactionBucket,
} from './reactionCatalog'
import { generateId } from '../lib/ids'
import { seedDirectorNote, suggestClipPrompt } from '../utils/suggestClipPrompt'
import { normalizePersonality } from '../utils/dogPersonality'
import { fullImageDualFraming } from '../utils/focalPoint'

/** Existing browsers merge this seed when their stored revision is lower. */
export const STUDIO_SEED_REVISION = 8

export function buildClipPrompt(
  dog: { name: string; personality: DogPersonality },
  intent: { id: string; description: string },
  slotLabel: string,
  options?: { userNotes?: string; hasSourcePhoto?: boolean },
): string {
  return suggestClipPrompt({
    dogName: dog.name,
    personality: dog.personality,
    intentId: intent.id,
    intentDescription: intent.description,
    slotLabel,
    userNotes: options?.userNotes,
    hasSourcePhoto: options?.hasSourcePhoto,
  })
}

export function cloneSourcePhoto(
  photo: ClipSourcePhoto | null | undefined,
  slotId: string,
): ClipSourcePhoto | null {
  if (!photo) return null
  return {
    ...structuredClone(photo),
    id: `${photo.id}-${slotId}`,
  }
}

/** Copy a generation still onto a slot at full-frame (whole image, both orientations). */
export function cloneGenerationStillForSlot(
  photo: ClipSourcePhoto | null | undefined,
  slotId: string,
): ClipSourcePhoto | null {
  const cloned = cloneSourcePhoto(photo, slotId)
  if (!cloned) return null
  return { ...cloned, framing: fullImageDualFraming() }
}

function slotsFromBucket(
  bucket: ReactionBucket,
  dog: { name: string; personality: DogPersonality },
  defaultPhoto?: ClipSourcePhoto | null,
): ClipSlot[] {
  return bucket.clips.map((clip, index) => {
    const label = clip.label ?? `${bucket.id} ${String(index + 1).padStart(2, '0')}`
    const id = `${dog.name.toLowerCase()}-${bucket.id}-${index + 1}`
    const description = bucket.description ?? bucket.id
    const notes = seedDirectorNote(bucket.id, description, label)
    const sourcePhoto = isKeySeedIntent(bucket.id)
      ? cloneSourcePhoto(defaultPhoto, id)
      : null
    return {
      id,
      weight: clip.weight,
      label,
      notes,
      prompt: buildClipPrompt(
        dog,
        { id: bucket.id, description },
        label,
        { userNotes: notes, hasSourcePhoto: Boolean(sourcePhoto) },
      ),
      sourcePhoto,
      resultVideo: clip.path
        ? { path: clip.path, origin: 'placeholder' as const, fileName: clip.path.split('/').pop() }
        : null,
      status: sourcePhoto ? ('photo_ready' as const) : ('empty' as const),
      generatorUsed: undefined,
    }
  })
}

function idleIntent(
  dog: { name: string; personality: DogPersonality },
  defaultPhoto?: ClipSourcePhoto | null,
): IntentBucket {
  const description = 'Idle FaceTime hold'
  const slots: ClipSlot[] = [1, 2].map((index) => {
    const id = `${dog.name.toLowerCase()}-idle-${index}`
    const label = index === 1 ? 'Calm look at camera' : 'Soft blink / breathe'
    const notes = seedDirectorNote('idle', description, label)
    return {
      id,
      weight: index === 1 ? 55 : 45,
      label,
      notes,
      prompt: buildClipPrompt(dog, { id: 'idle', description }, label, {
        userNotes: notes,
        hasSourcePhoto: Boolean(defaultPhoto),
      }),
      sourcePhoto: cloneSourcePhoto(defaultPhoto, id),
      resultVideo: {
        path: index === 1 ? 'clips/idle/idle_01.mp4' : 'clips/idle/idle_02.mp4',
        origin: 'placeholder',
        fileName: index === 1 ? 'idle_01.mp4' : 'idle_02.mp4',
      },
      status: defaultPhoto ? 'photo_ready' : 'empty',
    }
  })
  return {
    id: 'idle',
    description,
    phrases: [],
    semanticHints: '',
    priority: 0,
    clipSlots: slots,
  }
}

function intentsFromCatalog(
  dog: { name: string; personality: DogPersonality },
  catalog: ReactionBucket[] = REACTION_CATALOG,
  defaultPhoto?: ClipSourcePhoto | null,
): IntentBucket[] {
  const fromCatalog = catalog.map((bucket) => ({
    id: bucket.id,
    description: bucket.description ?? bucket.id,
    phrases: [...bucket.phrases],
    semanticHints: bucket.semanticHints ?? '',
    priority: bucket.priority,
    clipSlots: slotsFromBucket(bucket, dog, defaultPhoto),
  }))
  return [idleIntent(dog, defaultPhoto), ...fromCatalog]
}

export const MURPHY_PERSONALITY: DogPersonality = {
  breed: 'huskita (Husky × Akita mix)',
  notes: [
    'Murphy is the other huskita — not Riley (Riley is the black huskita).',
    'Remarkably non-vocal — expresses via face and body.',
    'Warm, expressive, slightly goofy.',
    'Loves hugs, chest scratches, and offering his neck with his nose up.',
    'Sings and howls well — a full musical husky howl.',
  ],
  vocalStyle: 'silent',
  voiceSize: 'large_low',
  energy: 'normal',
  eyes: 'goofy',
  mouth: 'dry',
  touch: 'cuddly',
}

export const RILEY_PERSONALITY: DogPersonality = {
  breed: 'huskita (Husky × Akita mix)',
  notes: [
    'Riley is the black huskita.',
    'Soft Foley — faint breath, soft mouth/lick, paw on rug, tail swish. Not a barker.',
    'Independent, expressive, a bit stubborn.',
    'Does not like hugs: silent warning face, bares teeth when her side is touched or she is asked for a hug (not an attack).',
    'Awkward howl attempt — hesitant and slightly off, not a full song.',
  ],
  vocalStyle: 'soft',
  voiceSize: 'medium',
  energy: 'normal',
  eyes: 'alert',
  mouth: 'dry',
  touch: 'grumble_hug',
}

export const BOTH_PERSONALITY: DogPersonality = {
  breed: 'huskitas (Husky × Akita mix)',
  notes: [
    'Shared memorial of Murphy (tan, folded ears, left) and Riley (black-and-white, upright ears, right).',
    'Soft Foley for the pair — faint breath, soft mouth/lick, paw, tail swish. Not barkers.',
    'Keep both dogs in frame. Same still as the Both mode card.',
    'Murphy loves hugs and howls well; Riley is hug-wary and has an awkward howl.',
  ],
  vocalStyle: 'soft',
  voiceSize: 'medium',
  energy: 'normal',
  eyes: 'goofy',
  mouth: 'dry',
  touch: 'cuddly',
}

export function createDogLibrary(
  name: string,
  personality: DogPersonality,
  options?: {
    id?: string
    catalog?: ReactionBucket[]
    defaultPhoto?: ClipSourcePhoto | null
    avatarPath?: string
  },
): DogLibrary {
  const dog = { name, personality }
  const defaultPhoto = options?.defaultPhoto ?? null
  return {
    id: options?.id ?? generateId(),
    name,
    personality: normalizePersonality(personality),
    avatarPath: options?.avatarPath,
    defaultPhoto: defaultPhoto ? structuredClone(defaultPhoto) : null,
    intents: intentsFromCatalog(dog, options?.catalog, defaultPhoto),
  }
}

function libraryFromMode(
  mode: CallMode,
  personality: DogPersonality,
): DogLibrary {
  const photo = defaultSourcePhotoForMode(mode)
  return createDogLibrary(mode.dogName, personality, {
    id: mode.id,
    defaultPhoto: photo,
    avatarPath: mode.photoPath,
  })
}

export function createEmptyClipSlot(
  dog: {
    name: string
    personality: DogPersonality
    generationPhoto?: ClipSourcePhoto | null
  },
  intent: { id: string; description: string },
  index: number,
): ClipSlot {
  const label = `${intent.description} ${String(index).padStart(2, '0')}`
  const id = generateId()
  const notes = seedDirectorNote(intent.id, intent.description, label)
  const sourcePhoto = cloneGenerationStillForSlot(dog.generationPhoto, id)
  return {
    id,
    weight: 40,
    label,
    notes,
    prompt: buildClipPrompt(dog, intent, label, {
      userNotes: notes,
      hasSourcePhoto: Boolean(sourcePhoto),
    }),
    sourcePhoto,
    resultVideo: null,
    status: sourcePhoto ? 'photo_ready' : 'empty',
  }
}

function holidayIntentForDog(
  dog: {
    name: string
    personality: DogPersonality
    generationPhoto?: ClipSourcePhoto | null
  },
  spec: (typeof HOLIDAY_INTENTS)[number],
): IntentBucket {
  const clipSlots: ClipSlot[] = spec.clipLabels.map((label, index) => {
    const id = `${dog.name.toLowerCase().replace(/\s+/g, '-')}-${spec.id}-${index + 1}`
    const sourcePhoto = cloneGenerationStillForSlot(dog.generationPhoto, id)
    const notes = seedDirectorNote(spec.id, spec.description, label)
    return {
      id,
      weight: index === 0 ? 55 : 45,
      label,
      notes,
      prompt: buildClipPrompt(
        dog,
        { id: spec.id, description: spec.description },
        label,
        { userNotes: notes, hasSourcePhoto: Boolean(sourcePhoto) },
      ),
      sourcePhoto,
      resultVideo: null,
      status: sourcePhoto ? 'photo_ready' : 'empty',
    }
  })
  return {
    id: spec.id,
    description: spec.description,
    phrases: [...spec.phrases],
    semanticHints: spec.semanticHints,
    priority: spec.priority,
    clipSlots,
  }
}

/** Add missing holiday costume-walk intents without touching existing ones (e.g. Murphy’s Halloween). */
export function ensureHolidayIntents(dog: DogLibrary): DogLibrary {
  const missing = HOLIDAY_INTENTS.filter((spec) => !dogHasHolidayIntent(dog.intents, spec.id))
  if (missing.length === 0) return dog
  const added = missing.map((spec) => holidayIntentForDog(dog, spec))
  const unknownIndex = dog.intents.findIndex((intent) => isUnknownIntent(intent.id))
  if (unknownIndex === -1) {
    return { ...dog, intents: [...dog.intents, ...added] }
  }
  const intents = [...dog.intents]
  intents.splice(unknownIndex, 0, ...added)
  return { ...dog, intents }
}

export function createEmptyIntent(
  dog: {
    name: string
    personality: DogPersonality
    generationPhoto?: ClipSourcePhoto | null
  },
  description: string,
  id: string,
): IntentBucket {
  return {
    id,
    description,
    phrases: [],
    semanticHints: '',
    priority: 5,
    clipSlots: [createEmptyClipSlot(dog, { id, description }, 1)],
  }
}

export function createSeedStudioState(): ClipStudioState {
  const murphyMode = CALL_MODES.find((mode) => mode.id === 'murphy')
  const rileyMode = CALL_MODES.find((mode) => mode.id === 'riley')
  const bothMode = CALL_MODES.find((mode) => mode.id === 'both')
  if (!murphyMode || !rileyMode || !bothMode) {
    throw new Error('CALL_MODES is missing murphy/riley/both')
  }
  const murphy = libraryFromMode(murphyMode, MURPHY_PERSONALITY)
  const riley = libraryFromMode(rileyMode, RILEY_PERSONALITY)
  const both = libraryFromMode(bothMode, BOTH_PERSONALITY)
  return {
    version: 1,
    seedRevision: STUDIO_SEED_REVISION,
    activeDogId: murphy.id,
    dogs: [murphy, riley, both],
  }
}
