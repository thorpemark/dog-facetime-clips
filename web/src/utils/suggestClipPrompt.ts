import { holidaySpecFor, isHolidayLikeIntent, type HolidayIntentSpec } from '../data/holidayIntents'
import type { DogPersonality, VocalStyle, VoiceSize } from '../types/clipStudio'
import type { DualFraming } from './focalPoint'
import {
  energyMotionPhrase,
  eyePhrase,
  normalizePersonality,
  voiceSizePitch,
} from './dogPersonality'

export { isHolidayLikeIntent }

export interface SuggestPromptInput {
  dogName: string
  personality: DogPersonality
  intentId: string
  intentDescription: string
  slotLabel: string
  /** Extra direction typed on this slot. */
  userNotes?: string
  hasSourcePhoto?: boolean
  framing?: DualFraming | null
}

function normalizeIntent(intentId: string): string {
  return intentId.trim().toLowerCase()
}

function dogKey(name: string): string {
  return name.trim().toLowerCase()
}

function haystackOf(input: Pick<SuggestPromptInput, 'intentId' | 'intentDescription' | 'slotLabel' | 'userNotes'>): string {
  return [input.intentId, input.intentDescription, input.slotLabel, input.userNotes ?? '']
    .join(' ')
    .toLowerCase()
}

/** Howl / sing buckets (and slug variants like howl-2). */
export function isHowlLikeIntent(intentId: string, intentDescription = ''): boolean {
  const intent = normalizeIntent(intentId)
  if (intent.includes('howl') || intent.includes('sing') || intent.includes('aroo') || intent.includes('awoo')) {
    return true
  }
  const desc = intentDescription.trim().toLowerCase()
  if (!desc) return false
  if (/does not howl|never howl|no howl/.test(desc)) return false
  return /\bhowl\b|\bsing\b|\baroo\b|\bawoo\b/.test(desc)
}

/** True only for howl/sing intents. Slot notes cannot unlock vocalization. */
export function allowsHowlVocalization(input: SuggestPromptInput): boolean {
  return isHowlLikeIntent(input.intentId, input.intentDescription)
}

/** Play / play-fight / play-bow buckets (and slug variants like play-2). */
export function isPlayLikeIntent(intentId: string, intentDescription = ''): boolean {
  const intent = normalizeIntent(intentId)
  if (intent === 'play' || intent.startsWith('play-') || intent.includes('playbow') || intent.includes('play-bow')) {
    return true
  }
  if (intent.includes('playfight') || intent.includes('play-fight')) return true
  const desc = intentDescription.trim().toLowerCase()
  if (!desc) return false
  return /\bplay[-\s]?bow\b|\bplay[-\s]?fight\b|\bwant to play\b|\bcome play\b/.test(desc)
}

/** Play-only: one short challenge huff. Does not unlock howl or other vocals. */
export function allowsPlayHuff(input: SuggestPromptInput): boolean {
  if (allowsHowlVocalization(input)) return false
  return isPlayLikeIntent(input.intentId, input.intentDescription)
}

function isAttentionStyleIntent(input: SuggestPromptInput): boolean {
  const intent = normalizeIntent(input.intentId)
  if (
    intent === 'name' ||
    intent === 'come' ||
    intent === 'here' ||
    intent === 'owner' ||
    intent.startsWith('name-') ||
    intent.startsWith('come-') ||
    intent.startsWith('here-') ||
    intent.startsWith('owner-')
  ) {
    return true
  }
  return /\b(attention|eye[-\s]?contact|perk[-\s]?up|recognition|look (this way|here)|glance)\b/.test(
    haystackOf(input),
  )
}

function isHugLikeIntent(intentId: string, intentDescription = ''): boolean {
  const intent = normalizeIntent(intentId)
  if (intent.includes('hug') || intent.includes('cuddle') || intent.includes('snuggle')) {
    return true
  }
  const desc = intentDescription.trim().toLowerCase()
  if (!desc) return false
  return /\bhug\b|\bcuddle\b|\bsnuggle\b/.test(desc)
}

const ID_MOTION_FAMILIES = [
  'unknown',
  'confused',
  'treat',
  'hug',
  'howl',
  'come',
  'here',
  'name',
  'owner',
  'good',
  'walk',
  'play',
  'quiet',
  'idle',
  'no',
] as const

