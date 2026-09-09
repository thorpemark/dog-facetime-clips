import { describe, expect, it } from 'vitest'
import { callListenCue } from './callListenCue'

describe('callListenCue', () => {
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

  it('shows a busy cue while a reaction clip is playing', () => {
    const cue = callListenCue({
      behavior: 'react',
      isMuted: false,
      speechActuallyListening: true,
      speechSupported: true,
    })
    expect(cue.kind).toBe('busy')
    expect(cue.label).toMatch(/not listening/i)
  })

  it('shows getting ready while connecting or in cooldown', () => {
    expect(
      callListenCue({
        behavior: 'idle',
        isMuted: false,
        speechActuallyListening: false,
        speechSupported: true,
      }).kind,
    ).toBe('getting-ready')
    expect(
      callListenCue({
        behavior: 'cooldown',
        isMuted: false,
        speechActuallyListening: true,
        speechSupported: true,
      }).kind,
    ).toBe('getting-ready')
  })

  it('stays on getting ready until speech recognition has actually started', () => {
    expect(
      callListenCue({
        behavior: 'listen',
        isMuted: false,
        speechActuallyListening: false,
        speechSupported: true,
      }).kind,
    ).toBe('getting-ready')
  })

  it('shows Listening once idle listen is actually live', () => {
    const cue = callListenCue({
      behavior: 'listen',
      isMuted: false,
      speechActuallyListening: true,
      speechSupported: true,
    })
    expect(cue.kind).toBe('listening')
    expect(cue.label).toMatch(/listening/i)
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
