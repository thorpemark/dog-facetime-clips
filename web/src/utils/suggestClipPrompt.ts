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

function isMarksDog(dogName: string): boolean {
  const dog = dogKey(dogName)
  return dog === 'murphy' || dog === 'riley' || dog === 'both'
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

function isHugLikeIntent(intentId: string): boolean {
  const intent = normalizeIntent(intentId)
  return intent.includes('hug') || intent.includes('cuddle') || intent.includes('snuggle')
}

/** Drop vocal personality lines so they cannot leak into name / treat / come prompts. */
function personalityNotesForIntent(personality: DogPersonality, allowHowl: boolean): string {
  const notes = personality.notes.map((note) => note.trim()).filter(Boolean)
  if (allowHowl) return notes.join(' ')
  return notes.filter((note) => !/\b(howl|sing|aroo|awoo|bay|bark|growl|whine)\b/i.test(note)).join(' ')
}

function audioBlock(
  dogName: string,
  options: { allowHowl: boolean; allowPlayHuff: boolean },
): string {
  if (options.allowHowl) {
    return (
      'AUDIO (read first): Howl/sing clip — a brief dog howl or husky song is allowed. ' +
      'Hard ban: bark, speech, talking, music, ambience. No human words.'
    )
  }
  if (options.allowPlayHuff) {
    return (
      'AUDIO (read first): Play clip — one short challenge huff only (sneeze-like chuff; the common way dogs ask to play-fight). ' +
      'Not a bark. Hard ban: bark, howl, music, speech, ambience.'
    )
  }
  const marks = isMarksDog(dogName)
    ? ' Murphy and Riley are remarkably non-vocal; they express via face and body.'
    : ''
  return (
    'AUDIO (read first): Silence-first. Hard ban: bark, howl, whine, growl, music, speech, ambience. ' +
    'Optional only: faint breath, soft paw on rug. Mouth closed. Express via face and body, not sound.' +
    marks
  )
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
  const playLike = isPlayLikeIntent(intentId)
  const allowHowl = options?.allowHowl ?? howlLike

  if (dog === 'riley' && hugLike) {
    return (
      'Riley does not enjoy hugs: silent warning face — bares her teeth, ears back, lips curled, wary eyes. ' +
      'Not an attack, not a lunge. Mouth closed except enough to show teeth. Face and body only; no growl sound.'
    )
  }
  if (dog === 'murphy' && hugLike) {
    return (
      'Murphy loves hugs: leans in, offers his neck with nose tilted up, enjoys a chest scratch, soft happy eyes, mouth closed.'
    )
  }
  if (dog === 'riley' && howlLike && allowHowl) {
    return (
      'Riley attempts to howl but it is awkward — hesitant, slightly off, mouth half-open, looking unsure; a cute failed howl rather than a full song. Weak, brief, slightly embarrassed attempt.'
    )
  }
  if (dog === 'murphy' && howlLike && allowHowl) {
    return (
      'Murphy sings and howls well — head lifted, mouth open in a full confident howl/song. Strong, committed sing.'
    )
  }
  if (dog === 'both' && hugLike) {
    return (
      'Together shot: Murphy leans in and offers his neck; Riley is wary and may bare teeth if her side is touched — keep both dogs in frame. Silent warning / affection via face and body only.'
    )
  }
  if (dog === 'both' && howlLike && allowHowl) {
    return (
      'Together shot: Murphy sings a full husky howl; Riley attempts an awkward weaker howl beside him. Same kitchen-rug framing, both faces toward camera.'
    )
  }
  if (dog === 'riley' && playLike) {
    return (
      'Riley asks to play-fight with a downward-dog play-bow: front low, rear up, expressive body, one short sneeze-like challenge huff — not a bark.'
    )
  }
  if (dog === 'murphy' && playLike) {
    return (
      'Murphy asks to play-fight with a downward-dog play-bow: front low, rear up, expressive body, one short sneeze-like challenge huff — not a bark.'
    )
  }
  if (dog === 'both' && playLike) {
    return (
      'Together shot: both drop into play-bows (front low, rear up), expressive bodies. One short challenge huff/chuff to invite play-fight — not a bark. Keep both dogs in frame.'
    )
  }

  return personalityNotesForIntent(personality, allowHowl)
}

function intentMotion(input: SuggestPromptInput, allowHowl: boolean, allowPlayHuff: boolean): string {
  const intent = normalizeIntent(input.intentId)
  const variant = input.slotLabel.trim()
  const variantBit = variant ? ` Variant beat: ${variant}.` : ''
  const silent = allowHowl || allowPlayHuff ? '' : ' Mouth closed. Face and body only.'

  const motions: Record<string, string> = {
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
  }

  for (const [id, motion] of Object.entries(motions)) {
    if (intent === id || intent.startsWith(`${id}-`)) {
      return `${motion}${variantBit}`
    }
  }

  if (isAttentionStyleIntent(input)) {
    return `Ears perk and eye contact only while looking toward the phone camera.${silent}${variantBit}`
  }

  const description = input.intentDescription.trim() || input.intentId
  return `A short, readable “${description}” reaction while looking toward the phone camera.${silent}${variantBit}`
}

function framingLine(input: SuggestPromptInput): string {
  const zoom = input.framing?.portrait?.focalZoom ?? 1
  const tight = zoom >= 1.35
  const crop = tight
    ? 'tighter face-forward portrait crop'
    : 'chest-up portrait FaceTime crop'

  if (input.hasSourcePhoto) {
    return `Use the attached source still as frame 1 and honor the ${crop}. Locked 9:16, phone at chest height. Same framing for the whole 6s — no zoom, no pan, no cut, no morph.`
  }
  return `Locked 9:16 portrait FaceTime framing, phone at chest height, ${crop}. If a still is attached, use it as frame 1. Same framing for the whole 6s — no zoom, no pan, no cut, no morph.`
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
  const allowHowl = allowsHowlVocalization(input)
  const allowPlayHuff = allowsPlayHuff(input)
  const beat = personalityBeat(dogName, intentId, input.personality, { allowHowl })
  const motion = intentMotion(input, allowHowl, allowPlayHuff)
  const notes = input.userNotes?.trim()

  const lines = [
    audioBlock(dogName, { allowHowl, allowPlayHuff }),
    'Grok Imagine image-to-video, 6s, 9:16. One continuous shot: reaction peaks in the first ~2–3 seconds, then return to a calm FaceTime idle and hold. Same dog, same framing — no zoom, no pan, no cut, no morph.',
    'Natural lighting, no text, no extra animals.',
    breedLine(dogName, input.personality),
    beat ? `Personality: ${beat}` : '',
    `Intent (${intentId}): ${intentDescription}. Motion: ${motion}`,
    notes ? `Director notes for this slot: ${notes}` : '',
    framingLine(input),
    'Preserve exact identity, face, coat, and markings from the source still. Same dog throughout. Reject breed morphing, identity drift, zooms, and cuts.',
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
