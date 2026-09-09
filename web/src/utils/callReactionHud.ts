import { isUnknownIntent } from '../data/reactionCatalog'
import type { BehaviorState } from '../types'

export type CallReactionHudPhase = 'hidden' | 'listening' | 'reacting'

export interface ReactionHudPin {
  /** Transcript that actually started this reaction — not a later queued phrase. */
  transcript: string
  intentId: string
  intentLabel: string
}

export interface CallReactionHudView {
  phase: CallReactionHudPhase
  /** e.g. `Murphy heard: “awoo”` */
  heardLine: string | null
  /** e.g. `Reacting: howl` */
  reactingLine: string | null
}

/**
 * Compact FaceTime label for the matched intent.
 * Unknown catch-all stays “unknown/head-tilt”; otherwise prefer the
 * catalog description’s first clause (`Howl / sing` → `howl`).
 */
export function intentHudLabel(
  intentId: string,
  description?: string | null,
): string {
  if (isUnknownIntent(intentId)) return 'unknown/head-tilt'
  const desc = description?.trim()
  if (!desc) return intentId
  const primary = desc.split('/')[0]?.trim()
  return (primary || desc).toLowerCase()
}

export function formatHeardLine(dogName: string, transcript: string): string {
  return `${dogName} heard: “${transcript}”`
}

export function formatReactingLine(intentLabel: string): string {
  return `Reacting: ${intentLabel}`
}

/**
 * Call-screen HUD. While a clip plays (or cooldown after it), show the
 * transcript + intent pinned when that reaction started — never a newer
 * phrase sitting in the speak-early / cooldown queue.
 */
export function buildCallReactionHud(input: {
  dogName: string
  behavior: BehaviorState['type']
  pin?: ReactionHudPin | null
  /** Soft idle line; omit when the status row already says Listening… */
  listeningHint?: string | null
}): CallReactionHudView {
  const reacting =
    input.behavior === 'react' || input.behavior === 'cooldown'
  const pin = input.pin

  if (reacting && pin) {
    const heard = pin.transcript.trim()
    return {
      phase: 'reacting',
      heardLine: heard ? formatHeardLine(input.dogName, heard) : null,
      reactingLine: formatReactingLine(pin.intentLabel || pin.intentId),
    }
  }

  const hint = input.listeningHint?.trim()
  if (hint) {
    return { phase: 'listening', heardLine: hint, reactingLine: null }
  }

  return { phase: 'hidden', heardLine: null, reactingLine: null }
}