export type SuggestIntentFamily =
  | 'holiday'
  | 'howl'
  | 'play'
  | 'hug'
  | 'unknown'
  | 'no'
  | 'treat'
  | 'walk'
  | 'good'
  | 'come'
  | 'here'
  | 'name'
  | 'owner'
  | 'quiet'
  | 'idle'
  | 'attention'
  | 'generic'

function matchesIntentId(intent: string, family: string): boolean {
  return intent === family || intent.startsWith(`${family}-`)
}

function isUnknownLikeIntent(intentId: string): boolean {
  const intent = normalizeIntent(intentId)
  return (
    intent === 'unknown' ||
    intent === 'confused' ||
    intent.startsWith('unknown-') ||
    intent.startsWith('confused-')
  )
}

/**
 * Correction / prohibition buckets. Id wins over labels so a No slot
 * cannot inherit treat motion from leftover notes or a lick-style variant name.
 */
export function isNoLikeIntent(intentId: string, intentDescription = ''): boolean {
  const intent = normalizeIntent(intentId)
  if (
    matchesIntentId(intent, 'no') ||
    matchesIntentId(intent, 'stop') ||
    matchesIntentId(intent, 'leave-it') ||
    intent === 'leaveit' ||
    intent.startsWith('leaveit-')
  ) {
    return true
  }
  const desc = intentDescription.trim().toLowerCase()
  if (!desc) return false
  if (isHolidayLikeIntent(intentId, intentDescription)) return false
  if (/\b(treat|chicken|cookie|snack|nummies)\b/.test(desc) && !/\b(no|stop|leave it|don'?t)\b/.test(desc)) {
    return false
  }
  return /\b(no|stop|leave it|uh[- ]?uh|don'?t|knock it off|correction|guilty settle)\b/.test(desc)
}

/** Food-interest buckets. Never wins over `no` / holiday (trick or treat). */
export function isTreatLikeIntent(intentId: string, intentDescription = ''): boolean {
  if (isNoLikeIntent(intentId, intentDescription)) return false
  if (isHolidayLikeIntent(intentId, intentDescription)) return false
  const intent = normalizeIntent(intentId)
  if (matchesIntentId(intent, 'treat') || matchesIntentId(intent, 'food') || matchesIntentId(intent, 'cookie')) {
    return true
  }
  const desc = intentDescription.trim().toLowerCase()
  if (!desc) return false
  return /\b(treat|chicken|cookie|snack|nummies)\b/.test(desc)
}

/**
 * One exclusive family per Suggest. Uses intent id, then description —
 * never slot labels (those are variant beats only).
 */
export function classifySuggestIntent(
  input: Pick<SuggestPromptInput, 'intentId' | 'intentDescription'>,
): SuggestIntentFamily {
  const intentId = input.intentId
  const desc = input.intentDescription
  if (isHolidayLikeIntent(intentId, desc)) return 'holiday'
  if (isHowlLikeIntent(intentId, desc)) return 'howl'
  if (isPlayLikeIntent(intentId, desc)) return 'play'
  if (isHugLikeIntent(intentId, desc)) return 'hug'
  if (isUnknownLikeIntent(intentId)) return 'unknown'

  const intent = normalizeIntent(intentId)
  const byLength = [...ID_MOTION_FAMILIES].sort((a, b) => b.length - a.length)
  for (const family of byLength) {
    if (matchesIntentId(intent, family)) {
      return family === 'confused' ? 'unknown' : family
    }
  }

  if (isNoLikeIntent(intentId, desc)) return 'no'
  if (isTreatLikeIntent(intentId, desc)) return 'treat'

  const text = desc.trim().toLowerCase()
  if (/\bwalk\b|go outside|leash/.test(text)) return 'walk'
  if (/\bgood (boy|girl|dog|pup)\b/.test(text)) return 'good'
  if (/\bquiet\b|\bsettle\b|\bcalm down\b/.test(text)) return 'quiet'
  if (/\bcome here\b|\bcome over\b|\brecall\b/.test(text)) return 'come'
  if (/\bover here\b|\bthis way\b/.test(text)) return 'here'
  if (/\bowner\b|\bmom\b|\bdad\b/.test(text)) return 'owner'
  if (/\bidle\b|facetime hold/.test(text)) return 'idle'
  return 'generic'
}

function isRileyOrBoth(dogName: string): boolean {
  const dog = dogKey(dogName)
  return dog === 'riley' || dog === 'both'
}

/**
 * Soft Foley AUDIO: vocalStyle `soft`, or leftover silent seed on Riley/Both.
 * Murphy (and other silent dogs) stay silence-first.
 */
export function usesSoftFoleyAudio(dogName: string, style: VocalStyle): boolean {
  if (style === 'soft') return true
  if (style !== 'silent') return false
  return isRileyOrBoth(dogName)
}

/** Treat / lick / mouth-open / excited — do not also force "Mouth closed". */
function wantsOpenMouthOrExcited(input: Pick<SuggestPromptInput, 'intentId' | 'intentDescription' | 'slotLabel' | 'userNotes'>): boolean {
  const intent = normalizeIntent(input.intentId)
  if (intent === 'treat' || intent.startsWith('treat-')) return true
  return /\b(lick|licks|lips|mouth open|open mouth|excited)\b/i.test(haystackOf(input))
}

const FOOD_NOTE = /\b(lick|licks|treat|chicken|cookie|snack|nummies|food)\b/i

function personalityNotesForIntent(
  personality: DogPersonality,
  options: { allowHowl: boolean; softFoley: boolean; family?: SuggestIntentFamily },
): string {
  let notes = personality.notes.map((note) => note.trim()).filter(Boolean)
  if (!options.allowHowl) {
    notes = notes.filter((note) => !/\b(howl|sing|aroo|awoo|bay|bark|growl|whine)\b/i.test(note))
  }
  if (options.softFoley) {
    notes = notes.filter((note) => !/remarkably non-vocal|not sound/i.test(note))
  }
  if (options.family === 'no' || options.family === 'quiet') {
    notes = notes.filter((note) => !FOOD_NOTE.test(note))
  }
  return notes.join(' ')
}

function voiceSizeBit(size: VoiceSize): string {
  return voiceSizePitch(size)
}

function softFoleyAudioBlock(family: SuggestIntentFamily): string {
  if (family === 'no' || family === 'quiet') {
    return (
      'AUDIO (read first): Soft-vocal. Soft Foley wanted: faint breath, paw on rug, soft tail swish. ' +
      'No lick, no treat or food sounds. ' +
      'Hard ban: bark, howl, music, speech, talking, ambience, heavy whine, growl. Keep it very quiet. No soundtrack.'
    )
  }
  return (
    'AUDIO (read first): Soft-vocal. Soft Foley wanted: faint breath, soft mouth/lick sounds, paw on rug, soft tail swish. ' +
    'Hard ban: bark, howl, music, speech, talking, ambience, heavy whine, growl. Keep it very quiet. No soundtrack.'
  )
}

function audioBlock(
  personality: DogPersonality,
  options: { allowHowl: boolean; allowPlayHuff: boolean; softFoley: boolean; family: SuggestIntentFamily },
): string {
  const pitch = voiceSizeBit(personality.voiceSize)
  const style: VocalStyle = personality.vocalStyle

  if (options.allowHowl) {
    const sized = style === 'silent' ? 'dog howl or husky song' : `${pitch} dog howl or husky song`
    return (
      `AUDIO (read first): Howl/sing clip — a brief ${sized} is allowed. ` +
      'Hard ban: bark, speech, talking, music, ambience. No human words.'
    )
  }

  if (options.allowPlayHuff) {
    return (
      'AUDIO (read first): Play clip — one short challenge huff only (sneeze-like chuff; the common way dogs ask to play-fight). ' +
      'Not a bark. Hard ban: bark, howl, music, speech, ambience.'
    )
  }

  if (options.softFoley) {
    return softFoleyAudioBlock(options.family)
  }

  if (style === 'barks') {
    return (
      `AUDIO (read first): Barking dog — brief ${pitch} barks are allowed. ` +
      'Hard ban: howl, music, speech, talking, ambience.'
    )
  }

  if (style === 'howler') {
    return (
      `AUDIO (read first): Howler — a brief ${pitch} howl or aroo is allowed as this dog's voice. ` +
      'Hard ban: bark, music, speech, talking, ambience.'
    )
  }

  if (style === 'talker') {
    return (
      'AUDIO (read first): Talker (experimental): a few clear English words may be spoken — labeled experimental; keep it brief and on-character. ' +
      'Hard ban: music, ambience, cartoon overacting. Not a song.'
    )
  }

  return (
    'AUDIO (read first): Silence-first. Hard ban: bark, howl, whine, growl, music, speech, ambience. ' +
    'Optional only: faint breath, soft paw on rug. Mouth closed. Express via face and body, not sound. ' +
    'remarkably non-vocal.'
  )
}

function mouthBit(personality: DogPersonality, closed: boolean): string {
  if (personality.mouth === 'slobberer') {
    return closed
      ? 'a little slobber is ok; mouth mostly closed'
      : 'a little slobber/drool is ok'
  }
  return closed ? 'mouth closed, dry muzzle' : 'dry muzzle'
}

function hugBeat(dogName: string, personality: DogPersonality): string {
  const eyes = eyePhrase(personality.eyes)
  if (personality.touch === 'grumble_hug') {
    return (
      `${dogName} does not enjoy hugs: silent warning face — bares teeth, ears back, lips curled, ${eyes}. ` +
      `Not an attack, not a lunge. Mouth closed except enough to show teeth. Face and body only; no growl sound. ` +
      `${mouthBit(personality, true)}.`
    )
  }
  return (
    `${dogName} loves hugs: leans in, offers the neck with nose tilted up, enjoys a chest scratch, ${eyes}, ` +
    `${mouthBit(personality, true)}.`
  )
}

function howlBeat(dogName: string, personality: DogPersonality): string {
  const notes = personality.notes.join(' ')
  const pitch = voiceSizeBit(personality.voiceSize)
  if (/\b(awkward|weak|hesitant|failed|embarrassed)\b/i.test(notes)) {
    return (
      `${dogName} attempts to howl but it is awkward — hesitant, slightly off, mouth half-open, looking unsure; ` +
      'a cute failed howl rather than a full song. Weak, brief, slightly embarrassed attempt.'
    )
  }
  if (/\b(howls well|sings and howls|confident|full (musical )?husky howl)\b/i.test(notes)) {
    return (
      `${dogName} sings and howls well — head lifted, mouth open in a full confident howl/song. Strong, committed sing.`
    )
  }
  if (personality.vocalStyle === 'howler' || personality.energy === 'hyper') {
    return `${dogName} howls with commitment — head lifted, mouth open in a full ${pitch} howl/song.`
  }
  if (personality.vocalStyle === 'soft' || personality.energy === 'calm') {
    return `${dogName} offers a brief, hesitant ${pitch} howl — quiet and a little unsure.`
  }
  return `${dogName} lifts into a brief ${pitch} howl/sing, then returns to quiet.`
}

function playBeat(dogName: string, personality: DogPersonality): string {
  const energy = energyMotionPhrase(personality.energy)
  const energyBit = energy ? ` ${energy}` : ''
  return (
    `${dogName} asks to play-fight with a downward-dog play-bow: front low, rear up, expressive body, ` +
    `one short sneeze-like challenge huff — not a bark.${energyBit}`
  )
}

function traitFlavor(personality: DogPersonality): string {
  const parts = [eyePhrase(personality.eyes)]
  if (personality.energy === 'calm') parts.push('slow, calm energy')
  if (personality.energy === 'hyper') parts.push('hyperactive energy')
  if (personality.mouth === 'slobberer') parts.push('a slobberer')
  else parts.push('dry muzzle')
  return parts.join(', ')
}

function togetherHugBeat(softFoley: boolean): string {
  const close = softFoley
    ? 'Riley warning is visual (no growl). Soft Foley (breath, paw, tail) is ok.'
    : 'Silent warning / affection via face and body only.'
  return (
    'Together shot: Murphy leans in and offers his neck; Riley is wary and may bare teeth if her side is touched — ' +
    `keep both dogs in frame. ${close}`
  )
}

function togetherHowlBeat(): string {
  return (
    'Together shot: Murphy sings a full husky howl; Riley attempts an awkward weaker howl beside him. ' +
    'Same kitchen-rug framing, both faces toward camera.'
  )
}

function togetherPlayBeat(): string {
  return (
    'Together shot: both drop into play-bows (front low, rear up), expressive bodies. ' +
    'One short challenge huff/chuff to invite play-fight — not a bark. Keep both dogs in frame.'
  )
}

function unknownBeat(dogName: string, personality: DogPersonality): string {
  const eyes = eyePhrase(personality.eyes)
  const vibe =
    personality.eyes === 'goofy'
      ? 'warm and slightly goofy'
      : personality.eyes === 'alert'
        ? 'independent and slightly puzzled'
        : 'curious and a little unsure'
  const silent =
    personality.vocalStyle === 'silent' && !usesSoftFoleyAudio(dogName, personality.vocalStyle)
      ? 'Silent “huh?” — face and body only, mouth closed, no bark.'
      : 'Curious “huh?” face toward the camera.'
  return (
    `${dogName} did not understand: a classic curious head-tilt toward the camera, ${vibe}, ${eyes}, ` +
    `eyes on the phone. ${silent}`
  )
}

function togetherUnknownBeat(softFoley: boolean): string {
  const close = softFoley
    ? 'Keep both dogs in frame. Soft Foley ok; no bark.'
    : 'Keep both dogs in frame. Silent; face and body only.'
  return (
    'Together shot: both dogs cock their heads toward the camera as if they did not catch the words — ' +
    `curious “huh?” faces, eyes on the phone. ${close}`
  )
}

function holidayCostumeWalkMotion(
  spec: HolidayIntentSpec,
  together: boolean,
): string {
  if (together) {
    return (
      `Together shot: both dogs stay identifiable (Murphy left, Riley right). ` +
      `This exact pair walks off camera to the left side and instantly returns wearing ${spec.costume}, ` +
      `looks right at the camera as they walk off screen on the right, then instantly returns without any costume, ` +
      `still the exact same two dogs, and returns to the exact sitting positions in the source image. ` +
      `Do not swap coats or places. Keep both in frame whenever they are on screen.`
    )
  }
  return (
    `this exact dog walks off camera to the left side and instantly returns wearing ${spec.costume} ` +
    `and looks right at the camera as they walk off screen on the right, then instantly returns without any costume, ` +
    `still the exact same dog, and returns to the exact sitting position in the source image`
  )
}

function holidayDurationLine(): string {
  return (
    'Grok Imagine image-to-video, 10s, 9:16. One continuous shot — locked camera; only the dog moves. ' +
    'Costume walk (choose 10s or 15s in Grok Imagine; do not use 6s): walk off, return in costume, ' +
    'walk across with eye contact, return without costume to the exact sitting pose in the source still. ' +
    'Do not use the usual 6s react-then-idle arc.'
  )
}

/** Trait-driven hug / howl / play beats. Together-shot (Both) keeps the pair-specific lines. */
export function personalityBeat(
  dogName: string,
  intentId: string,
  personality: DogPersonality,
  options?: { allowHowl?: boolean; softFoley?: boolean; family?: SuggestIntentFamily },
): string {
  const traits = normalizePersonality(personality)
  const dog = dogKey(dogName)
  const family =
    options?.family ?? classifySuggestIntent({ intentId, intentDescription: '' })
  const hugLike = family === 'hug'
  const howlLike = family === 'howl'
  const playLike = family === 'play'
  const allowHowl = options?.allowHowl ?? howlLike
  const softFoley = options?.softFoley ?? usesSoftFoleyAudio(dogName, traits.vocalStyle)

  const unknownLike = family === 'unknown'
  const holiday = family === 'holiday' ? holidaySpecFor(intentId) : undefined

  if (dog === 'both' && hugLike) return togetherHugBeat(softFoley)
  if (dog === 'both' && howlLike && allowHowl) return togetherHowlBeat()
  if (dog === 'both' && playLike) return togetherPlayBeat()
  if (dog === 'both' && unknownLike) return togetherUnknownBeat(softFoley)
  if (dog === 'both' && holiday) {
    return (
      'Together memorial: keep Murphy (tan, folded ears, left) and Riley (black huskita, upright ears, right) identifiable. ' +
      'Do not swap coats or places.'
    )
  }

  if (hugLike) return hugBeat(dogName, traits)
  if (howlLike && allowHowl) return howlBeat(dogName, traits)
  if (playLike) return playBeat(dogName, traits)
  if (unknownLike) return unknownBeat(dogName, traits)

  const notes = personalityNotesForIntent(traits, { allowHowl, softFoley, family })
  const flavor = traitFlavor(traits)
  return [flavor, notes].filter(Boolean).join(' ')
}

function intentMotion(
  input: SuggestPromptInput,
  allowHowl: boolean,
  allowPlayHuff: boolean,
  personality: DogPersonality,
  softFoley: boolean,
  family: SuggestIntentFamily,
): string {
  const variant = input.slotLabel.trim()
  const variantBit = variant ? ` Variant beat: ${variant}.` : ''
  const openMouthTreat = family === 'treat' && softFoley && wantsOpenMouthOrExcited(input)
  const skipClosedMouth = allowHowl || allowPlayHuff || openMouthTreat
  const silent = skipClosedMouth ? '' : ' Mouth closed. Face and body only.'
  const energy = energyMotionPhrase(personality.energy)
  const energyBit = energy ? ` ${energy}` : ''
  const holiday = family === 'holiday' ? holidaySpecFor(input.intentId, input.intentDescription) : undefined
  if (holiday) {
    const together = dogKey(input.dogName) === 'both'
    return `${holidayCostumeWalkMotion(holiday, together)}${energyBit}${variantBit}`
  }

  const motions: Partial<Record<SuggestIntentFamily, string>> = {
    treat: `Ears perk, eyes lock on an implied treat, slight eager lean, maybe a brief lick — food-interest while looking at the phone camera.${silent}`,
    hug: `Small FaceTime-scale hug reaction: body-language change when asked for a hug or when a hand touches the side.${silent}`,
    howl: allowHowl
      ? 'Head lifts into a howl or sing, mouth opening, still framed as a short FaceTime reaction — not a wide shot.'
      : `Ears perk and look toward camera only.${silent}`,
    come: `Ears perk and eye contact only: head tilt and eager lean toward the camera as if recalling. Stay in portrait; do not walk out of frame.${silent}`,
    here: `Ears perk and eye contact only: glance toward the speaker/camera, ears orient this way. Attention shift, not a full recall.${silent}`,
    name: `Ears perk and eye contact only: ears forward, a small head lift of recognition toward the phone.${silent}`,
    owner: `Ears perk and eye contact only: soft recognition of the familiar person, lean in, warm eyes.${silent}`,
    good: `Happy praise reaction: soft proud eyes, a pleased wriggle or tail energy, relaxed expression.${silent}`,
    walk: `Alert walk excitement: ears up, bright eyes, a little body energy as if the leash or door was mentioned. Stay in frame.${silent}`,
    no: `Correction beat: ears back, pause, a guilty or settling expression. Small, readable, not cowering out of frame.${silent}`,
    play: allowPlayHuff
      ? 'Play-bow (downward-dog stretch): front low, rear up, expressive body, bright eyes. One short challenge huff/chuff as they drop into the bow — not a bark. Stay in portrait; not a zoomie.'
      : `Play-bow (downward-dog stretch): front low, rear up, expressive body, bright eyes. Stay in portrait; not a zoomie.${silent}`,
    quiet: `Settle and calm: breath slows, eyes soften, a quiet downshift while still facing the camera.${silent}`,
    unknown: `Classic curious dog head-tilt: ears perk, head cocks to one side as if asking “huh?”, face toward the phone camera. Small, readable, not a command reaction.${silent}`,
  }

  const mapped = motions[family]
  if (mapped) {
    return `${mapped}${energyBit}${variantBit}`
  }

  if (family === 'attention' || isAttentionStyleIntent(input)) {
    return `Ears perk and eye contact only while looking toward the phone camera.${silent}${energyBit}${variantBit}`
  }

  const description = input.intentDescription.trim() || input.intentId
  return `A short, readable “${description}” reaction while looking toward the phone camera.${silent}${energyBit}${variantBit}`
}

/** Always included: camera must stay still so idle playback does not need a framing reset. */
function lockedCameraBlock(): string {
  return (
    'LOCKED CAMERA: The camera is perfectly still. ' +
    'No pan, tilt, dolly, zoom, push-in, pull-out, handheld shake, or reframing. ' +
    'Framing is identical from the first frame to the last frame — the same crop as the source still. ' +
    'Only the subject (dog) moves.'
  )
}

function framingLine(input: SuggestPromptInput): string {
  const zoom = input.framing?.portrait?.focalZoom ?? 1
  const tight = zoom >= 1.35
  const crop = tight
    ? 'tighter face-forward portrait crop'
    : 'chest-up portrait FaceTime crop'

  if (input.hasSourcePhoto) {
    return `Use the attached source still as frame 1 and honor the ${crop}. Phone at chest height. Same crop as the still from first frame to last — camera perfectly still; only the dog moves.`
  }
  return `9:16 portrait FaceTime, phone at chest height, ${crop}. If a still is attached, use it as frame 1. Same crop first-to-last — camera perfectly still; only the dog moves.`
}

function breedLine(dogName: string, personality: DogPersonality): string {
  const breed = personality.breed.trim() || 'huskita (Husky × Akita mix)'
  const look = lookLine(dogName)
  const mix = `Keep this mix — do not morph into a pure Husky, pure Akita, or another breed.`
  if (look) return `${look} ${dogName} is a ${breed}. ${mix}`
  return `${dogName} is a ${breed}. ${mix}`
}

/** Seed identity: Riley is the black huskita; Murphy is the other dog. */
function lookLine(dogName: string): string {
  const dog = dogKey(dogName)
  if (dog === 'riley') {
    return 'Riley is the black huskita. Keep her black coat, face, and markings. She is not Murphy.'
  }
  if (dog === 'murphy') {
    return 'Murphy is the other huskita — not Riley (Riley is the black huskita). Keep his identity, coat, and face distinct from Riley. Do not turn him into the black huskita.'
  }
  if (dog === 'both') {
    return 'Together memorial: Murphy (tan/ginger huskita, folded ears) on the left and Riley (the black huskita, upright ears) on the right. Keep both dogs in frame and do not swap their coats or places.'
  }
  return ''
}

/**
 * Offline template + slot-specific composer.
 * Output is meant to paste into Grok Imagine image-to-video (also Pika / similar).
 * Does not call any API; GitHub Pages has no key, and SuperGrok ≠ xAI API.
 */
export function suggestClipPrompt(input: SuggestPromptInput): string {
  const dogName = input.dogName.trim() || 'the dog'
  const intentId = input.intentId.trim() || 'reaction'
  const intentDescription = input.intentDescription.trim() || intentId
  const personality = normalizePersonality(input.personality)
  const allowHowl = allowsHowlVocalization(input)
  const allowPlayHuff = allowsPlayHuff(input)
  const softFoley = usesSoftFoleyAudio(dogName, personality.vocalStyle)
  const family = classifySuggestIntent(input)
  const holiday = family === 'holiday'
  const beat = personalityBeat(dogName, intentId, personality, { allowHowl, softFoley, family })
  const motion = intentMotion(input, allowHowl, allowPlayHuff, personality, softFoley, family)
  const notes = input.userNotes?.trim()

  const lines = [
    audioBlock(personality, { allowHowl, allowPlayHuff, softFoley, family }),
    lockedCameraBlock(),
    holiday
      ? holidayDurationLine()
      : 'Grok Imagine image-to-video, 6s, 9:16. One continuous shot: reaction peaks in the first ~2–3 seconds, then return to a calm FaceTime idle and hold. Camera stays perfectly still; only the dog moves. Same crop first-to-last — no cut, no morph.',
    'Natural lighting, no text, no extra animals.',
    breedLine(dogName, personality),
    beat ? `Personality: ${beat}` : '',
    `Intent (${intentId}): ${intentDescription}. Motion: ${motion}`,
    notes ? `Director notes for this slot: ${notes}` : '',
    framingLine(input),
    'Preserve exact identity, face, coat, and markings from the source still. Same dog throughout. Reject breed morphing, identity drift, zooms, pans, and cuts. Repeat: camera perfectly still; identical framing first-to-last; only the dog moves.',
  ]

  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

/** True only if a real xAI API key is configured. SuperGrok in-app does not count. */
export function isLlmPromptPolishConfigured(): boolean {
  return Boolean(import.meta.env.VITE_XAI_API_KEY)
}

/**
 * Optional later path. Always returns the template prompt when no API key exists
 * (GitHub Pages / demo). Does not block Suggest prompt.
 */
export async function polishClipPromptIfConfigured(prompt: string): Promise<string> {
  if (!isLlmPromptPolishConfigured()) return prompt
  return prompt
}
