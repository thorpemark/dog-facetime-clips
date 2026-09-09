import type {
  DogPersonality,
  EnergyLevel,
  EyeStyle,
  MouthStyle,
  TouchStyle,
  VocalStyle,
  VoiceSize,
} from '../types/clipStudio'
import {
  ENERGY_LEVELS,
  EYE_STYLES,
  MOUTH_STYLES,
  TOUCH_STYLES,
  VOCAL_STYLES,
  VOICE_SIZES,
} from '../types/clipStudio'

export const DEFAULT_BREED = 'huskita (Husky × Akita mix)'

export const VOCAL_STYLE_LABELS: Record<VocalStyle, string> = {
  silent: 'Silent',
  soft: 'Soft / whine',
  barks: 'Vocal barks',
  howler: 'Howler',
  talker: 'Talks (experimental)',
}

export const VOICE_SIZE_LABELS: Record<VoiceSize, string> = {
  small_high: 'Small / high',
  medium: 'Medium',
  large_low: 'Large / low',
}

export const ENERGY_LABELS: Record<EnergyLevel, string> = {
  calm: 'Calm',
  normal: 'Normal',
  hyper: 'Hyper',
}

export const EYE_LABELS: Record<EyeStyle, string> = {
  soft_sad: 'Soft / sad',
  alert: 'Alert',
  goofy: 'Goofy',
}

export const MOUTH_LABELS: Record<MouthStyle, string> = {
  dry: 'Dry',
  slobberer: 'Slobberer',
}

export const TOUCH_LABELS: Record<TouchStyle, string> = {
  cuddly: 'Loves hugs',
  grumble_hug: 'Grumble-hug',
}

export function defaultPersonalityTraits(): Pick<
  DogPersonality,
  'vocalStyle' | 'voiceSize' | 'energy' | 'eyes' | 'mouth' | 'touch'
> {
  return {
    vocalStyle: 'silent',
    voiceSize: 'medium',
    energy: 'normal',
    eyes: 'alert',
    mouth: 'dry',
    touch: 'cuddly',
  }
}

export function defaultPersonality(overrides?: Partial<DogPersonality>): DogPersonality {
  return normalizePersonality({
    breed: DEFAULT_BREED,
    notes: ['Edit these notes so new clip prompts stay on-character.'],
    ...defaultPersonalityTraits(),
    ...overrides,
  })
}

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
}

function seedFallbackFor(dogId?: string, dogName?: string): DogPersonality | null {
  const key = (dogId ?? dogName ?? '').trim().toLowerCase()
  if (key === 'murphy') {
    return {
      breed: DEFAULT_BREED,
      notes: [],
      vocalStyle: 'silent',
      voiceSize: 'large_low',
      energy: 'normal',
      eyes: 'goofy',
      mouth: 'dry',
      touch: 'cuddly',
    }
  }
  if (key === 'riley') {
    return {
      breed: DEFAULT_BREED,
      notes: [],
      vocalStyle: 'soft',
      voiceSize: 'medium',
      energy: 'normal',
      eyes: 'alert',
      mouth: 'dry',
      touch: 'grumble_hug',
    }
  }
  if (key === 'both') {
    return {
      breed: 'huskitas (Husky × Akita mix)',
      notes: [],
      vocalStyle: 'soft',
      voiceSize: 'medium',
      energy: 'normal',
      eyes: 'goofy',
      mouth: 'dry',
      touch: 'cuddly',
    }
  }
  return null
}

/** Fill missing/invalid radios so older localStorage libraries still Suggest. */
export function normalizePersonality(
  personality?: Partial<DogPersonality> | null,
  dogId?: string,
  dogName?: string,
): DogPersonality {
  const seed = seedFallbackFor(dogId, dogName)
  const defaults = seed ?? {
    breed: DEFAULT_BREED,
    notes: [] as string[],
    ...defaultPersonalityTraits(),
  }
  const notes = Array.isArray(personality?.notes)
    ? personality.notes.map((note) => String(note))
    : [...defaults.notes]

  return {
    breed: personality?.breed?.trim() || defaults.breed,
    notes,
    vocalStyle: includes(VOCAL_STYLES, personality?.vocalStyle)
      ? personality.vocalStyle
      : defaults.vocalStyle,
    voiceSize: includes(VOICE_SIZES, personality?.voiceSize)
      ? personality.voiceSize
      : defaults.voiceSize,
    energy: includes(ENERGY_LEVELS, personality?.energy) ? personality.energy : defaults.energy,
    eyes: includes(EYE_STYLES, personality?.eyes) ? personality.eyes : defaults.eyes,
    mouth: includes(MOUTH_STYLES, personality?.mouth) ? personality.mouth : defaults.mouth,
    touch: includes(TOUCH_STYLES, personality?.touch) ? personality.touch : defaults.touch,
  }
}

export function voiceSizePitch(size: VoiceSize): string {
  if (size === 'small_high') return 'high, small-dog-pitched'
  if (size === 'large_low') return 'low, large-dog'
  return 'medium-register'
}

export function eyePhrase(eyes: EyeStyle): string {
  if (eyes === 'soft_sad') return 'soft, slightly sad eyes'
  if (eyes === 'goofy') return 'goofy, warm eyes'
  return 'alert, bright eyes'
}

export function energyMotionPhrase(energy: EnergyLevel): string {
  if (energy === 'calm') return 'Slow, calm, unhurried movements.'
  if (energy === 'hyper') return 'Quick, hyperactive body energy — stay in frame, not a zoomie.'
  return ''
}
