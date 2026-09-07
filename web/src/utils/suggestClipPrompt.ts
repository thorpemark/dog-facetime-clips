import type { DogPersonality } from '../types/clipStudio'
import type { DualFraming } from './focalPoint'

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

/** True only for howl/sing intents, or an explicit “responds to a howl” director note. */
export function allowsHowlVocalization(input: SuggestPromptInput): boolean {
  if (isHowlLikeIntent(input.intentId, input.intentDescription)) return true
  return /responds to a howl|respond to a howl/.test((input.userNotes ?? '').toLowerCase())
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

function isHugLikeIntent(intentId: string): boolean {
  const intent = normalizeIntent(intentId)
  return intent.includes('hug') || intent.includes('cuddle') || intent.includes('snuggle')
}

/** Drop howl/hug personality lines so they cannot leak into the wrong intent. */
function personalityNotesForIntent(
  personality: DogPersonality,
  allowHowl: boolean,
  hugLike: boolean,
): string {
  let notes = personality.notes.map((note) => note.trim()).filter(Boolean)
  if (!allowHowl) {
    notes = notes.filter((note) => !/\b(howl|sing|aroo|awoo|bay)\b/i.test(note))
  }
  if (!hugLike) {
    notes = notes.filter((note) => !/\b(hug|cuddle|snuggle|growl)\b/i.test(note))
  }
  return notes.join(' ')
}

/** Riley / Murphy hug + howl beats — always used when the dog + intent match. */
export function personalityBeat(
  dogName: string,
  intentId: string,
  personality: DogPersonality,
  options?: { allowHowl?: boolean },
): string {
  const dog = dogKey(dogName)
  const intent = normalizeIntent(intentId)
  const hugLike = isHugLikeIntent(intent)
  const howlLike = isHowlLikeIntent(intentId)
  const allowHowl = options?.allowHowl ?? howlLike

  if (dog === 'riley' && hugLike) {
    return (
      'Riley does not enjoy hugs: when her side is touched or she is asked for a hug she bares her teeth — a grumble-hug visual protest, not an attack. Ears back, lips curled, wary eyes; mouth just open enough to show teeth. Soft visual warning only — no bark, growl, or howl. Peak in the first ~2–3 seconds, then lips and ears ease; she returns to a calm FaceTime idle looking at the camera and holds it.'
    )
  }
  if (dog === 'murphy' && hugLike) {
    return (
      'Murphy loves hugs: melts in, offers his neck with nose tilted up, enjoys a chest scratch, soft happy eyes, mouth closed. Peak the melt in the first ~2–3 seconds, then he settles back to a calm happy FaceTime idle and holds it. No bark or howl.'
    )
  }
  if (dog === 'riley' && howlLike && allowHowl) {
    return (
      'Riley attempts to howl but it is awkward — hesitant, slightly off, mouth half-open, looking unsure; a cute failed howl rather than a full song. Peak the awkward howl in the first ~2–3 seconds, then her mouth closes and she returns to a calm FaceTime idle looking at the camera and holds it. Howl attempt is allowed; still no English or mouthed words.'
    )
  }
  if (dog === 'murphy' && howlLike && allowHowl) {
    return (
      'Murphy sings and howls well — head lifted, mouth open in a full confident howl/song. Strong, committed sing. Peak the howl in the first ~2–3 seconds, then his head lowers, mouth closes, and he returns to a calm FaceTime idle and holds it. Howl/sing is allowed; still no English or mouthed words.'
    )
  }
  if (dog === 'both' && hugLike) {
    return (
      'Together shot: Murphy leans in and melts; Riley is wary and may bare teeth if her side is touched — keep both dogs in frame. Riley’s protest is visual only (no bark or growl). Peak those opposite hug reactions in the first ~2–3 seconds, then both settle back to a calm FaceTime idle looking toward the camera and hold it. Neither dog howls or talks.'
    )
  }
  if (dog === 'both' && howlLike && allowHowl) {
    return (
      'Together shot: Murphy sings a full husky howl; Riley attempts an awkward weaker howl beside him. Same kitchen-rug framing, both faces toward camera. Peak the pair howl in the first ~2–3 seconds, then mouths close and both return to a calm FaceTime idle and hold it. Howl/sing is allowed; neither speaks English or mouths human words.'
    )
  }

  return personalityNotesForIntent(personality, allowHowl, hugLike)
}

function variantBeat(slotLabel: string, allowHowl: boolean): string {
  let variant = slotLabel.trim()
  if (!variant) return ''
  if (!allowHowl) {
    variant = variant.replace(/\bmouth open\b/gi, 'mouth closed')
  }
  return ` Variant beat: ${variant}.`
}

function intentMotion(input: SuggestPromptInput, allowHowl: boolean): string {
  const intent = normalizeIntent(input.intentId)
  const variantBit = variantBeat(input.slotLabel, allowHowl)
  const noHowl = allowHowl ? '' : ' Does not howl, bay, or sing. Mouth closed.'

  const motions: Record<string, string> = {
    treat:
      `Ears perk, eyes lock on an implied treat, slight eager lean or foot fidget — food-interest with face and body, mouth closed.${noHowl}`,
    hug: 'Small FaceTime-scale hug reaction: body language when asked for a hug or when a hand touches the side. Face + body only. Not a howl.',
    howl: allowHowl
      ? 'Head lifts into a howl or sing, mouth opening, still a short FaceTime reaction — not a wide shot. Howl/sing is allowed; no human words.'
      : `Ears perk and look toward camera only.${noHowl}`,
    come: `Ears perk and eye contact only: head tilt and eager lean toward the camera as if recalling, a small weight-shift or step forward. Stay in portrait; do not walk out of frame.${noHowl}`,
    here: `Ears perk and eye contact only: glance toward the speaker/camera, ears orient this way. Attention shift, not a full recall.${noHowl}`,
    name: `Ears perk and eye contact only: ears forward, a small head lift of recognition toward the phone. No other performance.${noHowl}`,
    owner: `Ears perk and eye contact only: soft recognition of the familiar person, lean in, warm eyes, a subtle happy shift toward the camera.${noHowl}`,
    good: `Happy praise reaction: soft proud eyes, a pleased wriggle or tail energy, relaxed expression, mouth closed.${noHowl}`,
    walk: `Alert walk excitement: ears up, bright eyes, a little body energy as if the leash or door was mentioned. Stay in frame. Mouth closed.${noHowl}`,
    no: `Correction beat: ears back, pause, a guilty or settling expression. Small, readable, not cowering out of frame. Mouth closed.${noHowl}`,
    play: `Play energy: bouncy, play-bow hint, bright eyes. Keep it a short portrait reaction, not a full zoomie. Mouth closed.${noHowl}`,
    quiet: `Settle and calm: eyes soften, a quiet downshift while still facing the camera. Mouth closed.${noHowl}`,
  }

  for (const [id, motion] of Object.entries(motions)) {
    if (intent === id || intent.startsWith(`${id}-`)) {
      return `${motion}${variantBit}`
    }
  }

  if (isAttentionStyleIntent(input)) {
    return `Ears perk and eye contact only while looking toward the phone camera.${noHowl}${variantBit}`
  }

  const description = input.intentDescription.trim() || input.intentId
  const howlBit = allowHowl ? '' : noHowl
  return `A short, readable “${description}” reaction while looking toward the phone camera.${howlBit}${variantBit}`
}

function framingLine(input: SuggestPromptInput): string {
  const zoom = input.framing?.portrait?.focalZoom ?? 1
  const tight = zoom >= 1.35
  const crop = tight
    ? 'tighter face-forward portrait crop'
    : 'chest-up portrait FaceTime crop'

  if (input.hasSourcePhoto) {
    return `Use the attached source still as frame 1 and honor the ${crop}. Locked 9:16 portrait, phone at chest height. Same framing for the whole 6s — no zoom, no pan, no cut, no morph.`
  }
  return `Locked 9:16 portrait FaceTime framing, phone at chest height, ${crop}. If a still is attached, use it as frame 1. Same framing for the whole 6s — no zoom, no pan, no cut, no morph.`
}

/** Shared 6s Grok Imagine arc: idle → peak reaction → return to idle and hold. */
function clipArcLines(): string[] {
  return [
    'Grok Imagine image-to-video: 6 second clip, 9:16 portrait. (Length choices are 6 / 10 / 15s — choose 6s.)',
    'Arc — react then idle. One continuous shot: same dog, same framing, no zoom, no cut, no morph.',
    'Start near calm FaceTime idle from the still (looking toward camera, soft blinks). Reaction peaks in the first ~2–3 seconds. Then return to a calm FaceTime idle and hold through the end. Tiny live motion; do not keep reacting until the last frame.',
  ]
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
    return 'Murphy is the other huskita (tan/ginger, folded ears) — not Riley (Riley is the black huskita). Keep his identity, coat, and face distinct from Riley. Do not turn him into the black huskita.'
  }
  if (dog === 'both') {
    return 'Together memorial: Murphy (tan/ginger huskita, folded ears) on the left and Riley (the black huskita, upright ears) on the right. Keep both dogs in frame and do not swap their coats or places.'
  }
  return ''
}

