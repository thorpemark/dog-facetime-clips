/** Tiny silent WAV so Accept can unlock audible playback before <video> exists. */
export const SILENCE_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

let soundUnlocked = false

export function isCallVideoSoundUnlocked(): boolean {
  return soundUnlocked
}

export function resetCallVideoSoundUnlock(): void {
  soundUnlocked = false
}

export function markCallVideoSoundUnlocked(): void {
  soundUnlocked = true
}

type AudioContextCtor = typeof AudioContext

function audioContextCtor(): AudioContextCtor | undefined {
  const w = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? w.webkitAudioContext
}

/** Resume Web Audio on a user gesture so later unmuted video.play() is allowed. */
export function resumeCallAudioContext(): void {
  const Ctor = audioContextCtor()
  if (!Ctor) return
  try {
    const ctx = new Ctor()
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
    void ctx.resume()
  } catch {
    /* autoplay / closed context — video path still tries */
  }
}

export function unlockCallVideoSound(unlockAudio?: HTMLAudioElement | null): void {
  markCallVideoSoundUnlocked()
  resumeCallAudioContext()
  if (!unlockAudio) return
  unlockAudio.muted = false
  unlockAudio.volume = 0.01
  void unlockAudio.play().catch(() => {})
}

export function applyCallVideoSound(video: HTMLVideoElement | null): void {
  if (!video) return
  video.volume = 1
  video.muted = !soundUnlocked
}

export type PlayableVideo = {
  muted: boolean
  volume: number
  play: () => Promise<void>
}

/**
 * Play a call clip with sound after the user has interacted (Accept / debug tap).
 * If unmuted autoplay is blocked, start muted so the picture still plays, then unmute.
 */
export async function playCallVideo(
  video: PlayableVideo,
  soundUnlocked = isCallVideoSoundUnlocked(),
): Promise<void> {
  video.volume = 1
  video.muted = !soundUnlocked
  try {
    await video.play()
  } catch {
    video.muted = true
    try {
      await video.play()
    } catch {
      return
    }
    if (soundUnlocked) {
      video.muted = false
    }
  }
}
