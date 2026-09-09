/** Desktop: restart after a short pause if the recognizer ended. */
export const SPEECH_RESTART_MIN_MS = 400
/**
 * iOS beeps / re-announces the mic on every SpeechRecognition.start().
 * Never auto-restart this often — wait for voice or a long fallback.
 */
export const SPEECH_RESTART_MIN_MS_IOS = 8_000
/** Circuit breaker so VAD cannot start() in a tight loop on iPhone. */
export const SPEECH_IOS_START_COOLDOWN_MS = 2_500
export const VOICE_ACTIVITY_RMS = 0.05

export type SpeechEndReason = 'no-speech' | 'result' | 'aborted' | 'other'

export function isIOSUserAgent(
  userAgent: string,
  maxTouchPoints = 0,
): boolean {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return true
  return maxTouchPoints > 1 && /Mac/i.test(userAgent)
}

export function speechRestartMinIntervalMs(
  userAgent: string,
  maxTouchPoints = 0,
): number {
  return isIOSUserAgent(userAgent, maxTouchPoints)
    ? SPEECH_RESTART_MIN_MS_IOS
    : SPEECH_RESTART_MIN_MS
}

export function speechRestartDelayMs(
  lastStartAt: number,
  now: number,
  minIntervalMs: number,
): number {
  if (lastStartAt <= 0) return 0
  return Math.max(0, minIntervalMs - (now - lastStartAt))
}

export function rmsFromTimeDomain(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const v = (samples[i] - 128) / 128
    sum += v * v
  }
  return Math.sqrt(sum / samples.length)
}

export function isVoiceActivity(
  rms: number,
  threshold = VOICE_ACTIVITY_RMS,
): boolean {
  return rms >= threshold
}

/**
 * iOS Safari/Chrome ignore `continuous` and end after silence or an utterance.
 * Calling start() again re-acquires the mic and plays a system beep.
 * Wait for voice (VAD) instead of restarting on benign no-speech.
 */
export function speechRestartStrategy(input: {
  isIOS: boolean
  reason: SpeechEndReason
  sessionActive: boolean
  running: boolean
}): 'immediate' | 'vad' | 'never' {
  if (!input.sessionActive || input.running) return 'never'
  if (input.reason === 'aborted') return 'never'
  if (input.isIOS) return 'vad'
  if (input.reason === 'no-speech') return 'vad'
  return 'immediate'
}

export function attachMicAnalyser(
  stream: MediaStream,
  context: AudioContext,
): { analyser: AnalyserNode; cleanup: () => void } {
  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.5
  source.connect(analyser)
  // Do not connect to destination — routing the mic to speakers can click/beep.
  return {
    analyser,
    cleanup: () => {
      try {
        source.disconnect()
        analyser.disconnect()
      } catch {
        /* already closed */
      }
    },
  }
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) {
    track.stop()
  }
}
