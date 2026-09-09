import { describe, expect, it } from 'vitest'
import { createSeedStudioState } from '../data/clipStudioSeed'
import { HOLIDAY_INTENT_IDS } from '../data/holidayIntents'
import { fullImageDualFraming } from './focalPoint'
import type { ClipSourcePhoto, ClipStudioState, DogLibrary } from '../types/clipStudio'
import {
  adoptLocalStudioBlobs,
  collectStudioBlobKeys,
  countUserAttachedVideos,
  isDifferentAccountLocalLibrary,
  mergeStudioLibraries,
  shouldWriteRemoteLibrary,
  stampCloudMediaPaths,
} from './studioLibraryMerge'
import {
  decodeStudioBlobKey,
  encodeStudioBlobKey,
  inferStudioMediaContentType,
} from '../services/studioLibraryService'

function withMurphyUserLibrary(seed: ClipStudioState): ClipStudioState {
  const kitchen: ClipSourcePhoto = {
    id: 'kitchen',
    url: 'blob:kitchen',
    blobKey: 'photo:generation:murphy:kitchen',
    framing: fullImageDualFraming(),
  }
  return {
    ...seed,
    activeDogId: 'murphy',
    dogs: seed.dogs.map((dog) => {
      if (dog.id !== 'murphy') return dog
      return {
        ...dog,
        generationPhoto: kitchen,
        preferredIdleSlotId: 'murphy-idle-1',
        intents: dog.intents.map((intent) => {
          if (intent.id === 'idle') {
            const [first, ...rest] = intent.clipSlots
            return {
              ...intent,
              clipSlots: [
                {
                  ...first,
                  sourcePhoto: {
                    ...kitchen,
                    id: `${kitchen.id}-${first.id}`,
                  },
                  resultVideo: {
                    objectUrl: 'blob:murphy-idle',
                    blobKey: 'video:murphy-idle-1',
                    origin: 'user' as const,
                    fileName: 'idle.mp4',
                  },
                  status: 'video_attached' as const,
                },
                ...rest,
              ],
            }
          }
          if (intent.id === 'hug') {
            const [first, ...rest] = intent.clipSlots
            return {
              ...intent,
              clipSlots: [
                {
                  ...first,
                  resultVideo: {
                    objectUrl: 'blob:murphy-hug',
                    blobKey: 'video:murphy-hug-1',
                    origin: 'user' as const,
                    fileName: 'hug.mp4',
                  },
                  status: 'video_attached' as const,
                },
                ...rest,
              ],
            }
          }
          return intent
        }),
      }
    }),
  }
}

function murphy(state: ClipStudioState): DogLibrary {
  const dog = state.dogs.find((item) => item.id === 'murphy')
  if (!dog) throw new Error('missing murphy')
  return dog
}

describe('studio blob key encoding', () => {
  it('round-trips generation and video keys', () => {
    const keys = ['video:murphy-idle-1', 'photo:generation:murphy:kitchen', 'photo:slot-id']
    for (const key of keys) {
      expect(decodeStudioBlobKey(encodeStudioBlobKey(key))).toBe(key)
    }
  })
})

