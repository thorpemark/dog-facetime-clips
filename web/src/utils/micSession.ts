/** Minimum time between SpeechRecognition.start() calls to avoid iOS mic re-announce. */
export const SPEECH_RESTART_MIN_MS = 400
export const SPEECH_RESTART_MIN_MS_IOS = 900

export function isIOSUserAgent(
  userAgent: string,
  maxTouchPoints = 0,
): boolean {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return true
  // iPadOS reports as Mac Intel with touch
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

/** Keep the OS audio session open so SpeechRecognition restarts do not re-prompt. */
export function attachSilentMicHold(
  stream: MediaStream,
  context: AudioContext,
): () => void {
  const source = context.createMediaStreamSource(stream)
  const gain = context.createGain()
  gain.gain.value = 0
  source.connect(gain)
  gain.connect(context.destination)
  return () => {
    try {
      source.disconnect()
      gain.disconnect()
    } catch {
      /* already closed */
    }
  }
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) {
    track.stop()
  }
}