const AUDIO_HARD_NEGS =
  'No bark, no howling, no bay, no whine, no growl, no music, no speech, no dialogue, no talking, no English, no lip-sync, no TV/kitchen/street ambience.'

function vocalOpenLines(input: SuggestPromptInput, allowHowl: boolean): string[] {
  const attention = isAttentionStyleIntent(input) && !allowHowl
  const hug = isHugLikeIntent(input.intentId)

  if (allowHowl) {
    return [
      'AUDIO (read first): Howl/sing clip — a dog howl or husky song is allowed. Still no bark, no whine, no growl, no music, no speech, no dialogue, no talking, no English, no lip-sync, no TV/kitchen/street ambience. No talking dog.',
    ]
  }

  const lines = [
    `AUDIO (read first): Silence preferred. ${AUDIO_HARD_NEGS} Optional only: faint breath or a soft paw on rug.`,
    'This is NOT a howl clip. Face + body only (ears, eyes, head, weight shift, foot fidget). Mouth closed.',
  ]

  if (attention) {
    lines.push('Attention / name / come / eye-contact / perk-up: ears perk + eye contact only. The dog does not howl.')
  }
  if (hug) {
    lines.push(
      'Hug: visual protest only if the personality calls for it (teeth, ears back). Still no bark, growl, or howl.',
    )
  }

  return lines
}

