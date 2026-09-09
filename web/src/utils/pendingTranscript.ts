export const PENDING_TRANSCRIPT_TTL_MS = 8_000

export interface PendingTranscript {
  transcript: string
  capturedAt: number
}

/** Keep only the latest non-empty phrase — never grow a queue. */
export function holdLatestFinal(
  previous: PendingTranscript | null,
  transcript: string,
  capturedAt: number,
): PendingTranscript | null {
  const trimmed = transcript.trim()
  if (!trimmed) return previous
  return { transcript: trimmed, capturedAt }
}

export function takePendingIfFresh(
  pending: PendingTranscript | null,
  now: number,
  ttlMs = PENDING_TRANSCRIPT_TTL_MS,
): string | null {
  if (!pending) return null
  if (now - pending.capturedAt > ttlMs) return null
  return pending.transcript
}

/** Drop a queued match that is likely the reaction clip’s own audio. */
export function isEchoOfLastReaction(
  bucketId: string,
  lastReactionClipId: string | null,
): boolean {
  return lastReactionClipId != null && bucketId === lastReactionClipId
}
