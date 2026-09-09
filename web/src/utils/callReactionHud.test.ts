import { describe, expect, it } from 'vitest'
import {
  buildCallReactionHud,
  formatHeardLine,
  intentHudLabel,
} from './callReactionHud'

const howlPin = {
  transcript: 'awoo',
  intentId: 'howl',
  intentLabel: 'howl',
}

describe('intentHudLabel', () => {
  it('uses the first description clause, lowercased', () => {
    expect(intentHudLabel('howl', 'Howl / sing')).toBe('howl')
    expect(intentHudLabel('good', 'Good dog')).toBe('good dog')
    expect(intentHudLabel('hug', 'Hug / cuddle')).toBe('hug')
  })

  it('labels the unknown catch-all as unknown/head-tilt', () => {
    expect(intentHudLabel('unknown', 'Unknown / confused head-tilt')).toBe(
      'unknown/head-tilt',
    )
    expect(intentHudLabel('confused', 'Confused')).toBe('unknown/head-tilt')
  })

  it('falls back to the intent id', () => {
    expect(intentHudLabel('belly-rub')).toBe('belly-rub')
  })
})

describe('buildCallReactionHud', () => {
  it('pins the firing transcript while the matching clip plays', () => {
    const hud = buildCallReactionHud({
      dogName: 'Murphy',
      behavior: 'react',
      pin: howlPin,
    })
    expect(hud.phase).toBe('reacting')
    expect(hud.heardLine).toBe('Murphy heard: “awoo”')
    expect(hud.reactingLine).toBe('Reacting: howl')
  })

  it('keeps the playing pair during cooldown, ignoring a newer queued phrase', () => {
    const hud = buildCallReactionHud({
      dogName: 'Murphy',
      behavior: 'cooldown',
      pin: howlPin,
      // A later “good boy” may be lastTranscript / pending — must not win.
    })
    expect(hud.heardLine).toBe(formatHeardLine('Murphy', 'awoo'))
    expect(hud.reactingLine).toBe('Reacting: howl')
  })

  it('does not show a stale lastMatch once idle listening resumes', () => {
    const hud = buildCallReactionHud({
      dogName: 'Murphy',
      behavior: 'listen',
      pin: howlPin,
      listeningHint: 'Listening…',
    })
    expect(hud.phase).toBe('listening')
    expect(hud.heardLine).toBe('Listening…')
    expect(hud.reactingLine).toBeNull()
  })

  it('hides the HUD while listening when the status row already covers it', () => {
    const hud = buildCallReactionHud({
      dogName: 'Murphy',
      behavior: 'listen',
      pin: howlPin,
    })
    expect(hud.phase).toBe('hidden')
    expect(hud.heardLine).toBeNull()
    expect(hud.reactingLine).toBeNull()
  })

  it('shows only Reacting for a debug tap with no transcript', () => {
    const hud = buildCallReactionHud({
      dogName: 'Riley',
      behavior: 'react',
      pin: { transcript: '', intentId: 'howl', intentLabel: 'howl' },
    })
    expect(hud.heardLine).toBeNull()
    expect(hud.reactingLine).toBe('Reacting: howl')
  })

  it('shows unknown/head-tilt when the catch-all clip is playing', () => {
    const hud = buildCallReactionHud({
      dogName: 'Murphy',
      behavior: 'react',
      pin: {
        transcript: 'what time is it',
        intentId: 'unknown',
        intentLabel: intentHudLabel('unknown'),
      },
    })
    expect(hud.heardLine).toBe('Murphy heard: “what time is it”')
    expect(hud.reactingLine).toBe('Reacting: unknown/head-tilt')
  })
})
