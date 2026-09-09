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
  if (typeof window === 'undefined') return undefined
  const w = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? w.webkitAudioContext
}

/** Resume Web Audio on a user gesture so later unmuted video.play() is allowed. */
export function resumeCallAudioContext(): void {
  const Ctor = audioContextCtor()
  if (!Ctor) return
  try {
    const ctx = new Ctor()
    void ctx.resume()
  } catch {
    /* autoplay / closed context — video path still tries */
  }
}

export type PlayableVideo = {
  muted: boolean
  volume: number
  play: () => Promise<void>
  removeAttribute?: (name: string) => void
}

/** Unmute + volume 1, and drop the HTML `muted` attribute so browsers do not keep it silent. */
export function setVideoAudible(media: PlayableVideo, audible: boolean): void {
  if (audible) {
    media.volume = 1
    media.muted = false
    media.removeAttribute?.('muted')
    return
  }
  media.muted = true
}

export function unlockCallVideoSound(unlockAudio?: HTMLAudioElement | null): void {
  markCallVideoSoundUnlocked()
  resumeCallAudioContext()
  if (!unlockAudio) return
  // Unmuted silent WAV in the user gesture — iOS will not unlock later
  // <video> sound if this warmup stays muted or volume 0.
  unlockAudio.loop = false
  setVideoAudible(unlockAudio, true)
  void unlockAudio
    .play()
    .then(() => {
      unlockAudio.pause()
      try {
        unlockAudio.currentTime = 0
      } catch {
        /* ignore */
      }
    })
    .catch(() => {})
}

export function releaseCallAudioUnlock(unlockAudio?: HTMLAudioElement | null): void {
  if (!unlockAudio) return
  unlockAudio.loop = false
  unlockAudio.pause()
  try {
    unlockAudio.currentTime = 0
  } catch {
    /* ignore */
  }
}

export function applyCallVideoSound(video: HTMLVideoElement | null): void {
  if (!video) return
  setVideoAudible(video, soundUnlocked)
}

/** Studio slot preview: user hit play, so Foley / howl audio should be audible. */
export function applyStudioPreviewSound(video: HTMLVideoElement | null): void {
  if (!video) return
  setVideoAudible(video, true)
}

/**
 * Play a call clip with sound after the user has interacted (Accept / debug tap).
 * Applies to every reaction with an audio track (howl, soft Foley, bark) — not howl-only.
 * Idle and reaction paths share this helper so the app does not force-mute clips.
 * If unmuted autoplay is blocked, start muted so the picture still plays, then unmute.
 */
export async function playCallVideo(
  video: PlayableVideo,
  unlocked = isCallVideoSoundUnlocked(),
): Promise<void> {
  setVideoAudible(video, unlocked)
  try {
    await video.play()
  } catch {
    video.muted = true
    try {
      await video.play()
    } catch {
      return
    }
    if (unlocked) {
      setVideoAudible(video, true)
    }
  }
}
