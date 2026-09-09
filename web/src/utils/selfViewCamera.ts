/** Front-facing PiP only — never request audio (speech recognition owns the mic). */
export const SELF_VIEW_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: 'user' },
  audio: false,
}

/** Desktop webcams often omit facingMode; fall back to the default camera. */
export const SELF_VIEW_FALLBACK_CONSTRAINTS: MediaStreamConstraints = {
  video: true,
  audio: false,
}

export const SELF_VIEW_DENIED_MESSAGE = 'Camera blocked'
export const SELF_VIEW_UNAVAILABLE_MESSAGE = 'Camera unavailable'

type GetUserMedia = (
  constraints: MediaStreamConstraints,
) => Promise<MediaStream>

export function isCameraPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String(error.name) : ''
  return name === 'NotAllowedError' || name === 'PermissionDeniedError'
}

export function selfViewErrorMessage(error: unknown): string {
  if (isCameraPermissionDenied(error)) return SELF_VIEW_DENIED_MESSAGE
  return SELF_VIEW_UNAVAILABLE_MESSAGE
}

function resolveGetUserMedia(getUserMedia?: GetUserMedia): GetUserMedia | null {
  if (getUserMedia) return getUserMedia
  const mediaDevices =
    typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
  if (!mediaDevices?.getUserMedia) return null
  return mediaDevices.getUserMedia.bind(mediaDevices)
}

/**
 * Start a video-only front camera. Must be invoked from a user gesture
 * (Accept) so iOS Safari/Chrome will show the permission prompt.
 */
export async function requestSelfViewStream(
  getUserMedia?: GetUserMedia,
): Promise<MediaStream> {
  const gum = resolveGetUserMedia(getUserMedia)
  if (!gum) {
    throw new Error(SELF_VIEW_UNAVAILABLE_MESSAGE)
  }
  try {
    return await gum(SELF_VIEW_CONSTRAINTS)
  } catch (error) {
    if (isCameraPermissionDenied(error)) throw error
    return await gum(SELF_VIEW_FALLBACK_CONSTRAINTS)
  }
}

/** iOS needs playsInline (and the webkit attribute) or the video goes fullscreen. */
export function attachSelfViewVideo(
  video: HTMLVideoElement,
  stream: MediaStream | null,
): void {
  video.muted = true
  video.defaultMuted = true
  video.autoplay = true
  video.playsInline = true
  video.setAttribute('muted', '')
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.srcObject = stream
  if (stream) {
    void video.play().catch(() => {
      /* muted + playsInline is enough after Accept; ignore autoplay rejection */
    })
  }
}
