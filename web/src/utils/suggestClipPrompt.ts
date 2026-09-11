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

export interface SlotVocals {
  growl: boolean
  bark: boolean
  howl: boolean
  whine: boolean
}

interface Grammar {
  name: string
  subject: string
  object: string
  poss: string
  stay: string
  together: boolean
}

function normalizeIntent(intentId: string): string {
  return intentId.trim().toLowerCase()
}

function dogKey(name: string): string {
  return name.trim().toLowerCase()
}

function grammarFor(dogName: string): Grammar {
  const key = dogKey(dogName)
  const name = dogName.trim() || 'the dog'
  if (key === 'both') {
    return {
      name,
      subject: 'They',
      object: 'them',
      poss: 'their',
      stay: 'stay',
      together: true,
    }
  }
  if (key === 'riley' || key === 'murphy') {
    return { name, subject: 'He', object: 'him', poss: 'his', stay: 'stays', together: false }
  }
  return { name, subject: name, object: name, poss: `${name}'s`, stay: 'stays', together: false }
}

/** Parent intent only — slot labels / notes must not pick the family. */
function intentHaystack(intentId: string, intentDescription = ''): string {
  return `${intentId} ${intentDescription}`.toLowerCase()
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

const VOCAL_PATTERNS: Record<keyof SlotVocals, RegExp> = {
  growl: /\b(growls?|growling|rumbles?|rumbling|snarls?|snarling)\b/gi,
  bark: /\b(barks?|barking|woofs?|yaps?|yips?)\b/gi,
  howl: /\b(howls?|howling|sings?|singing|aroo+|awoo+|bays?|baying)\b/gi,
  whine: /\b(whines?|whining|whimpers?|whimpering)\b/gi,
}

function isNegatedMatch(text: string, matchIndex: number): boolean {
  const start = Math.max(0, matchIndex - 36)
  const before = text.slice(start, matchIndex)
  return /\b(no|not|never|without|don'?t|do not|hard ban|bans?)\b[^.!?\n]*$/i.test(before.trimEnd())
}

/** Slot notes request a vocal unless Mark negated it (no howl, never bark, …). */
export function parseSlotVocals(notes?: string): SlotVocals {
  const found: SlotVocals = { growl: false, bark: false, howl: false, whine: false }
  const text = notes?.trim() ?? ''
  if (!text) return found
  for (const kind of Object.keys(VOCAL_PATTERNS) as (keyof SlotVocals)[]) {
    const re = new RegExp(VOCAL_PATTERNS[kind].source, 'gi')
    let match: RegExpExecArray | null
    while ((match = re.exec(text))) {
      if (!isNegatedMatch(text, match.index)) {
        found[kind] = true
        break
      }
    }
  }
  return found
}

export type GazeYaw = 'left' | 'right'

export interface SlotGaze {
  /** Notes asked for gaze / side-eye / camera lock / muzzle yaw. */
  requested: boolean
  sideEye: boolean
  cameraLock: boolean
  lookAway: boolean
  /** Dog's left/right. Side-eye default is left (viewer's right). */
  muzzle: GazeYaw
  degrees: number
}

export const SLOT_NOTES_GAZE_HINT = 'GAZE: side-eye | camera lock | muzzle left/right'

function positiveMatch(text: string, pattern: RegExp): boolean {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    if (!isNegatedMatch(text, match.index)) return true
  }
  return false
}

/**
 * Slot notes: `GAZE: side-eye`, `side eye`, `sclera`, `camera lock`, `muzzle left/right`.
 * Bare `GAZE:` defaults to side-eye. `camera lock` alone does not add the 30° turn.
 */
export function parseSlotGaze(notes?: string): SlotGaze {
  const empty: SlotGaze = {
    requested: false,
    sideEye: false,
    cameraLock: false,
    lookAway: false,
    muzzle: 'left',
    degrees: 30,
  }
  const text = notes?.trim() ?? ''
  if (!text) return empty

  const tagged = /\bgaze\s*:/i.test(text)
  const sideEyeWords = positiveMatch(text, /\bside[-\s]?eyes?\b|\bsclera\b/i)
  const cameraLockWords = positiveMatch(
    text,
    /\bcamera\s*locks?\b|\beyes on (the )?lens\b|\bstare at (the )?camera\b/i,
  )
  const lookAwayWords = positiveMatch(text, /\blook(?:s|ing)? away\b/i)
  const muzzleRight = positiveMatch(text, /\bmuzzle right\b|\bto (his|her|their) right\b/i)
  const muzzleLeft = positiveMatch(text, /\bmuzzle left\b|\bto (his|her|their) left\b/i)
  const deg = text.match(/\b(\d{1,2})\s*(?:degrees?|°)\b/i)
  const degrees = deg ? Number(deg[1]) : 30

  const requested = tagged || sideEyeWords || cameraLockWords || lookAwayWords || muzzleLeft || muzzleRight
  const sideEye =
    sideEyeWords || muzzleLeft || muzzleRight || (tagged && !cameraLockWords && !lookAwayWords)

  return {
    requested,
    sideEye,
    cameraLock: cameraLockWords || sideEye,
    lookAway: lookAwayWords && !sideEye,
    muzzle: muzzleRight && !muzzleLeft ? 'right' : 'left',
    degrees: degrees >= 10 && degrees <= 60 ? degrees : 30,
  }
}

function possLower(grammar: Grammar): string {
  if (grammar.together) return 'their'
  if (grammar.subject === 'He') return 'his'
  return `${grammar.name}'s`
}

function yawPhrases(gaze: SlotGaze, grammar: Grammar): { dogWay: string; viewerWay: string } {
  const poss = possLower(grammar)
  if (gaze.muzzle === 'right') {
    return { dogWay: `${poss} right`, viewerWay: "viewer's left" }
  }
  return { dogWay: `${poss} left`, viewerWay: "viewer's right" }
}

function gazeMechanicsBlock(gaze: SlotGaze, grammar: Grammar): string {
  if (!gaze.requested) return ''
  const pupils = grammar.together ? "Each dog's pupils" : `${grammar.name}'s pupils`
  const subj = grammar.together ? 'They' : grammar.subject === 'He' ? 'He' : grammar.name
  const glance = grammar.together ? 'glance' : 'glances'
  const look = grammar.together ? 'look' : 'looks'
  const poss = grammar.together ? 'Their' : grammar.subject === 'He' ? 'His' : `${grammar.name}'s`

  if (gaze.sideEye) {
    const { dogWay, viewerWay } = yawPhrases(gaze, grammar)
    const snout = grammar.together
      ? `Their snouts / muzzles yaw about ${gaze.degrees} degrees to ${dogWay} (${viewerWay}).`
      : `${poss} snout / muzzle yaws about ${gaze.degrees} degrees to ${dogWay} (${viewerWay}).`
    const asTurn = grammar.together
      ? 'As the muzzles turn, the eyeballs counter-rotate in the sockets so the stare never leaves the lens.'
      : 'As the muzzle turns, the eyeballs counter-rotate in the sockets so the stare never leaves the lens.'
    const result = grammar.together
      ? 'Result: heads/snouts turn, eyes do not. You see more of one side of each face and a sliver of eye-white (sclera) — classic side-eye.'
      : 'Result: head/snout turns, eyes do not. You see more of one side of the face and a sliver of eye-white (sclera) — classic side-eye.'
    return (
      `GAZE MECHANICS (do this exactly): The camera lens is a fixed point in space. ` +
      `${pupils} stay aimed at that same point for all 6 seconds. ${snout} ${asTurn} ` +
      `${result} ${subj} never ${glance} away. ${subj} never ${look} where the snout points. ` +
      `Eyes and snout are not aimed the same direction after the turn.`
    )
  }

  if (gaze.cameraLock) {
    return (
      `GAZE MECHANICS (do this exactly): The camera lens is a fixed point in space. ` +
      `${pupils} stay aimed at that same point for all 6 seconds. Eyes on the lens. ` +
      `No 30-degree side-eye muzzle yaw unless also noted. ${subj} never ${glance} away.`
    )
  }

  if (gaze.lookAway) {
    return (
      `GAZE MECHANICS (do this exactly): ${subj} ${look} away from the camera lens (look-away). ` +
      `Not a side-eye; pupils leave the lens.`
    )
  }

  return ''
}

function gazeActionOverlay(gaze: SlotGaze, grammar: Grammar): { start: string; hold: string } {
  if (!gaze.requested) return { start: '', hold: '' }
  const subj = grammar.together ? 'They' : grammar.subject === 'He' ? 'He' : grammar.name
  const glance = grammar.together ? 'glance' : 'glances'
  if (gaze.sideEye) {
    const { dogWay, viewerWay } = yawPhrases(gaze, grammar)
    return {
      start:
        ` Muzzle yaws about ${gaze.degrees} degrees to ${dogWay} (${viewerWay}). ` +
        `Eyeballs counter-rotate in the sockets so the stare never leaves the lens; sclera visible — classic side-eye.`,
      hold: ` Pupils stay locked on the lens. Eyes do not look where the snout points. ${subj} never ${glance} away.`,
    }
  }
  if (gaze.cameraLock) {
    return {
      start: ` Pupils lock on the camera lens. Eyes on the lens; no 30-degree side-eye muzzle yaw.`,
      hold: ` Eyes stay on the lens. ${subj} never ${glance} away.`,
    }
  }
  if (gaze.lookAway) {
    return {
      start: ` Gaze looks away from the lens (look-away), not a side-eye.`,
      hold: ` Pupils stay off the lens.`,
    }
  }
  return { start: '', hold: '' }
}

/** Howl/sing intents, or slot notes that ask for howl|sing|aroo. */
export function allowsHowlVocalization(input: SuggestPromptInput): boolean {
  if (isHowlLikeIntent(input.intentId, input.intentDescription)) return true
  return parseSlotVocals(input.userNotes).howl
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
  return isPlayLikeIntent(input.intentId, input.intentDescription)
}

function isAttentionStyleIntent(intentId: string, intentDescription = ''): boolean {
  const intent = normalizeIntent(intentId)
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
    intentHaystack(intentId, intentDescription),
  )
}

