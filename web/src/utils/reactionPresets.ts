import type { MotionPreset } from '../types/memorial'

/** Maps keyword rule ids to photo motion presets (v1 stills; future: clip URLs). */
export const REACTION_PRESETS: Record<string, MotionPreset> = {
  name: 'excited',
  walk: 'perk',
  treat: 'excited',
  good: 'calm',
  no: 'calm',
  come: 'perk',
  here: 'perk',
  owner: 'excited',
  play: 'excited',
  quiet: 'calm',
  unknown: 'perk',
  confused: 'perk',
}

export function presetForRule(ruleId: string): MotionPreset {
  return REACTION_PRESETS[ruleId] ?? 'perk'
}

/** Photo index offset when a reaction fires — cycles through gallery. */
export function photoIndexForReaction(
  currentIndex: number,
  ruleId: string,
  photoCount: number,
): number {
  if (photoCount <= 1) return 0
  const offsets: Record<string, number> = {
    name: 1,
    walk: 2,
    treat: 1,
    good: 0,
    no: photoCount - 1,
    come: 2,
    owner: 1,
  }
  const offset = offsets[ruleId] ?? 1
  return (currentIndex + offset) % photoCount
}

export const IDLE_CROSSFADE_MS = 5000
export const REACTION_CROSSFADE_MS = 400
export const REACTION_DURATION_MS = 2200
