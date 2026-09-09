import { describe, expect, it } from 'vitest'
import { playCallVideo } from './callVideoSound'

function mockVideo(playImpl: () => Promise<void>) {
  return {
    muted: true,
    volume: 0,
    play: playImpl,
  }
}

describe('playCallVideo', () => {
  it('unmutes and sets volume when sound is unlocked', async () => {
    const video = mockVideo(async () => {})
    await playCallVideo(video, true)
    expect(video.muted).toBe(false)
    expect(video.volume).toBe(1)
  })

  it('unmutes any reaction with an audio track after Accept, not only howl', async () => {
    const softFoley = mockVideo(async () => {})
    const howl = mockVideo(async () => {})
    await playCallVideo(softFoley, true)
    await playCallVideo(howl, true)
    expect(softFoley.muted).toBe(false)
    expect(softFoley.volume).toBe(1)
    expect(howl.muted).toBe(false)
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
  })
})
