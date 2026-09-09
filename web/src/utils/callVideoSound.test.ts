import { describe, expect, it } from 'vitest'
import {
  applyCallVideoSound,
  applyStudioPreviewSound,
  markCallVideoSoundUnlocked,
  playCallVideo,
  resetCallVideoSoundUnlock,
  setVideoAudible,
  unlockCallVideoSound,
} from './callVideoSound'

function mockVideo(playImpl: () => Promise<void>) {
  const attrs = new Map<string, string>()
  return {
    muted: true,
    volume: 0,
    play: playImpl,
    removeAttribute: (name: string) => {
      attrs.delete(name)
    },
    attrs,
  }
}

describe('playCallVideo', () => {
  it('unmutes and sets volume when sound is unlocked', async () => {
    const video = mockVideo(async () => {})
    await playCallVideo(video, true)
    expect(video.muted).toBe(false)
    expect(video.volume).toBe(1)
    expect(video.attrs.has('muted')).toBe(false)
  })

  it('unmutes any reaction with an audio track after Accept, not only howl', async () => {
    const softFoley = mockVideo(async () => {})
    const howl = mockVideo(async () => {})
    const treat = mockVideo(async () => {})
    await playCallVideo(softFoley, true)
    await playCallVideo(howl, true)
    await playCallVideo(treat, true)
    expect(softFoley.muted).toBe(false)
    expect(softFoley.volume).toBe(1)
    expect(howl.muted).toBe(false)
    expect(treat.muted).toBe(false)
    expect(treat.volume).toBe(1)
  })

  it('keeps the clip muted when sound is not unlocked', async () => {
    const video = mockVideo(async () => {})
    await playCallVideo(video, false)
    expect(video.muted).toBe(true)
  })

  it('falls back to muted play then unmutes if audible autoplay is blocked', async () => {
    let attempts = 0
    const video = mockVideo(async () => {
      attempts += 1
      if (attempts === 1 && !video.muted) {
        throw new Error('NotAllowedError')
      }
    })
    await playCallVideo(video, true)
    expect(attempts).toBe(2)
    expect(video.muted).toBe(false)
    expect(video.volume).toBe(1)
  })
})

describe('unlock and apply call / studio sound', () => {
  it('plays the Accept warmup unmuted so later reaction videos can have audio', async () => {
    resetCallVideoSoundUnlock()
    const played: Array<{ muted: boolean; volume: number }> = []
    const unlockAudio = {
      loop: true,
      muted: true,
      volume: 0,
      currentTime: 1,
      play: async () => {
        played.push({ muted: unlockAudio.muted, volume: unlockAudio.volume })
      },
      pause: () => {},
      removeAttribute: () => {},
    }
    unlockCallVideoSound(unlockAudio as unknown as HTMLAudioElement)
    await Promise.resolve()
    expect(played).toEqual([{ muted: false, volume: 1 }])
    expect(unlockAudio.loop).toBe(false)
    resetCallVideoSoundUnlock()
  })

  it('applyCallVideoSound unmutes reaction elements after Accept, including volume', () => {
    resetCallVideoSoundUnlock()
    const video = mockVideo(async () => {})
    video.muted = true
    video.volume = 0
    applyCallVideoSound(video as unknown as HTMLVideoElement)
    expect(video.muted).toBe(true)

    markCallVideoSoundUnlocked()
    applyCallVideoSound(video as unknown as HTMLVideoElement)
    expect(video.muted).toBe(false)
    expect(video.volume).toBe(1)
    resetCallVideoSoundUnlock()
  })

  it('unmutes the Studio preview player when the user hits play', () => {
    const video = mockVideo(async () => {})
    video.muted = true
    video.volume = 0
    applyStudioPreviewSound(video as unknown as HTMLVideoElement)
    expect(video.muted).toBe(false)
    expect(video.volume).toBe(1)
  })

  it('setVideoAudible never leaves volume at 0 when turning sound on', () => {
    const video = mockVideo(async () => {})
    setVideoAudible(video, true)
    expect(video.muted).toBe(false)
    expect(video.volume).toBeGreaterThan(0)
  })
})