describe('mergeStudioLibraries', () => {
  it('uploads PC user videos over a phone seed instead of wiping them', () => {
    const seed = createSeedStudioState()
    const pc = withMurphyUserLibrary(seed)
    const merged = mergeStudioLibraries(pc, seed)

    expect(countUserAttachedVideos(merged)).toBe(2)
    const dog = murphy(merged)
    expect(dog.generationPhoto?.blobKey).toBe('photo:generation:murphy:kitchen')
    expect(dog.preferredIdleSlotId).toBe('murphy-idle-1')
    const idle = dog.intents.find((intent) => intent.id === 'idle')?.clipSlots[0]
    expect(idle?.resultVideo?.origin).toBe('user')
    expect(idle?.resultVideo?.blobKey).toBe('video:murphy-idle-1')
    const hug = dog.intents.find((intent) => intent.id === 'hug')?.clipSlots[0]
    expect(hug?.resultVideo?.blobKey).toBe('video:murphy-hug-1')
    for (const holidayId of HOLIDAY_INTENT_IDS) {
      expect(dog.intents.some((intent) => intent.id === holidayId)).toBe(true)
    }
  })

  it('downloads cloud Murphy videos onto a phone seed', () => {
    const seed = createSeedStudioState()
    const cloud = withMurphyUserLibrary(seed)
    const merged = mergeStudioLibraries(seed, cloud)

    expect(countUserAttachedVideos(merged)).toBe(2)
    const dog = murphy(merged)
    expect(dog.generationPhoto?.blobKey).toBe('photo:generation:murphy:kitchen')
    expect(
      dog.intents.find((intent) => intent.id === 'idle')?.clipSlots[0]?.resultVideo?.blobKey,
    ).toBe('video:murphy-idle-1')
  })

  it('unions extra user slots from both sides', () => {
    const seed = createSeedStudioState()
    const local = withMurphyUserLibrary(seed)
    const remote = structuredClone(local)
    const remoteMurphy = murphy(remote)
    const hug = remoteMurphy.intents.find((intent) => intent.id === 'hug')
    if (!hug) throw new Error('missing hug')
    hug.clipSlots.push({
      id: 'murphy-hug-extra',
      weight: 20,
      prompt: 'extra',
      label: 'Extra hug',
      sourcePhoto: null,
      resultVideo: {
        blobKey: 'video:murphy-hug-extra',
        origin: 'user',
        fileName: 'extra.mp4',
      },
      status: 'video_attached',
    })

    const merged = mergeStudioLibraries(local, remote)
    const mergedHug = murphy(merged).intents.find((intent) => intent.id === 'hug')
    expect(mergedHug?.clipSlots.some((slot) => slot.id === 'murphy-hug-extra')).toBe(true)
    expect(
      mergedHug?.clipSlots.find((slot) => slot.id === 'murphy-hug-1')?.resultVideo?.blobKey,
    ).toBe('video:murphy-hug-1')
    expect(countUserAttachedVideos(merged)).toBe(3)
  })

  it('collects IndexedDB keys for generation stills and user videos', () => {
    const pc = withMurphyUserLibrary(createSeedStudioState())
    const keys = collectStudioBlobKeys(pc)
    expect(keys).toContain('photo:generation:murphy:kitchen')
    expect(keys).toContain('video:murphy-idle-1')
    expect(keys).toContain('video:murphy-hug-1')
  })

  it('does not treat another account’s leftover local library as theirs', () => {
    expect(isDifferentAccountLocalLibrary(null, 'user-a')).toBe(false)
    expect(isDifferentAccountLocalLibrary('user-a', 'user-a')).toBe(false)
    expect(isDifferentAccountLocalLibrary('user-a', 'user-b')).toBe(true)
  })

  it('reattaches IndexedDB MP4s onto a seed library the phone uploaded first', () => {
    const seed = createSeedStudioState()
    const adopted = adoptLocalStudioBlobs(seed, [
      'video:murphy-idle-1',
      'video:murphy-hug-1',
      'photo:generation:murphy:kitchen',
    ])
    expect(countUserAttachedVideos(adopted)).toBe(2)
    const dog = murphy(adopted)
    expect(dog.generationPhoto?.blobKey).toBe('photo:generation:murphy:kitchen')
    const idle = dog.intents.find((intent) => intent.id === 'idle')?.clipSlots[0]
    expect(idle?.resultVideo?.origin).toBe('user')
    expect(idle?.resultVideo?.blobKey).toBe('video:murphy-idle-1')
    expect(idle?.status).toBe('video_attached')
    expect(idle?.resultVideo?.path).toBeUndefined()
    expect(collectStudioBlobKeys(adopted)).toEqual(
      expect.arrayContaining([
        'video:murphy-idle-1',
        'video:murphy-hug-1',
        'photo:generation:murphy:kitchen',
      ]),
    )
  })

  it('keeps PC videos when merging an adopted local library over the phone seed', () => {
    const seed = createSeedStudioState()
    const adopted = adoptLocalStudioBlobs(seed, ['video:murphy-idle-1'])
    const merged = mergeStudioLibraries(adopted, seed)
    expect(countUserAttachedVideos(merged)).toBe(1)
    expect(
      murphy(merged).intents.find((intent) => intent.id === 'idle')?.clipSlots[0]?.resultVideo
        ?.blobKey,
    ).toBe('video:murphy-idle-1')
  })

  it('refuses to write a seed library over a cloud copy that already has MP4s', () => {
    const seed = createSeedStudioState()
    const pc = withMurphyUserLibrary(seed)
    expect(shouldWriteRemoteLibrary(seed, pc)).toBe(false)
    expect(shouldWriteRemoteLibrary(pc, seed)).toBe(true)
    expect(shouldWriteRemoteLibrary(pc, null)).toBe(true)
  })

  it('stamps studio-media paths onto uploaded blob keys', () => {
    const pc = withMurphyUserLibrary(createSeedStudioState())
    const stamped = stampCloudMediaPaths(
      pc,
      (key) => `user/${key.replace(/:/g, '__')}`,
      ['video:murphy-idle-1', 'photo:generation:murphy:kitchen'],
    )
    const dog = murphy(stamped)
    expect(dog.generationPhoto?.storagePath).toBe('user/photo__generation__murphy__kitchen')
    expect(
      dog.intents.find((intent) => intent.id === 'idle')?.clipSlots[0]?.resultVideo?.storagePath,
    ).toBe('user/video__murphy-idle-1')
    expect(
      dog.intents.find((intent) => intent.id === 'hug')?.clipSlots[0]?.resultVideo?.storagePath,
    ).toBeUndefined()
  })
})

describe('studio media content type', () => {
  it('strips codecs and infers mp4 from video blob keys', () => {
    const withCodecs = new Blob([new Uint8Array([0])], {
      type: 'video/mp4; codecs=avc1.42E01E',
    })
    expect(inferStudioMediaContentType('video:murphy-idle-1', withCodecs)).toBe('video/mp4')
    const empty = new Blob([new Uint8Array([0])])
    expect(inferStudioMediaContentType('video:murphy-idle-1', empty)).toBe('video/mp4')
    expect(inferStudioMediaContentType('photo:generation:murphy:x', empty)).toBe('image/jpeg')
  })
})
