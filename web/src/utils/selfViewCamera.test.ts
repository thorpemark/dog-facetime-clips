import { describe, expect, it, vi } from 'vitest'
import {
  SELF_VIEW_CONSTRAINTS,
  SELF_VIEW_DENIED_MESSAGE,
  SELF_VIEW_FALLBACK_CONSTRAINTS,
  SELF_VIEW_UNAVAILABLE_MESSAGE,
  attachSelfViewVideo,
  isCameraPermissionDenied,
  requestSelfViewStream,
  selfViewErrorMessage,
} from './selfViewCamera'

function fakeStream(): MediaStream {
  return {
    getTracks: () => [],
    getVideoTracks: () => [],
    getAudioTracks: () => [],
  } as unknown as MediaStream
}

describe('SELF_VIEW_CONSTRAINTS', () => {
  it('requests the front camera and no microphone', () => {
    expect(SELF_VIEW_CONSTRAINTS).toEqual({
      video: { facingMode: 'user' },
      audio: false,
    })
    expect(SELF_VIEW_FALLBACK_CONSTRAINTS.audio).toBe(false)
    expect(SELF_VIEW_FALLBACK_CONSTRAINTS.video).toBe(true)
  })
})

describe('isCameraPermissionDenied', () => {
  it('detects NotAllowedError and PermissionDeniedError', () => {
    expect(isCameraPermissionDenied({ name: 'NotAllowedError' })).toBe(true)
    expect(isCameraPermissionDenied({ name: 'PermissionDeniedError' })).toBe(
      true,
    )
    expect(isCameraPermissionDenied({ name: 'OverconstrainedError' })).toBe(
      false,
    )
    expect(isCameraPermissionDenied(null)).toBe(false)
  })
})

describe('selfViewErrorMessage', () => {
  it('uses a short blocked message when permission is denied', () => {
    expect(selfViewErrorMessage({ name: 'NotAllowedError' })).toBe(
      SELF_VIEW_DENIED_MESSAGE,
    )
    expect(selfViewErrorMessage({ name: 'NotFoundError' })).toBe(
      SELF_VIEW_UNAVAILABLE_MESSAGE,
    )
  })
})

describe('requestSelfViewStream', () => {
  it('asks for facingMode user with audio false', async () => {
    const stream = fakeStream()
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    await expect(requestSelfViewStream(getUserMedia)).resolves.toBe(stream)
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(getUserMedia).toHaveBeenCalledWith(SELF_VIEW_CONSTRAINTS)
  })

  it('falls back to the default webcam when facingMode is overconstrained', async () => {
    const stream = fakeStream()
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce({ name: 'OverconstrainedError' })
      .mockResolvedValueOnce(stream)
    await expect(requestSelfViewStream(getUserMedia)).resolves.toBe(stream)
    expect(getUserMedia).toHaveBeenNthCalledWith(1, SELF_VIEW_CONSTRAINTS)
    expect(getUserMedia).toHaveBeenNthCalledWith(
      2,
      SELF_VIEW_FALLBACK_CONSTRAINTS,
    )
  })

  it('does not retry after permission is denied', async () => {
    const denied = { name: 'NotAllowedError' }
    const getUserMedia = vi.fn().mockRejectedValue(denied)
    await expect(requestSelfViewStream(getUserMedia)).rejects.toBe(denied)
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })
})

describe('attachSelfViewVideo', () => {
  it('mirrors FaceTime playback flags and attaches the stream', () => {
    const attrs = new Map<string, string>()
    const video = {
      muted: false,
      defaultMuted: false,
      autoplay: false,
      playsInline: false,
      srcObject: null as MediaStream | null,
      play: vi.fn().mockResolvedValue(undefined),
      setAttribute: (name: string, value: string) => {
        attrs.set(name, value)
      },
    }
    const stream = fakeStream()
    attachSelfViewVideo(video as unknown as HTMLVideoElement, stream)
    expect(video.muted).toBe(true)
    expect(video.defaultMuted).toBe(true)
    expect(video.autoplay).toBe(true)
    expect(video.playsInline).toBe(true)
    expect(video.srcObject).toBe(stream)
    expect(attrs.get('muted')).toBe('')
    expect(attrs.get('playsinline')).toBe('')
    expect(attrs.get('webkit-playsinline')).toBe('')
    expect(video.play).toHaveBeenCalled()
  })
})
