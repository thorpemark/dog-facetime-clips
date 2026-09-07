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
      'Riley does not enjoy hugs: when her side is touched or she is asked for a hug she bares her teeth and growls — a characteristic warning, not an attack. Ears back, lips curled, wary eyes, a soft growl. Keep it a warning, not a lunge.'
    )
  }
  if (dog === 'murphy' && hugLike) {
    return (
      'Murphy loves hugs: leans in, offers his neck with nose tilted up, enjoys a chest scratch, soft happy eyes, relaxed mouth.'
    )
  }
  if (dog === 'riley' && howlLike) {
    return (
      'Riley attempts to howl but it is awkward — hesitant, slightly off, mouth half-open, looking unsure; a cute failed howl rather than a full song. Weak, brief, slightly embarrassed attempt.'
    )
  }
  if (dog === 'murphy' && howlLike) {
    return (
      'Murphy sings and howls well — head lifted, mouth open in a full confident howl/song, musical husky voice. Strong, committed sing.'
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
    return `Use the attached source still as frame 1 and honor the ${crop}. Keep camera distance consistent (phone at chest height). Do not reframe into a landscape or wide shot.`
  }
  return `Portrait FaceTime framing (~9:16), phone at chest height, ${crop}. If a still is attached, use it as frame 1.`
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
    'Short 2–3 second silent clip. One continuous motion, no cuts, no morphing.',
    'Portrait FaceTime-style reaction, dog looking toward the phone camera, natural lighting, no text, no subtitles, no extra animals.',
    breedLine(dogName, input.personality),
    beat ? `Personality: ${beat}` : '',
    `Intent (${intentId}): ${intentDescription}.`,
    `Motion: ${motion}`,
    notes ? `Director notes for this slot: ${notes}` : '',
    framingLine(input),
    'Preserve exact identity, face, coat, and markings from the source still. Reject breed morphing and identity drift.',
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
