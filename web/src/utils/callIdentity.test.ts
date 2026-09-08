import { describe, expect, it } from 'vitest'
import { CALL_MODES, defaultSourcePhotoForMode } from '../data/callModes'
import { createSeedStudioState } from '../data/clipStudioSeed'
import type { ClipSlot, ClipSourcePhoto, DogLibrary } from '../types/clipStudio'
import {
  attachedIdleSlots,
  chosenIdleSlot,
  identityStillForDog,
  isMismatchedModePhoto,
  repairSeedIdentityPhotos,
  resolveIdlePlayback,
  userIdlePlaybackUrls,
  userVideoPlaybackPath,
} from './callIdentity'

function userPhoto(url: string, publicPath?: string): ClipSourcePhoto {
  return {
    id: 'user-photo',
    url,
    publicPath,
    blobKey: publicPath ? undefined : 'photo:user',
    framing: {
      portrait: { focalX: 0.5, focalY: 0.5, focalZoom: 1 },
      landscape: { focalX: 0.5, focalY: 0.5, focalZoom: 1 },
    },
  }
}

function slotWith(
  extras: Partial<ClipSlot> & Pick<ClipSlot, 'id'>,
): ClipSlot {
  return {
    weight: 50,
    prompt: 'p',
    label: 'A',
    sourcePhoto: null,
    resultVideo: null,
    status: 'empty',
    ...extras,
  }
}

describe('identity stills', () => {
  it('keeps Murphy tan, Riley black, Both together', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    const riley = seed.dogs.find((dog) => dog.id === 'riley')
    const both = seed.dogs.find((dog) => dog.id === 'both')

    expect(identityStillForDog('Murphy', murphy)?.publicPath).toBe('modes/murphy.jpg')
    expect(identityStillForDog('Riley', riley)?.publicPath).toBe('modes/riley.jpg')
    expect(identityStillForDog('Both', both)?.publicPath).toBe('modes/both.jpg')
    expect(identityStillForDog('Murphy', murphy)?.url).toMatch(/modes\/murphy\.jpg$/)
    expect(identityStillForDog('together')?.publicPath).toBe('modes/both.jpg')
  })

  it('ignores a stale Studio library that pointed Murphy at Both/Riley', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    if (!murphy) throw new Error('missing murphy')
    const poisoned: DogLibrary = {
      ...murphy,
      defaultPhoto: defaultSourcePhotoForMode(CALL_MODES[2]),
      avatarPath: 'modes/both.jpg',
      intents: murphy.intents.map((intent) => ({
        ...intent,
        clipSlots: intent.clipSlots.map((slot) => ({
          ...slot,
          sourcePhoto: slot.sourcePhoto
            ? { ...defaultSourcePhotoForMode(CALL_MODES[1]), id: slot.id }
            : slot.sourcePhoto,
        })),
      })),
    }

    expect(isMismatchedModePhoto('modes/both.jpg', 'Murphy')).toBe(true)
    expect(isMismatchedModePhoto('modes/riley.jpg', 'Murphy')).toBe(true)
    expect(isMismatchedModePhoto('modes/murphy.jpg', 'Murphy')).toBe(false)
    expect(identityStillForDog('Murphy', poisoned)?.publicPath).toBe('modes/murphy.jpg')
  })

  it('prefers a hydrated user still on the dog, then idle slot', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    if (!murphy) throw new Error('missing murphy')

    const withDefault: DogLibrary = {
      ...murphy,
      defaultPhoto: userPhoto('blob:murphy-default'),
    }
    expect(identityStillForDog('Murphy', withDefault)?.url).toBe('blob:murphy-default')

    const withIdle: DogLibrary = {
      ...murphy,
      intents: murphy.intents.map((intent) =>
        intent.id === 'idle'
          ? {
              ...intent,
              clipSlots: [
                slotWith({
                  id: 'idle-1',
                  sourcePhoto: userPhoto('blob:murphy-idle'),
                }),
                ...intent.clipSlots.slice(1),
              ],
            }
          : intent,
      ),
    }
    expect(identityStillForDog('Murphy', withIdle)?.url).toBe('blob:murphy-idle')
  })

  it('keeps the home/demo avatar on the mode still when a generation still is set', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    if (!murphy) throw new Error('missing murphy')
    const withGeneration: DogLibrary = {
      ...murphy,
      generationPhoto: userPhoto('blob:kitchen-source'),
    }
    expect(identityStillForDog('Murphy', withGeneration)?.publicPath).toBe('modes/murphy.jpg')
    expect(identityStillForDog('Murphy', withGeneration)?.url).toMatch(/modes\/murphy\.jpg$/)
  })
})

