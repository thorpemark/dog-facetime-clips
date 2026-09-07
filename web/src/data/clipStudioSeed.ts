import type {
  ClipSlot,
  ClipStudioState,
  DogLibrary,
  DogPersonality,
  IntentBucket,
} from '../types/clipStudio'
import {
  REACTION_CATALOG,
  type ReactionBucket,
} from './reactionCatalog'
import { generateId } from '../lib/ids'

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

function slotsFromBucket(
  bucket: ReactionBucket,
  dog: { name: string; personality: DogPersonality },
): ClipSlot[] {
  return bucket.clips.map((clip, index) => {
    const label = clip.label ?? `${bucket.id} ${String(index + 1).padStart(2, '0')}`
    return {
      id: `${dog.name.toLowerCase()}-${bucket.id}-${index + 1}`,
      weight: clip.weight,
      label,
      prompt: buildClipPrompt(dog, { id: bucket.id, description: bucket.description ?? bucket.id }, label),
      sourcePhoto: null,
      resultVideo: clip.path
        ? { path: clip.path, origin: 'placeholder' as const, fileName: clip.path.split('/').pop() }
        : null,
      status: 'empty' as const,
      generatorUsed: undefined,
    }
  })
}

function intentsFromCatalog(
  dog: { name: string; personality: DogPersonality },
  catalog: ReactionBucket[] = REACTION_CATALOG,
): IntentBucket[] {
  return catalog.map((bucket) => ({
    id: bucket.id,
    description: bucket.description ?? bucket.id,
    phrases: [...bucket.phrases],
    semanticHints: bucket.semanticHints ?? '',
    priority: bucket.priority,
    clipSlots: slotsFromBucket(bucket, dog),
  }))
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

export function createDogLibrary(
  name: string,
  personality: DogPersonality,
  options?: { id?: string; catalog?: ReactionBucket[] },
): DogLibrary {
  const dog = { name, personality }
  return {
    id: options?.id ?? generateId(),
    name,
    personality: {
      breed: personality.breed,
      notes: [...personality.notes],
    },
    intents: intentsFromCatalog(dog, options?.catalog),
  }
}

export function createEmptyClipSlot(
  dog: { name: string; personality: DogPersonality },
  intent: { id: string; description: string },
  index: number,
): ClipSlot {
  const label = `${intent.description} ${String(index).padStart(2, '0')}`
  return {
    id: generateId(),
    weight: 40,
    label,
    prompt: buildClipPrompt(dog, intent, label),
    sourcePhoto: null,
    resultVideo: null,
    status: 'empty',
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
  const murphy = createDogLibrary('Murphy', MURPHY_PERSONALITY, { id: 'murphy' })
  const riley = createDogLibrary('Riley', RILEY_PERSONALITY, { id: 'riley' })
  return {
    version: 1,
    activeDogId: murphy.id,
    dogs: [murphy, riley],
  }
}
