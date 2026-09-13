import type { BehaviorState } from '../types'

/** Calm FaceTime-style fade when the debug panel returns after a reaction. */
export const DEBUG_PANEL_FADE_IN_MS = 640

/**
 * Hide the Sample Call debug panel while a reaction clip is on screen
 * and during the short return-to-idle cooldown (avoids fading in mid-crossfade).
 * Restore only once listen/idle is showing.
 */
export function hideDebugPanelForBehavior(
  type: BehaviorState['type'],
): boolean {
  return type === 'react' || type === 'cooldown'
}
