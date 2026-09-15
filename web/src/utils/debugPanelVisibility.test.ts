import { describe, expect, it } from 'vitest'
import {
  DEBUG_PANEL_FADE_IN_MS,
  hideDebugPanelForBehavior,
} from './debugPanelVisibility'

describe('hideDebugPanelForBehavior', () => {
  it('hides the panel for the whole reaction and return cooldown', () => {
    expect(hideDebugPanelForBehavior('react')).toBe(true)
    expect(hideDebugPanelForBehavior('cooldown')).toBe(true)
  })

  it('shows the panel again on listen/idle, not during the reaction', () => {
    expect(hideDebugPanelForBehavior('listen')).toBe(false)
    expect(hideDebugPanelForBehavior('idle')).toBe(false)
  })

  it('uses a slow, FaceTime-friendly fade-in', () => {
    expect(DEBUG_PANEL_FADE_IN_MS).toBeGreaterThanOrEqual(400)
    expect(DEBUG_PANEL_FADE_IN_MS).toBeLessThanOrEqual(800)
  })
})
