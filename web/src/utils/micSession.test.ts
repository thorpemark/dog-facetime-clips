import { describe, expect, it } from 'vitest'
import {
  SPEECH_IOS_START_COOLDOWN_MS,
  SPEECH_RESTART_MIN_MS,
  SPEECH_RESTART_MIN_MS_IOS,
  isIOSUserAgent,
  isVoiceActivity,
  rmsFromTimeDomain,
  speechRestartDelayMs,
  speechRestartMinIntervalMs,
  speechRestartStrategy,
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
    expect(speechRestartDelayMs(1000, 1200, SPEECH_RESTART_MIN_MS_IOS)).toBe(7_800)
    expect(speechRestartDelayMs(1000, 10_000, SPEECH_RESTART_MIN_MS_IOS)).toBe(0)
  })
})

describe('speechRestartMinIntervalMs', () => {
  it('uses a long fallback interval on iOS', () => {
    expect(speechRestartMinIntervalMs('iPhone')).toBe(SPEECH_RESTART_MIN_MS_IOS)
    expect(speechRestartMinIntervalMs('Mozilla/5.0 Chrome/120', 0)).toBe(
      SPEECH_RESTART_MIN_MS,
    )
  })
})

describe('speechRestartStrategy', () => {
  it('does not restart after abort or while already running', () => {
    expect(
      speechRestartStrategy({
        isIOS: false,
        reason: 'aborted',
        sessionActive: true,
        running: false,
      }),
    ).toBe('never')
    expect(
      speechRestartStrategy({
        isIOS: true,
        reason: 'result',
        sessionActive: true,
        running: true,
      }),
    ).toBe('never')
  })

  it('on iOS waits for voice instead of restarting on no-speech or after a result', () => {
    expect(
      speechRestartStrategy({
        isIOS: true,
        reason: 'no-speech',
        sessionActive: true,
        running: false,
      }),
    ).toBe('vad')
    expect(
      speechRestartStrategy({
        isIOS: true,
        reason: 'result',
        sessionActive: true,
        running: false,
      }),
    ).toBe('vad')
  })

  it('on desktop restarts after a result but not on benign no-speech', () => {
    expect(
      speechRestartStrategy({
        isIOS: false,
        reason: 'result',
        sessionActive: true,
        running: false,
      }),
    ).toBe('immediate')
    expect(
      speechRestartStrategy({
        isIOS: false,
        reason: 'no-speech',
        sessionActive: true,
        running: false,
      }),
    ).toBe('vad')
  })
})

describe('isVoiceActivity', () => {
  it('treats a flat 128 line as silence', () => {
    expect(rmsFromTimeDomain(new Array(32).fill(128))).toBe(0)
    expect(isVoiceActivity(0)).toBe(false)
  })

  it('treats a strong swing as speech', () => {
    const loud = [128, 255, 0, 255, 0, 255, 0, 255]
    expect(isVoiceActivity(rmsFromTimeDomain(loud))).toBe(true)
  })
})

describe('SPEECH_IOS_START_COOLDOWN_MS', () => {
  it('is long enough to prevent beep-storm start() loops', () => {
    expect(SPEECH_IOS_START_COOLDOWN_MS).toBeGreaterThanOrEqual(2_000)
  })
})
