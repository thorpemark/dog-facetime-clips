import { describe, expect, it } from 'vitest'
import {
  SPEECH_RESTART_MIN_MS,
  SPEECH_RESTART_MIN_MS_IOS,
  isIOSUserAgent,
  speechRestartDelayMs,
  speechRestartMinIntervalMs,
} from './micSession'

describe('isIOSUserAgent', () => {
  it('detects iPhone Safari', () => {
    expect(
      isIOSUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true)
  })

  it('detects iPadOS desktop UA with touch', () => {
    expect(isIOSUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(
      true,
    )
  })

  it('does not treat desktop Chrome as iOS', () => {
    expect(
      isIOSUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
        0,
      ),
    ).toBe(false)
  })
})

describe('speechRestartDelayMs', () => {
  it('allows an immediate first start', () => {
    expect(speechRestartDelayMs(0, 10_000, SPEECH_RESTART_MIN_MS)).toBe(0)
  })

  it('waits out the remaining interval so iOS does not thrash start()', () => {
    expect(speechRestartDelayMs(1000, 1200, SPEECH_RESTART_MIN_MS_IOS)).toBe(700)
    expect(speechRestartDelayMs(1000, 2000, SPEECH_RESTART_MIN_MS_IOS)).toBe(0)
  })
})

describe('speechRestartMinIntervalMs', () => {
  it('uses a longer interval on iOS', () => {
    expect(speechRestartMinIntervalMs('iPhone')).toBe(SPEECH_RESTART_MIN_MS_IOS)
    expect(speechRestartMinIntervalMs('Mozilla/5.0 Chrome/120', 0)).toBe(
      SPEECH_RESTART_MIN_MS,
    )
  })
})
