import type { BehaviorState } from '../types'

export type CallListenCueKind = 'listening' | 'getting-ready' | 'busy' | 'muted'

export interface CallListenCue {
  kind: CallListenCueKind
  label: string
  icon: string
}

/**
 * Active-call status. Never “Connected” — that hid a live mic behind a
 * FaceTime-style idle label. Phone and PC should both read:
 * Listening… / Getting ready… / Busy reacting…
 */
export function callListenCue(input: {
  behavior: BehaviorState['type']
  isMuted: boolean
  speechActuallyListening: boolean
  speechSupported: boolean
  speechError?: string | null
}): CallListenCue {
  if (input.isMuted) {
    return { kind: 'muted', label: 'Muted', icon: '🔇' }
  }

  if (input.behavior === 'react') {
    return { kind: 'busy', label: 'Busy reacting…', icon: '💬' }
  }

  if (input.behavior === 'cooldown') {
    return { kind: 'getting-ready', label: 'Getting ready…', icon: '⏳' }
  }

  // Mic is actually up — even if behavior is still idle after Accept.
  if (input.speechActuallyListening) {
    return { kind: 'listening', label: 'Listening…', icon: '🎧' }
  }

  if (input.behavior === 'idle') {
    return { kind: 'getting-ready', label: 'Getting ready…', icon: '⏳' }
  }

  if (input.speechSupported && !input.speechError) {
    return { kind: 'getting-ready', label: 'Getting ready…', icon: '⏳' }
  }

  return { kind: 'listening', label: 'Listening…', icon: '🎧' }
}