describe('repairSeedIdentityPhotos', () => {
  it('rewrites wrong mode publicPaths without touching attached videos', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    if (!murphy) throw new Error('missing murphy')
    const idle = murphy.intents.find((intent) => intent.id === 'idle')
    const first = idle?.clipSlots[0]
    if (!first) throw new Error('missing idle slot')

    const poisoned: DogLibrary = {
      ...murphy,
      defaultPhoto: defaultSourcePhotoForMode(CALL_MODES[2]),
      avatarPath: 'modes/riley.jpg',
      intents: murphy.intents.map((intent) =>
        intent.id === 'idle'
          ? {
              ...intent,
              clipSlots: [
                {
                  ...first,
                  sourcePhoto: defaultSourcePhotoForMode(CALL_MODES[1]),
                  resultVideo: {
                    objectUrl: 'blob:keep-me',
                    blobKey: 'video:murphy-idle-1',
                    origin: 'user',
                    fileName: 'idle.mp4',
                  },
                },
                ...intent.clipSlots.slice(1),
              ],
            }
          : intent,
      ),
    }

    const repaired = repairSeedIdentityPhotos(poisoned)
    expect(repaired.defaultPhoto?.publicPath).toBe('modes/murphy.jpg')
    expect(repaired.avatarPath).toBe('modes/murphy.jpg')
    const repairedIdle = repaired.intents.find((intent) => intent.id === 'idle')?.clipSlots[0]
    expect(repairedIdle?.sourcePhoto?.publicPath).toBe('modes/murphy.jpg')
    expect(repairedIdle?.resultVideo?.objectUrl).toBe('blob:keep-me')
    expect(repairedIdle?.resultVideo?.blobKey).toBe('video:murphy-idle-1')
  })
})

describe('idle playback plan', () => {
  it('uses attached user idle when present', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    if (!murphy) throw new Error('missing murphy')
    const withIdle: DogLibrary = {
      ...murphy,
      intents: murphy.intents.map((intent) =>
        intent.id === 'idle'
          ? {
              ...intent,
              clipSlots: intent.clipSlots.map((slot, index) =>
                index === 0
                  ? {
                      ...slot,
                      resultVideo: {
                        objectUrl: 'blob:idle-user',
                        origin: 'user',
                        blobKey: 'video:idle',
                      },
                    }
                  : slot,
              ),
            }
          : intent,
      ),
    }

    expect(userVideoPlaybackPath(withIdle.intents[0].clipSlots[0])).toBe('blob:idle-user')
    expect(userIdlePlaybackUrls(withIdle)).toEqual(['blob:idle-user'])
    expect(chosenIdleSlot(withIdle)?.id).toBe(withIdle.intents[0].clipSlots[0].id)
    expect(attachedIdleSlots(withIdle).map((slot) => slot.id)).toEqual([
      withIdle.intents[0].clipSlots[0].id,
    ])
    expect(resolveIdlePlayback('Murphy', withIdle)).toEqual({
      kind: 'user-video',
      urls: ['blob:idle-user'],
    })
  })

  it('uses the preferred idle slot as the looping FaceTime hold', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    if (!murphy) throw new Error('missing murphy')
    const idle = murphy.intents.find((intent) => intent.id === 'idle')
    if (!idle || idle.clipSlots.length < 2) throw new Error('need two idle slots')

    const withTwo: DogLibrary = {
      ...murphy,
      preferredIdleSlotId: idle.clipSlots[1].id,
      intents: murphy.intents.map((intent) =>
        intent.id === 'idle'
          ? {
              ...intent,
              clipSlots: intent.clipSlots.map((slot, index) => ({
                ...slot,
                resultVideo: {
                  objectUrl: index === 0 ? 'blob:idle-a' : 'blob:idle-b',
                  origin: 'user' as const,
                  blobKey: `video:idle-${index}`,
                },
              })),
            }
          : intent,
      ),
    }

    expect(chosenIdleSlot(withTwo)?.id).toBe(idle.clipSlots[1].id)
    expect(resolveIdlePlayback('Murphy', withTwo)).toEqual({
      kind: 'user-video',
      urls: ['blob:idle-b', 'blob:idle-a'],
    })
  })

  it('falls back to the Murphy still instead of placeholder idle', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    const plan = resolveIdlePlayback('Murphy', murphy)
    expect(plan.kind).toBe('still')
    if (plan.kind === 'still') {
      expect(plan.url).toMatch(/modes\/murphy\.jpg$/)
    }
  })

  it('only uses colored placeholder idle when there is no identity still', () => {
    const plan = resolveIdlePlayback('Biscuit', undefined, false)
    expect(plan.kind).toBe('placeholder')
    if (plan.kind === 'placeholder') {
      expect(plan.urls.some((url) => url.includes('idle'))).toBe(true)
    }
  })

  it('treats a profile avatar as a still even without a studio dog', () => {
    const plan = resolveIdlePlayback('Biscuit', undefined, true)
    expect(plan.kind).toBe('still')
  })
})
