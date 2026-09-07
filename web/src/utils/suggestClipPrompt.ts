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

/** Riley / Murphy hug + howl beats — always used when the dog + intent match. */
export function personalityBeat(
  dogName: string,
  intentId: string,
  personality: DogPersonality,
): string {
  const dog = dogKey(dogName)
  const intent = normalizeIntent(intentId)
  const hugLike = intent.includes('hug') || intent.includes('cuddle') || intent.includes('snuggle')
  const howlLike = intent.includes('howl') || intent.includes('sing')

  if (dog === 'riley' && hugLike) {
    return (
      'Riley does not enjoy hugs: when her side is touched or she is asked for a hug she bares her teeth and growls — a characteristic warning, not an attack. Ears back, lips curled, wary eyes, a soft growl. Keep it a warning, not a lunge. Peak that warning in the first ~2–3 seconds, then lips and ears ease; she returns to a calm FaceTime idle looking at the camera and holds it through the end of the clip.'
    )
  }
  if (dog === 'murphy' && hugLike) {
    return (
      'Murphy loves hugs: leans in, offers his neck with nose tilted up, enjoys a chest scratch, soft happy eyes, relaxed mouth. Peak that affection in the first ~2–3 seconds, then he settles back to a calm happy FaceTime idle (looking toward camera, soft blinks, subtle breathing) and holds it through the end of the clip.'
    )
  }
  if (dog === 'riley' && howlLike) {
    return (
      'Riley attempts to howl but it is awkward — hesitant, slightly off, mouth half-open, looking unsure; a cute failed howl rather than a full song. Weak, brief, slightly embarrassed attempt. Peak the awkward howl in the first ~2–3 seconds, then her mouth closes and she returns to a calm FaceTime idle looking at the camera, holding that idle through the end of the clip.'
    )
  }
  if (dog === 'murphy' && howlLike) {
    return (
      'Murphy sings and howls well — head lifted, mouth open in a full confident howl/song, musical husky voice. Strong, committed sing. Peak the howl in the first ~2–3 seconds, then his head lowers, mouth closes, and he returns to a calm FaceTime idle (soft blinks, subtle breathing, looking toward camera) and holds it through the end of the clip.'
    )
  }

  const notes = personality.notes.map((note) => note.trim()).filter(Boolean)
  return notes.join(' ')
}

function intentMotion(intentId: string, intentDescription: string, slotLabel: string): string {
  const intent = normalizeIntent(intentId)
  const variant = slotLabel.trim()
  const variantBit = variant ? ` Variant beat: ${variant}.` : ''

  const motions: Record<string, string> = {
    treat:
      'Ears perk, eyes lock on an implied treat, slight eager lean, expectant mouth, maybe a quick lick — food-interest energy while still looking at the phone camera.',
    hug: 'Small FaceTime-scale hug reaction: body language change when asked for a hug or when a hand touches the side. Keep the motion readable in a chest-up portrait.',
    howl: 'Head lifts into a howl or sing, mouth opening, still framed as a short FaceTime reaction — not a wide shot.',
    come: 'Head tilt and eager lean toward the camera as if recalling, a small weight-shift or step forward. Stay in portrait; do not walk out of frame.',
    here: 'Glance and look toward the speaker/camera, ears orient this way. Attention shift, not a full recall.',
    name: 'Perk up at the name: eye contact, ears forward, a small head lift of recognition toward the phone.',
    owner: 'Soft recognition of the familiar person: lean in, warm eyes, a subtle happy shift toward the camera.',
    good: 'Happy praise reaction: soft proud eyes, a pleased wriggle or tail energy, relaxed open expression.',
    walk: 'Alert walk excitement: ears up, bright eyes, a little body energy as if the leash or door was mentioned. Stay in frame.',
    no: 'Correction beat: ears back, pause, a guilty or settling expression. Small, readable, not cowering out of frame.',
    play: 'Play energy: bouncy, play-bow hint, bright eyes. Keep it a short portrait reaction, not a full zoomie.',
    quiet: 'Settle and calm: breath slows, eyes soften, a quiet downshift while still facing the camera.',
  }

  for (const [id, motion] of Object.entries(motions)) {
    if (intent === id || intent.startsWith(`${id}-`)) {
      return `${motion}${variantBit}`
    }
  }

  const description = intentDescription.trim() || intentId
  return `A short, readable “${description}” reaction while looking toward the phone camera.${variantBit}`
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
    'Grok Imagine image-to-video: 6 second silent clip, 9:16 portrait. (Grok Imagine length choices are 6 / 10 / 15s — choose 6s.)',
    'Arc — react then return to idle. One continuous shot: same dog, same framing, no zoom, no cut, no morph.',
    '1. Start near calm FaceTime idle from the source still: looking toward the phone camera, soft blinks, subtle breathing.',
    '2. Reaction peaks in the first ~2–3 seconds (Motion / Personality below). Keep it FaceTime-scale and fully in frame.',
    '3. Smoothly return to a calm FaceTime idle (soft blinks, subtle breathing, looking toward camera) and hold that idle through the end of the 6-second clip. Do not freeze-frame; keep tiny live motion. Do not keep reacting until the last frame.',
  ]
}

function breedLine(dogName: string, personality: DogPersonality): string {
  const breed = personality.breed.trim() || 'huskita (Husky × Akita mix)'
  return `${dogName} is a ${breed}. Keep this mix — do not morph into a pure Husky, pure Akita, or another breed.`
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
  const beat = personalityBeat(dogName, intentId, input.personality)
  const motion = intentMotion(intentId, intentDescription, input.slotLabel)
  const notes = input.userNotes?.trim()

  const lines = [
    'Image-to-video prompt for Grok Imagine (also works in Pika / similar tools).',
    ...clipArcLines(),
    'Natural lighting, no text, no subtitles, no extra animals.',
    breedLine(dogName, input.personality),
    beat ? `Personality: ${beat}` : '',
    `Intent (${intentId}): ${intentDescription}.`,
    `Motion (the peak in the first ~2–3 seconds, then return to idle): ${motion}`,
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
