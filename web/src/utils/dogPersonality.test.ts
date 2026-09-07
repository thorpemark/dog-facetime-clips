import { describe, expect, it } from 'vitest'
import { defaultPersonality, normalizePersonality } from './dogPersonality'

describe('normalizePersonality', () => {
  it('fills Murphy seed radios when an older library only stored notes', () => {
    const next = normalizePersonality(
      {
        breed: 'huskita (Husky × Akita mix)',
        notes: ['Warm, expressive, slightly goofy.'],
      },
      'murphy',
    )
    expect(next.vocalStyle).toBe('silent')
    expect(next.voiceSize).toBe('large_low')
    expect(next.eyes).toBe('goofy')
    expect(next.touch).toBe('cuddly')
    expect(next.notes).toEqual(['Warm, expressive, slightly goofy.'])
  })

  it('keeps user-edited radios on a named seed dog', () => {
    const next = normalizePersonality(
      {
        ...defaultPersonality(),
        vocalStyle: 'barks',
        voiceSize: 'small_high',
        touch: 'grumble_hug',
      },
      'riley',
      'Riley',
    )
    expect(next.vocalStyle).toBe('barks')
    expect(next.voiceSize).toBe('small_high')
    expect(next.touch).toBe('grumble_hug')
  })

  it('defaults a new dog to silent / medium / cuddly', () => {
    const next = defaultPersonality()
    expect(next.vocalStyle).toBe('silent')
    expect(next.voiceSize).toBe('medium')
    expect(next.energy).toBe('normal')
    expect(next.eyes).toBe('alert')
    expect(next.mouth).toBe('dry')
    expect(next.touch).toBe('cuddly')
  })
})