function isHugLikeIntent(intentId: string): boolean {
  const intent = normalizeIntent(intentId)
  return intent.includes('hug') || intent.includes('cuddle') || intent.includes('snuggle')
}

/**
 * Treat / food-interest family. Parent intent id (and official description) only.
 * Slot labels such as “Lick / expectant” must not reclassify a no/hug/play slot.
 */
export function isTreatLikeIntent(intentId: string, intentDescription = ''): boolean {
  const intent = normalizeIntent(intentId)
  if (intent === 'treat' || intent.startsWith('treat-')) return true
  const desc = intentDescription.trim().toLowerCase()
  if (!desc) return false
  if (/trick[-\s]?or[-\s]?treat/.test(intent) || /trick[-\s]?or[-\s]?treat/.test(desc)) return false
  return /\b(treat|chicken|cookie|snack|nummies)\b/.test(desc)
}

/**
 * No / stop / correction family. Never use `includes('no')` — that matches `unknown`.
 * Slot labels (“Ears Back / Pause”) and notes do not pick this family.
 */
export function isNoLikeIntent(intentId: string, intentDescription = ''): boolean {
  const intent = normalizeIntent(intentId)
  if (isUnknownLikeIntent(intentId)) return false
  if (intent === 'no' || intent.startsWith('no-') || intent === 'stop' || intent.startsWith('stop-')) {
    return true
  }
  const desc = intentDescription.trim().toLowerCase()
  if (!desc) return false
  return /\b(no+|stop that|uh-?uh|uh oh|leave it|knock it off)\b/.test(desc)
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

function wantsOpenMouthOrExcited(intentId: string, intentDescription = ''): boolean {
  return isTreatLikeIntent(intentId, intentDescription)
}

function personalityNotesForIntent(
  personality: DogPersonality,
  options: { allowHowl: boolean; softFoley: boolean; treatLike: boolean; hugLike: boolean },
): string {
  let notes = personality.notes.map((note) => note.trim()).filter(Boolean)
  if (!options.allowHowl) {
    notes = notes.filter((note) => !/\b(howl|sing|aroo|awoo|bay|bark|growl|whine)\b/i.test(note))
  }
  if (!options.treatLike) {
    notes = notes.filter((note) => !/\b(treat|chicken|cookie|snack|lick|licks|nummies)\b/i.test(note))
  }
  if (!options.hugLike) {
    notes = notes.filter(
      (note) => !/\b(hug|hugs|bares teeth|warning face|chest scratch|offering his neck)\b/i.test(note),
    )
  }
  if (options.softFoley) {
    notes = notes.filter((note) => !/remarkably non-vocal|not sound/i.test(note))
  }
  return notes.join(' ')
}

function voiceSizeBit(size: VoiceSize): string {
  return voiceSizePitch(size)
}

function mouthBit(personality: DogPersonality, closed: boolean): string {
  if (personality.mouth === 'slobberer') {
    return closed ? 'a little slobber is ok; mouth mostly closed' : 'a little slobber/drool is ok'
  }
  return closed ? 'Mouth closed, dry muzzle' : 'dry muzzle'
}

function traitFlavor(personality: DogPersonality): string {
  const parts = [eyePhrase(personality.eyes)]
  if (personality.energy === 'calm') parts.push('slow, calm energy')
  if (personality.energy === 'hyper') parts.push('hyperactive energy')
  if (personality.mouth === 'slobberer') parts.push('a slobberer')
  else parts.push('dry muzzle')
  return parts.join(', ')
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

function isIdleLikeIntent(intentId: string): boolean {
  const intent = normalizeIntent(intentId)
  return intent === 'idle' || intent.startsWith('idle-')
}

function isTreatLikeLabel(text: string): boolean {
  return /\b(lick|licks|expectant|treat|chicken|cookie|snack|food[-\s]?interest|mouth open|open mouth)\b/i.test(
    text,
  )
}

function variantBitFor(slotLabel: string, family: string | null): string {
  const variant = slotLabel.trim()
  if (!variant) return ''
  if (family !== 'treat' && isTreatLikeLabel(variant)) return ''
  return ` Variant beat: ${variant}.`
}

function motionFamily(input: SuggestPromptInput): string | null {
  const intent = normalizeIntent(input.intentId)
  const description = input.intentDescription
  if (isTreatLikeIntent(input.intentId, description)) return 'treat'
  if (isHugLikeIntent(input.intentId)) return 'hug'
  if (isHowlLikeIntent(input.intentId, description)) return 'howl'
  if (isPlayLikeIntent(input.intentId, description)) return 'play'
  if (isUnknownLikeIntent(input.intentId)) {
    return intent === 'confused' || intent.startsWith('confused-') ? 'confused' : 'unknown'
  }
  if (isNoLikeIntent(input.intentId, description)) return 'no'
  if (isIdleLikeIntent(input.intentId)) return 'idle'
  for (const id of ['come', 'here', 'name', 'owner', 'good', 'walk', 'quiet'] as const) {
    if (intent === id || intent.startsWith(`${id}-`)) return id
  }
  return null
}

interface SoundPlan {
  realAudio: boolean
  silenceFirst: boolean
  softFoley: boolean
  growl: boolean
  bark: boolean
  howl: boolean
  whine: boolean
  playHuff: boolean
  talker: boolean
  barkerStyle: boolean
  howlerStyle: boolean
}

function soundPlanFor(input: SuggestPromptInput, personality: DogPersonality): SoundPlan {
  const notes = parseSlotVocals(input.userNotes)
  const howlIntent = isHowlLikeIntent(input.intentId, input.intentDescription)
  const playHuff = allowsPlayHuff(input)
  const style: VocalStyle = personality.vocalStyle
  const softFoley = usesSoftFoleyAudio(input.dogName, style)
  const howl = howlIntent || notes.howl || style === 'howler'
  const bark = notes.bark || (style === 'barks' && !howlIntent)
  const growl = notes.growl
  const whine = notes.whine
  const talker = style === 'talker'
  const special = growl || bark || howl || whine || playHuff || talker
  const realAudio = special || softFoley
  return {
    realAudio,
    silenceFirst: !realAudio,
    softFoley: softFoley && !howlIntent,
    growl,
    bark,
    howl,
    whine,
    playHuff,
    talker,
    barkerStyle: style === 'barks',
    howlerStyle: style === 'howler',
  }
}

function banLine(plan: SoundPlan): string {
  const bans = ['No music. No speech.']
  if (!plan.talker) bans[0] = 'No music. No speech. No talking.'
  if (!plan.howl) bans.push('No howl.')
  if (!plan.bark) bans.push('No bark.')
  if (!plan.growl) bans.push('No growl.')
  if (!plan.whine) bans.push('No whine. No whimper.')
  else bans.push('No heavy whimper.')
  if (plan.howl && !plan.bark) {
    // howl intent / notes: ban bark unless also requested
  }
  return bans.join(' ')
}

function soundBlock(
  input: SuggestPromptInput,
  personality: DogPersonality,
  plan: SoundPlan,
  grammar: Grammar,
): string {
  const pitch = voiceSizeBit(personality.voiceSize)
  const dog = grammar.name
  const lines: string[] = ['SOUND:']

  if (plan.silenceFirst) {
    lines.push(
      'Silence-first. Hard ban: bark, howl, whine, growl, music, speech, ambience. ' +
        'Optional only: faint breath, soft paw on rug. Mouth closed. Express via face and body, not sound. ' +
        'remarkably non-vocal.',
    )
    lines.push(banLine(plan))
    return lines.join('\n')
  }

  if (plan.howl) {
    const sized =
      personality.vocalStyle === 'silent' && !parseSlotVocals(input.userNotes).howl
        ? 'dog howl or husky song'
        : `${pitch} dog howl or husky song`
    lines.push(
      `Howl/sing clip — a brief ${sized} is allowed. Close-mic. Then quiet again. No human words.`,
    )
    if (plan.howlerStyle && !isHowlLikeIntent(input.intentId, input.intentDescription)) {
      lines.push(`Howler — a brief ${pitch} howl or aroo is allowed as this dog's voice.`)
    }
  }

  if (plan.playHuff) {
    lines.push(
      'Play clip — one short challenge huff only (sneeze-like chuff; the common way dogs ask to play-fight). Not a bark.',
    )
  }

  if (plan.growl) {
    const who = grammar.together ? 'Riley' : dog
    const stepper = grammar.together ? 'they step back' : grammar.subject === 'He' ? 'he steps back' : `${dog} steps back`
    lines.push(
      `Close-mic dog foley on a rug: paw pads shifting as ${stepper}, soft tail swish. ` +
        `When the teeth show: one short low warning growl from ${who}. Not a long rumble. Not an attack roar. Then quiet again.`,
    )
  } else if (plan.bark) {
    lines.push(
      plan.barkerStyle
        ? `Barking dog — brief ${pitch} barks are allowed.`
        : `Brief bark from ${dog} as noted. Close-mic. Then quiet again.`,
    )
  } else if (plan.whine) {
    lines.push(`Brief ${pitch} whine as noted. Close-mic. Then quiet again.`)
  } else if (plan.talker && !plan.howl && !plan.playHuff) {
    lines.push(
      'Talker (experimental): a few clear English words may be spoken — labeled experimental; keep it brief and on-character. ' +
        'Hard ban: music, ambience, cartoon overacting. Not a song.',
    )
  } else if (plan.softFoley && !plan.howl && !plan.playHuff) {
    const lick = wantsOpenMouthOrExcited(input.intentId, input.intentDescription)
      ? 'faint breath, soft mouth/lick sounds, paw on rug, soft tail swish'
      : 'faint breath, paw pads on a rug, soft tail swish'
    lines.push(
      `Soft-vocal. Soft Foley wanted: ${lick}. Close-mic dog foley. Generate a real quiet track, not a silent file. ` +
        'Keep it very quiet. No soundtrack.',
    )
  } else if (!plan.howl && !plan.playHuff && !plan.talker) {
    lines.push('Close-mic dog foley on a rug: faint breath, paw pads, soft tail swish. Then quiet again.')
  }

  if (plan.softFoley && (plan.howl || plan.playHuff || plan.growl) && !plan.silenceFirst) {
    lines.push('Underneath: faint breath, paw on rug, soft tail swish is ok.')
  }

  lines.push(banLine(plan))
  return lines.join('\n')
}

function mustHaveAudioBlock(plan: SoundPlan): string {
  if (!plan.realAudio) return ''
  return 'MUST HAVE AUDIO. Generate a real audio track. Not silent.'
}

function lockedCameraBlock(grammar: Grammar): string {
  return (
    `LOCKED CAMERA: perfectly still. No pan, tilt, zoom, dolly, shake, or reframing. ` +
    `Framing identical first frame to last. Only the dog moves. ${grammar.subject} ${grammar.stay} fully in frame — ` +
    `small FaceTime-scale backup only, not a zoomie, not leaving the crop.`
  )
}

function noHumansBlock(grammar: Grammar): string {
  return (
    `NO HUMANS: no person, no hand, no arm, no finger entering the frame. ` +
    `Nobody hugs ${grammar.object} on camera.`
  )
}

function framingCrop(input: SuggestPromptInput): string {
  const zoom = input.framing?.portrait?.focalZoom ?? 1
  const tight = zoom >= 1.35
  return tight ? 'tighter face-forward portrait crop' : 'chest-up portrait FaceTime crop'
}

function durationHeader(input: SuggestPromptInput, holiday: boolean): string {
  const crop = framingCrop(input)
  const still = input.hasSourcePhoto
    ? 'Attached still is frame 1.'
    : 'If a still is attached, it is frame 1.'
  if (holiday) {
    return (
      `10 seconds, 9:16, Grok Imagine image-to-video. ${still} Same ${crop} first-to-last. ` +
      `Costume walk (choose 10s or 15s in Grok Imagine; do not use 6s): walk off, return in costume, ` +
      `walk across with eye contact, return without costume to the exact sitting pose in the source still. ` +
      `Do not use the usual 6s react-then-idle arc.`
    )
  }
  return `6 seconds, 9:16, Grok Imagine image-to-video. ${still} Same ${crop} first-to-last.`
}

function lookLine(dogName: string): string {
  const dog = dogKey(dogName)
  if (dog === 'riley') {
    return (
      'Riley is a male black huskita. Keep exact face, coat, and markings from the still. ' +
      'He is not Murphy. Do not change breed.'
    )
  }
  if (dog === 'murphy') {
    return (
      'Murphy is the other huskita — not Riley (Riley is the black huskita). ' +
      'Keep exact face, coat, and markings from the still. Keep his identity, coat, and face distinct from Riley. ' +
      'Do not turn him into the black huskita. Do not change breed.'
    )
  }
  if (dog === 'both') {
    return (
      'Together memorial: Murphy (tan/ginger huskita, folded ears) on the left and Riley (male black huskita, upright ears) on the right. ' +
      'Keep exact faces, coats, and markings from the still. Keep both dogs in frame and do not swap their coats or places. Do not change breed.'
    )
  }
  return ''
}

function breedLine(dogName: string, personality: DogPersonality): string {
  const breed = personality.breed.trim() || 'huskita (Husky × Akita mix)'
  const look = lookLine(dogName)
  const mix = `Keep this mix — do not morph into a pure Husky, pure Akita, or another breed.`
  if (look) return `${look} ${dogName} is a ${breed}. ${mix}`
  return `${dogName} is a ${breed}. Keep exact face, coat, and markings from the still. ${mix}`
}

function vocalLandHint(plan: SoundPlan): string {
  if (plan.growl) return ' (short low growl lands here)'
  if (plan.howl && !plan.playHuff) return ' (brief howl/sing lands here)'
  if (plan.playHuff) return ' (short challenge huff lands here)'
  if (plan.bark) return ' (brief bark lands here)'
  if (plan.whine) return ' (brief whine lands here)'
  return ''
}

function hugAction(
  dogName: string,
  personality: DogPersonality,
  plan: SoundPlan,
  grammar: Grammar,
  variantBit: string,
): [string, string, string] {
  const eyes = eyePhrase(personality.eyes)
  const land = plan.growl ? ' (short low growl lands here)' : ''
  if (grammar.together) {
    const warning = plan.growl
      ? 'Riley may bare teeth if his side is touched — short low warning growl lands here. Not an attack.'
      : 'Riley is wary and may bare teeth if his side is touched — Riley warning is visual (no growl). Soft Foley (breath, paw, tail) is ok.'
    return [
      'Together shot: Murphy leans in and offers his neck; Riley stays wary beside him. Keep both dogs in frame.',
      `${warning} Murphy stays cuddly. Keep both dogs in frame.${variantBit}`,
      'Both ease back to the exact source sits. Still looking toward camera. Keep both dogs in frame.',
    ]
  }
  if (personality.touch === 'grumble_hug') {
    const growlBit = plan.growl
      ? `One short low warning growl from ${dogName}. Not a long rumble. Not an attack roar.`
      : 'Face and body only; no growl sound.'
    return [
      `Sitting FaceTime idle from the still. Weight shifts on the rug; ears start back as if a hug or side-touch was mentioned. ${eyes}. Not an attack, not a lunge.`,
      `${dogName} does not enjoy hugs: silent warning face — bares teeth, ears back, lips curled, ${eyes}. Small FaceTime-scale step back.${land} ${growlBit} Mouth closed except enough to show teeth. ${mouthBit(personality, true)}.${variantBit}`,
      'Eases toward tense FaceTime idle. Still looking toward camera. Returns to the exact source sit.',
    ]
  }
  return [
    `${dogName} loves hugs: leans in, offers the neck with nose tilted up, ${eyes}.`,
    `Enjoys a chest scratch energy — warm wriggle in place. ${mouthBit(personality, true)}.${variantBit}`,
    'Settles back to the exact source sit, still looking toward camera.',
  ]
}

function howlAction(
  dogName: string,
  personality: DogPersonality,
  grammar: Grammar,
  variantBit: string,
): [string, string, string] {
  const notes = personality.notes.join(' ')
  const pitch = voiceSizeBit(personality.voiceSize)
  if (grammar.together) {
    return [
      'Together shot: both faces toward camera, same kitchen-rug framing. Breath in; heads start to lift. Keep both dogs in frame.',
      'Murphy sings a full husky howl; Riley attempts an awkward weaker howl beside him. (brief howl/sing lands here) Keep both dogs in frame.',
      'Songs end. Both return to the exact source sits, looking toward camera. Keep both dogs in frame.',
    ]
  }
  if (/\b(awkward|weak|hesitant|failed|embarrassed)\b/i.test(notes)) {
    return [
      `${dogName} breathes in; head starts to lift, looking unsure.`,
      `${dogName} attempts to howl but it is awkward — hesitant, slightly off, mouth half-open; a cute failed howl rather than a full song. Weak, brief, slightly embarrassed attempt. (brief howl/sing lands here)${variantBit}`,
      'Mouth closes. Returns to the exact source sit, still looking toward camera.',
    ]
  }
  if (/\b(howls well|sings and howls|confident|full (musical )?husky howl)\b/i.test(notes)) {
    return [
      `${dogName} breathes in; head lifts with commitment.`,
      `${dogName} sings and howls well — head lifted, mouth open in a full confident howl/song. Strong, committed sing. (brief howl/sing lands here)${variantBit}`,
      'Song ends. Returns to the exact source sit, still looking toward camera.',
    ]
  }
  if (personality.vocalStyle === 'howler' || personality.energy === 'hyper') {
    return [
      `${dogName} breathes in; head lifts.`,
      `${dogName} howls with commitment — head lifted, mouth open in a full ${pitch} howl/song. (brief howl/sing lands here)${variantBit}`,
      'Returns to the exact source sit, still looking toward camera.',
    ]
  }
  if (personality.vocalStyle === 'soft' || personality.energy === 'calm') {
    return [
      `${dogName} breathes in, a little unsure.`,
      `${dogName} offers a brief, hesitant ${pitch} howl — quiet and a little unsure. (brief howl/sing lands here)${variantBit}`,
      'Returns to the exact source sit, still looking toward camera.',
    ]
  }
  return [
    `${dogName} breathes in; head lifts.`,
    `${dogName} lifts into a brief ${pitch} howl/sing, then returns to quiet. (brief howl/sing lands here)${variantBit}`,
    'Returns to the exact source sit, still looking toward camera.',
  ]
}

function playAction(
  dogName: string,
  personality: DogPersonality,
  grammar: Grammar,
  variantBit: string,
): [string, string, string] {
  const energy = energyMotionPhrase(personality.energy)
  const energyBit = energy ? ` ${energy}` : ''
  if (grammar.together) {
    return [
      'Together shot: both brighten, weight shifts into a play invitation. Keep both dogs in frame.',
      'Together shot: both drop into play-bows (front low, rear up), expressive bodies. One short challenge huff/chuff to invite play-fight — not a bark. (short challenge huff lands here) Keep both dogs in frame.',
      'Both come up from the bows to the exact source sits, looking toward camera. Keep both dogs in frame.',
    ]
  }
  return [
    `${dogName} asks to play-fight: bright eyes, weight shifts. Stay in portrait; not a zoomie.${energyBit}`,
    `${dogName} asks to play-fight with a downward-dog play-bow: front low, rear up, expressive body, one short sneeze-like challenge huff — not a bark. (short challenge huff lands here)${variantBit}`,
    'Comes up from the bow to the exact source sit, still looking toward camera.',
  ]
}

function unknownAction(
  dogName: string,
  personality: DogPersonality,
  plan: SoundPlan,
  grammar: Grammar,
  variantBit: string,
): [string, string, string] {
  const eyes = eyePhrase(personality.eyes)
  const vibe =
    personality.eyes === 'goofy'
      ? 'warm and slightly goofy'
      : personality.eyes === 'alert'
        ? 'independent and slightly puzzled'
        : 'curious and a little unsure'
  if (grammar.together) {
    const close = plan.softFoley
      ? 'Keep both dogs in frame. Soft Foley ok; no bark.'
      : 'Keep both dogs in frame. Silent; face and body only.'
    return [
      'Together shot: both dogs look puzzled toward the phone. Keep both dogs in frame.',
      `Together shot: both dogs cock their heads toward the camera as if they did not catch the words — curious “huh?” faces, eyes on the phone. ${close}${variantBit}`,
      'Heads level back to the exact source sits. Keep both dogs in frame.',
    ]
  }
  const silent = plan.silenceFirst
    ? 'Silent “huh?” — face and body only, mouth closed, no bark.'
    : 'Curious “huh?” face toward the camera.'
  return [
    `${dogName} did not understand: ears perk, ${vibe}, ${eyes}, eyes on the phone.`,
    `Classic curious head-tilt toward the camera as if asking “huh?”. ${silent}${variantBit}`,
    'Head levels back to the exact source sit, still looking toward camera.',
  ]
}

function noAction(
  dogName: string,
  personality: DogPersonality,
  plan: SoundPlan,
  grammar: Grammar,
  variantBit: string,
): [string, string, string] {
  const eyes = eyePhrase(personality.eyes)
  if (grammar.together) {
    const close = plan.softFoley
      ? 'Soft Foley (breath, paw) is ok; no bark or growl.'
      : 'Silent; face and body only.'
    return [
      'Together shot: both dogs take a no/stop correction — ears back, a brief pause. Keep both dogs in frame. Not food interest, not a lick.',
      `Guilty settle or slight “uh oh” look at the camera. Keep both dogs in frame. ${close}${variantBit}`,
      'Both return to the exact source sits. Keep both dogs in frame.',
    ]
  }
  return [
    `${dogName} hears no/stop: ears go back, a brief pause. Correction only — not treat interest, not a lick, not expectant food. ${eyes}.`,
    `Correction beat: ears back, pause, a guilty or settling expression while looking at the camera. Small, readable, not cowering out of frame. Not treat interest, not a lick. Face and body only; no bark or growl. ${mouthBit(personality, true)}.${variantBit}`,
    'Returns to the exact source sit, still looking toward camera.',
  ]
}

function holidayCostumeWalkMotion(spec: HolidayIntentSpec, together: boolean): string {
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

function timedAction(
  input: SuggestPromptInput,
  personality: DogPersonality,
  plan: SoundPlan,
  grammar: Grammar,
): string {
  const family = motionFamily(input)
  const variantBit = variantBitFor(input.slotLabel, family)
  const energy = energyMotionPhrase(personality.energy)
  const energyBit = energy ? ` ${energy}` : ''
  const gaze = parseSlotGaze(input.userNotes)
  const gazeOverlay = gazeActionOverlay(gaze, grammar)
  const holiday = holidaySpecFor(input.intentId, input.intentDescription)
  if (holiday) {
    const together = dogKey(input.dogName) === 'both'
    const gazeWalk = gaze.requested
      ? gaze.sideEye
        ? ' When they look at the camera, use GAZE MECHANICS: muzzle yaw + eyeballs counter-rotate; pupils stay on the lens.'
        : ' When they look at the camera, use GAZE MECHANICS: pupils stay on the lens.'
      : ''
    return (
      `ACTION, one continuous shot (10s or 15s — do not use 6s):\n` +
      `${holidayCostumeWalkMotion(holiday, together)}${energyBit}${variantBit}${gazeWalk}`
    )
  }

  const land = vocalLandHint(plan)
  const skipClosedMouth =
    plan.howl ||
    plan.playHuff ||
    (plan.softFoley && wantsOpenMouthOrExcited(input.intentId, input.intentDescription))
  const silent = skipClosedMouth ? '' : ' Mouth closed. Face and body only.'
  const dogName = grammar.name
  const flavor = traitFlavor(personality)

  let beats: [string, string, string]
  if (family === 'hug') {
    beats = hugAction(dogName, personality, plan, grammar, variantBit)
  } else if (family === 'howl' && plan.howl) {
    beats = howlAction(dogName, personality, grammar, variantBit)
  } else if (family === 'play') {
    beats = playAction(dogName, personality, grammar, variantBit)
  } else if (family === 'unknown' || family === 'confused') {
    beats = unknownAction(dogName, personality, plan, grammar, variantBit)
  } else if (family === 'no') {
    beats = noAction(dogName, personality, plan, grammar, variantBit)
  } else if (family === 'treat') {
    beats = [
      `Ears perk, eyes lock on an implied treat, slight eager lean toward the phone camera.${energyBit}`,
      `Food-interest while looking at the phone camera — maybe a brief lick, sniff the air, expectant.${land}${variantBit}`,
      'Eases back to the exact source sit, still looking toward camera.',
    ]
  } else if (family === 'come') {
    beats = [
      `Ears perk and eye contact only: head orients toward the camera.${silent}${energyBit}`,
      `Head tilt and eager lean toward the camera as if recalling. Stay in portrait; do not walk out of frame.${land}${variantBit}`,
      'Eases to the exact source sit, still looking toward camera.',
    ]
  } else if (family === 'here') {
    beats = [
      `Ears perk and eye contact only: glance toward the speaker/camera.${silent}${energyBit}`,
      `Ears orient this way. Attention shift, not a full recall.${land}${variantBit}`,
      'Returns to the exact source sit, still looking toward camera.',
    ]
  } else if (family === 'name') {
    beats = [
      `Ears perk and eye contact only: ears forward toward the phone.${silent}${energyBit}`,
      `Small head lift of recognition toward the phone.${land}${variantBit}`,
      'Holds contact, then eases to the exact source sit.',
    ]
  } else if (family === 'owner') {
    beats = [
      `Ears perk and eye contact only: soft recognition of the familiar person.${silent}${energyBit}`,
      `Lean in, warm eyes.${land}${variantBit}`,
      'Returns to the exact source sit, still looking toward camera.',
    ]
  } else if (family === 'good') {
    beats = [
      `Happy praise reaction: soft proud eyes.${silent}${energyBit}`,
      `A pleased wriggle or tail energy, relaxed expression.${land}${variantBit}`,
      'Returns to the exact source sit, still looking toward camera.',
    ]
  } else if (family === 'walk') {
    beats = [
      `Alert walk excitement: ears up, bright eyes.${silent}${energyBit}`,
      `A little body energy as if the leash or door was mentioned. Stay in frame.${land}${variantBit}`,
      'Settles to the exact source sit, still looking toward camera.',
    ]
  } else if (family === 'quiet') {
    beats = [
      `Settle and calm: breath slows, eyes soften.${silent}${energyBit}`,
      `A quiet downshift while still facing the camera.${land}${variantBit}`,
      'Calm exact source sit, looking toward camera.',
    ]
  } else if (family === 'idle') {
    beats = [
      `Calm FaceTime hold from the still. ${flavor}.${silent}${energyBit}`,
      `Soft blink / faint breath. Stay in the same crop.${land}${variantBit}`,
      'Exact source sit, looking toward camera.',
    ]
  } else if (isAttentionStyleIntent(input.intentId, input.intentDescription)) {
    beats = [
      `Ears perk and eye contact only while looking toward the phone camera.${silent}${energyBit}`,
      `Small readable attention shift. Stay fully in frame.${land}${variantBit}`,
      'Returns to the exact source sit, still looking toward camera.',
    ]
  } else {
    const description = input.intentDescription.trim() || input.intentId
    beats = [
      `A short, readable “${description}” reaction while looking toward the phone camera.${silent}${energyBit}`,
      `Peak of the reaction, still fully in the crop.${land}${variantBit}`,
      'Returns to the exact source sit, still looking toward camera.',
    ]
  }

  return (
    `ACTION, one continuous shot:\n` +
    `0–2s: ${beats[0]}${gazeOverlay.start}\n` +
    `2–4s: ${beats[1]}${gazeOverlay.hold}\n` +
    `4–6s: ${beats[2]}${gazeOverlay.hold}`
  )
}

/**
 * Trait-driven hug / howl / play flavor. Together-shot (Both) keeps the pair-specific lines.
 * Kept for callers that want a compact beat; Suggest now folds this into timed ACTION.
 */
export function personalityBeat(
  dogName: string,
  intentId: string,
  personality: DogPersonality,
  options?: { allowHowl?: boolean; softFoley?: boolean; intentDescription?: string },
): string {
  const traits = normalizePersonality(personality)
  const description = options?.intentDescription ?? ''
  const fakeInput: SuggestPromptInput = {
    dogName,
    personality: traits,
    intentId,
    intentDescription: description,
    slotLabel: '',
  }
  const plan = soundPlanFor(fakeInput, traits)
  if (options?.allowHowl === false) plan.howl = false
  if (options?.softFoley === false) plan.softFoley = false
  const grammar = grammarFor(dogName)
  return timedAction(fakeInput, traits, plan, grammar)
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
  const resolved: SuggestPromptInput = {
    ...input,
    dogName,
    intentId,
    intentDescription,
    personality,
  }
  const plan = soundPlanFor(resolved, personality)
  const grammar = grammarFor(dogName)
  const gaze = parseSlotGaze(input.userNotes)
  const holiday = isHolidayLikeIntent(intentId, intentDescription)
  const notes = input.userNotes?.trim()
  const hugLike = isHugLikeIntent(intentId)
  const treatLike = isTreatLikeIntent(intentId, intentDescription)
  const character = personalityNotesForIntent(personality, {
    allowHowl: plan.howl,
    softFoley: plan.softFoley,
    treatLike,
    hugLike,
  })
  const flavor = traitFlavor(personality)

  const lines = [
    durationHeader(resolved, holiday),
    mustHaveAudioBlock(plan),
    soundBlock(resolved, personality, plan, grammar),
    lockedCameraBlock(grammar),
    noHumansBlock(grammar),
    breedLine(dogName, personality),
    flavor ? `Look: ${flavor}.` : '',
    character ? `Character: ${character}` : '',
    gazeMechanicsBlock(gaze, grammar),
    `Intent (${intentId}): ${intentDescription}.`,
    timedAction(resolved, personality, plan, grammar),
    notes ? `Director notes for this slot: ${notes}` : '',
    'Natural light. No text. No extra animals.',
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
