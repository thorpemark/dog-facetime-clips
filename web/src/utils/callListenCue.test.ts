import { describe, expect, it } from 'vitest'
import { callListenCue } from './callListenCue'

const base = {
  isMuted: false,
  speechSupported: true,
  speechError: null as string | null,
}

describe('callListenCue', () => {
  it('never uses a generic Connected label', () => {
    const behaviors = ['idle', 'listen', 'react', 'cooldown'] as const
    for (const behavior of behaviors) {
      for (const speechActuallyListening of [true, false]) {
        const cue = callListenCue({
          ...base,
          behavior,
          speechActuallyListening,
        })
        expect(cue.label.toLowerCase()).not.toContain('connected')
      }
    }
  })

  it('shows muted when the mic is muted, even during a reaction', () => {
    expect(
      callListenCue({
        behavior: 'react',
        isMuted: true,
        speechActuallyListening: false,
        speechSupported: true,
      }).kind,
    ).toBe('muted')
  })

  it('shows Busy reacting while a reaction clip is playing', () => {
    const cue = callListenCue({
      ...base,
      behavior: 'react',
      speechActuallyListening: true,
    })
    expect(cue.kind).toBe('busy')
    expect(cue.label).toBe('Busy reacting…')
  })

  it('shows Getting ready while connecting or in cooldown', () => {
    expect(
      callListenCue({
        ...base,
        behavior: 'idle',
        speechActuallyListening: false,
      }).kind,
    ).toBe('getting-ready')
    expect(
      callListenCue({
        ...base,
        behavior: 'cooldown',
        speechActuallyListening: true,
      }),
    ).toMatchObject({ kind: 'getting-ready', label: 'Getting ready…' })
  })

  it('shows Listening when speech is up even if behavior is still idle', () => {
    const cue = callListenCue({
      ...base,
      behavior: 'idle',
      speechActuallyListening: true,
    })
    expect(cue.kind).toBe('listening')
    expect(cue.label).toBe('Listening…')
  })

  it('stays on Getting ready until speech recognition has actually started', () => {
    expect(
      callListenCue({
        ...base,
        behavior: 'listen',
        speechActuallyListening: false,
      }).kind,
    ).toBe('getting-ready')
  })

  it('shows Listening once idle listen is actually live', () => {
    const cue = callListenCue({
      ...base,
      behavior: 'listen',
      speechActuallyListening: true,
    })
    expect(cue.kind).toBe('listening')
    expect(cue.label).toBe('Listening…')
  })

  it('shows Listening if the mic failed so debug / typed phrases still look ready', () => {
    expect(
      callListenCue({
        behavior: 'listen',
        isMuted: false,
        speechActuallyListening: false,
        speechSupported: true,
        speechError: 'Microphone permission denied',
      }).kind,
    ).toBe('listening')
  })

  it('shows Listening without speech API so debug taps still look ready', () => {
    expect(
      callListenCue({
        behavior: 'listen',
        isMuted: false,
        speechActuallyListening: false,
        speechSupported: false,
      }).kind,
    ).toBe('listening')
  })
})
