import { describe, expect, it } from 'vitest'
import {
  PENDING_TRANSCRIPT_TTL_MS,
  holdLatestFinal,
  isEchoOfLastReaction,
  takePendingIfFresh,
} from './pendingTranscript'

describe('holdLatestFinal', () => {
  it('replaces the previous phrase instead of stacking a queue', () => {
    const first = holdLatestFinal(null, 'come here', 1)
    const second = holdLatestFinal(first, 'howl', 2)
    expect(second).toEqual({ transcript: 'howl', capturedAt: 2 })
  })

  it('ignores blank finals so a leftover phrase can still flush', () => {
    const held = holdLatestFinal(null, 'good boy', 1)
    expect(holdLatestFinal(held, '   ', 2)).toEqual(held)
  })
})

describe('takePendingIfFresh', () => {
  it('returns the phrase inside the brief hold window', () => {
    expect(
      takePendingIfFresh({ transcript: 'howl', capturedAt: 1000 }, 1000 + 500),
    ).toBe('howl')
  })

  it('drops a stale phrase after the TTL', () => {
    expect(
      takePendingIfFresh(
        { transcript: 'howl', capturedAt: 1000 },
        1000 + PENDING_TRANSCRIPT_TTL_MS + 1,
      ),
    ).toBeNull()
  })
})

describe('isEchoOfLastReaction', () => {
  it('skips a queued howl that matches the clip that just played', () => {
    expect(isEchoOfLastReaction('howl', 'howl')).toBe(true)
    expect(isEchoOfLastReaction('treat', 'howl')).toBe(false)
    expect(isEchoOfLastReaction('howl', null)).toBe(false)
  })
})
