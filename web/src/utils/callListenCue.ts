import type { BehaviorState } from '../types'

export type CallListenCueKind = 'listening' | 'getting-ready' | 'busy' | 'muted'

export interface CallListenCue {
  kind: CallListenCueKind
  label: string
  icon: string
}

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
    return { kind: 'busy', label: 'Busy — not listening', icon: '💬' }
  }

  if (input.behavior === 'idle' || input.behavior === 'cooldown') {
    return { kind: 'getting-ready', label: 'Getting ready…', icon: '⏳' }
  }

  if (
    input.speechSupported &&
    !input.speechActuallyListening &&
    !input.speechError
  ) {
    return { kind: 'getting-ready', label: 'Getting ready…', icon: '⏳' }
  }

  return { kind: 'listening', label: 'Listening…', icon: '🎧' }
}
