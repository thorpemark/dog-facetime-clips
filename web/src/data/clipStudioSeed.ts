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
import {
  REACTION_CATALOG,
  type ReactionBucket,
} from './reactionCatalog'
import { generateId } from '../lib/ids'

/** Existing browsers merge this seed when their stored revision is lower. */
export const STUDIO_SEED_REVISION = 2

function personalityBeat(dogName: string, intentId: string, personality: DogPersonality): string {
  const notes = personality.notes.join(' ')
  if (dogName.toLowerCase() === 'riley' && intentId === 'hug') {
    return 'Riley does not enjoy hugs: when her side is touched or she is asked for a hug she bares her teeth and growls — a characteristic warning, not an attack. Ears back, lips curled, wary eyes.'
  }
  if (dogName.toLowerCase() === 'murphy' && intentId === 'hug') {
    return 'Murphy loves hugs: leans in, offers his neck with nose tilted up, enjoys a chest scratch, soft happy eyes, relaxed mouth.'
  }
  if (dogName.toLowerCase() === 'riley' && intentId === 'howl') {
    return 'Riley attempts to howl but it is awkward — hesitant, slightly off, mouth half-open, looking unsure; a cute failed howl rather than a full song.'
  }
  if (dogName.toLowerCase() === 'murphy' && intentId === 'howl') {
    return 'Murphy sings and howls well — head lifted, mouth open in a full confident howl/song, musical husky voice.'
  }
  if (dogName.toLowerCase() === 'both' && intentId === 'hug') {
    return 'Together shot: Murphy leans in and offers his neck; Riley is wary and may bare teeth if her side is touched — keep both dogs in frame.'
  }
  if (dogName.toLowerCase() === 'both' && intentId === 'howl') {
    return 'Together shot: Murphy sings a full husky howl; Riley attempts an awkward weaker howl beside him. Same kitchen-rug / yard framing, both faces toward camera.'
  }
  return notes
}

export function buildClipPrompt(
  dog: { name: string; personality: DogPersonality },
  intent: { id: string; description: string },
  slotLabel: string,
): string {
  const beat = personalityBeat(dog.name, intent.id, dog.personality)
  return [
    `Portrait FaceTime-style reaction clip, 1–3 seconds, silent.`,
    `${dog.name} is a ${dog.personality.breed}.`,
    `Looking toward the phone camera, natural lighting, no text, no morphing artifacts.`,
    `Intent (${intent.id}): ${intent.description}.`,
    beat,
    `Variant: ${slotLabel}.`,
    `Use the attached source still and crop. Keep a consistent phone-at-chest-height framing.`,
  ].join(' ')
}

function cloneSeedPhoto(photo: ClipSourcePhoto | null | undefined, slotId: string): ClipSourcePhoto | null {
  if (!photo) return null
  return {
    ...structuredClone(photo),
    id: `${photo.id}-${slotId}`,
  }
}

function slotsFromBucket(
  bucket: ReactionBucket,
  dog: { name: string; personality: DogPersonality },
  defaultPhoto?: ClipSourcePhoto | null,
): ClipSlot[] {
  return bucket.clips.map((clip, index) => {
    const label = clip.label ?? `${bucket.id} ${String(index + 1).padStart(2, '0')}`
    const id = `${dog.name.toLowerCase()}-${bucket.id}-${index + 1}`
    const sourcePhoto = isKeySeedIntent(bucket.id)
      ? cloneSeedPhoto(defaultPhoto, id)
      : null
    return {
      id,
      weight: clip.weight,
      label,
      prompt: buildClipPrompt(dog, { id: bucket.id, description: bucket.description ?? bucket.id }, label),
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
    return {
      id,
      weight: index === 1 ? 55 : 45,
      label,
      prompt: buildClipPrompt(dog, { id: 'idle', description }, label),
      sourcePhoto: cloneSeedPhoto(defaultPhoto, id),
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
    'Warm, expressive, slightly goofy.',
    'Loves hugs, chest scratches, and offering his neck with his nose up.',
    'Sings and howls well — a full musical husky howl.',
  ],
}

export const RILEY_PERSONALITY: DogPersonality = {
  breed: 'huskita (Husky × Akita mix)',
  notes: [
    'Independent, expressive, a bit stubborn.',
    'Does not like hugs: bares teeth and growls when her side is touched or she is asked for a hug (warning, not an attack).',
    'Awkward howl attempt — hesitant and slightly off, not a full song.',
  ],
}

export const BOTH_PERSONALITY: DogPersonality = {
  breed: 'huskitas (Husky × Akita mix)',
  notes: [
    'Shared memorial of Murphy (tan, folded ears, left) and Riley (black-and-white, upright ears, right).',
    'Keep both dogs in frame. Same still as the Both mode card.',
    'Murphy loves hugs and howls well; Riley is hug-wary and has an awkward howl.',
  ],
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
    personality: {
      breed: personality.breed,
      notes: [...personality.notes],
    },
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
  dog: { name: string; personality: DogPersonality; defaultPhoto?: ClipSourcePhoto | null },
  intent: { id: string; description: string },
  index: number,
): ClipSlot {
  const label = `${intent.description} ${String(index).padStart(2, '0')}`
  const id = generateId()
  const sourcePhoto = isKeySeedIntent(intent.id)
    ? cloneSeedPhoto(dog.defaultPhoto, id)
    : null
  return {
    id,
    weight: 40,
    label,
    prompt: buildClipPrompt(dog, intent, label),
    sourcePhoto,
    resultVideo: null,
    status: sourcePhoto ? 'photo_ready' : 'empty',
  }
}

export function createEmptyIntent(
  dog: { name: string; personality: DogPersonality },
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