function vocalCloseLine(allowHowl: boolean): string {
  if (allowHowl) {
    return 'Repeat: no dialogue, no talking, no English words. Dog howl/sing only — never a talking dog.'
  }
  return 'Repeat: silence-first. No bark, no howling, no bay, no whine, no growl, no music, no speech, no dialogue, no talking. Mouth closed.'
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
  const allowHowl = allowsHowlVocalization(input)
  const beat = personalityBeat(dogName, intentId, input.personality, { allowHowl })
  const motion = intentMotion(input, allowHowl)
  const notes = input.userNotes?.trim()

  const lines = [
    'Image-to-video prompt for Grok Imagine (also works in Pika / similar tools).',
    ...vocalOpenLines(input, allowHowl),
    ...clipArcLines(),
    'Natural lighting, no text, no extra animals.',
    breedLine(dogName, input.personality),
    beat ? `Personality: ${beat}` : '',
    `Intent (${intentId}): ${intentDescription}.`,
    `Motion (the peak in the first ~2–3 seconds, then return to idle): ${motion}`,
    notes ? `Director notes for this slot: ${notes}` : '',
    framingLine(input),
    'Preserve exact identity, face, coat, and markings from the source still. Same dog throughout. Reject breed morphing, identity drift, zooms, and cuts.',
    vocalCloseLine(allowHowl),
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
