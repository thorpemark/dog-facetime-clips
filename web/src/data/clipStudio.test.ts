import { describe, expect, it } from 'vitest'
import {
  STUDIO_SEED_REVISION,
  createEmptyClipSlot,
  createEmptyIntent,
  createSeedStudioState,
} from './clipStudioSeed'
import { dogLibraryToBuckets } from '../utils/clipStudioCatalog'
import { slugifyIntent } from '../utils/clipStudioMedia'
import {
  applyStudioAction,
  deriveSlotStatus,
  migrateStudioState,
} from '../utils/clipStudioStore'
import type { ClipSlot, ClipStudioState, DogPersonality } from '../types/clipStudio'

describe('slugifyIntent', () => {
  it('turns a display name into a stable id', () => {
    expect(slugifyIntent('Belly Rub')).toBe('belly-rub')
    expect(slugifyIntent('  ')).toBe('intent')
  })
})

describe('deriveSlotStatus', () => {
  const base: ClipSlot = {
    id: 's1',
    weight: 40,
    prompt: 'p',
    label: 'A',
    sourcePhoto: null,
    resultVideo: null,
    status: 'empty',
  }

  it('stays empty without a source photo', () => {
    expect(
      deriveSlotStatus({
        ...base,
        resultVideo: { path: 'clips/x.mp4', origin: 'placeholder' },
      }),
    ).toBe('empty')
  })

  it('becomes photo_ready after a still is added', () => {
    expect(
      deriveSlotStatus({
        ...base,
        sourcePhoto: {
          id: 'p',
          url: 'blob:photo',
          framing: {
            portrait: { focalX: 0.5, focalY: 0.5, focalZoom: 1 },
            landscape: { focalX: 0.5, focalY: 0.5, focalZoom: 1 },
          },
        },
      }),
    ).toBe('photo_ready')
  })

  it('becomes video_attached for a user mp4', () => {
    expect(
      deriveSlotStatus({
        ...base,
        resultVideo: { objectUrl: 'blob:video', origin: 'user' },
      }),
    ).toBe('video_attached')
  })

  it('keeps needs_redo until the status is cleared', () => {
    expect(
      deriveSlotStatus({
        ...base,
        status: 'needs_redo',
        resultVideo: { objectUrl: 'blob:video', origin: 'user' },
      }),
    ).toBe('needs_redo')
  })
})

describe('applyStudioAction', () => {
  it('adds phrases, intents, and clip variants without hardcoded ids', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs[0]
    const withPhrase = applyStudioAction(seed, {
      type: 'addPhrase',
      dogId: murphy.id,
      intentId: 'come',
      phrase: 'get over here please',
    })
    const come = withPhrase.dogs[0].intents.find((intent) => intent.id === 'come')
    expect(come?.phrases).toContain('get over here please')

    const withIntent = applyStudioAction(withPhrase, {
      type: 'addIntent',
      dogId: murphy.id,
      intent: createEmptyIntent(murphy, 'Belly rub', 'belly-rub'),
    })
    expect(withIntent.dogs[0].intents.some((intent) => intent.id === 'belly-rub')).toBe(
      true,
    )

    const belly = withIntent.dogs[0].intents.find((intent) => intent.id === 'belly-rub')
    const withSlot = applyStudioAction(withIntent, {
      type: 'addSlot',
      dogId: murphy.id,
      intentId: 'belly-rub',
      slot: createEmptyClipSlot(murphy, belly!, 2),
    })
    const updated = withSlot.dogs[0].intents.find((intent) => intent.id === 'belly-rub')
    expect(updated?.clipSlots.length).toBe(2)
  })
})

describe('seed modes and photos', () => {
  it('ships Murphy, Riley, and Both with baked stills', () => {
    const seed = createSeedStudioState()
    expect(seed.dogs.map((dog) => dog.id)).toEqual(['murphy', 'riley', 'both'])
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    const riley = seed.dogs.find((dog) => dog.id === 'riley')
    const both = seed.dogs.find((dog) => dog.id === 'both')
    expect(murphy?.defaultPhoto?.publicPath).toBe('modes/murphy.jpg')
    expect(riley?.defaultPhoto?.publicPath).toBe('modes/riley.jpg')
    expect(both?.defaultPhoto?.publicPath).toBe('modes/both.jpg')
    expect(murphy?.defaultPhoto?.url).toMatch(/modes\/murphy\.jpg$/)
    expect(riley?.defaultPhoto?.url).toMatch(/modes\/riley\.jpg$/)

    const murphyIdle = murphy?.intents.find((intent) => intent.id === 'idle')
    const murphyName = murphy?.intents.find((intent) => intent.id === 'name')
    const murphyTreat = murphy?.intents.find((intent) => intent.id === 'treat')
    expect(murphyIdle?.clipSlots[0]?.sourcePhoto?.publicPath).toBe('modes/murphy.jpg')
    expect(murphyName?.clipSlots[0]?.sourcePhoto?.publicPath).toBe('modes/murphy.jpg')
    expect(murphyTreat?.clipSlots[0]?.sourcePhoto).toBeNull()

    expect(riley?.intents.find((intent) => intent.id === 'hug')?.clipSlots[0]?.sourcePhoto?.publicPath).toBe(
      'modes/riley.jpg',
    )
    expect(both?.intents.find((intent) => intent.id === 'idle')?.clipSlots[0]?.sourcePhoto?.publicPath).toBe(
      'modes/both.jpg',
    )

    for (const dog of [murphy, riley, both]) {
      const unknown = dog?.intents.find((intent) => intent.id === 'unknown')
      expect(unknown?.description).toMatch(/head-tilt/i)
      expect(unknown?.clipSlots.length).toBeGreaterThanOrEqual(2)
      expect(unknown?.clipSlots[0]?.sourcePhoto?.publicPath).toBe(
        dog?.defaultPhoto?.publicPath,
      )
      expect(unknown?.clipSlots[0]?.prompt).toMatch(/head-tilt/i)
      expect(unknown?.clipSlots[0]?.prompt).toMatch(/Silence-first/)
    }
  })
})

describe('seed personality', () => {
  it('seeds Murphy and Riley with known trait radios', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    const riley = seed.dogs.find((dog) => dog.id === 'riley')
    const both = seed.dogs.find((dog) => dog.id === 'both')

    expect(murphy?.personality).toMatchObject({
      vocalStyle: 'silent',
      voiceSize: 'large_low',
      energy: 'normal',
      eyes: 'goofy',
      mouth: 'dry',
      touch: 'cuddly',
    })
    expect(riley?.personality).toMatchObject({
      vocalStyle: 'silent',
      voiceSize: 'medium',
      energy: 'normal',
      eyes: 'alert',
      mouth: 'dry',
      touch: 'grumble_hug',
    })
    expect(both?.personality.vocalStyle).toBe('silent')
  })

  it('bakes Riley hug / howl and Murphy hug / howl into prompts', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    const riley = seed.dogs.find((dog) => dog.id === 'riley')
    const murphyHug = murphy?.intents.find((intent) => intent.id === 'hug')?.clipSlots[0]
    const rileyHug = riley?.intents.find((intent) => intent.id === 'hug')?.clipSlots[0]
    const murphyHowl = murphy?.intents.find((intent) => intent.id === 'howl')?.clipSlots[0]
    const rileyHowl = riley?.intents.find((intent) => intent.id === 'howl')?.clipSlots[0]

    expect(murphyHug?.prompt).toMatch(/loves hugs/i)
    expect(rileyHug?.prompt).toMatch(/bares (her )?teeth/i)
    expect(murphyHowl?.prompt).toMatch(/howls well/i)
    expect(rileyHowl?.prompt).toMatch(/awkward/i)
  })

  it('exposes hug and howl as playback buckets', () => {
    const seed = createSeedStudioState()
    const buckets = dogLibraryToBuckets(seed.dogs[0])
    expect(buckets.some((bucket) => bucket.id === 'hug')).toBe(true)
    expect(buckets.some((bucket) => bucket.id === 'howl')).toBe(true)
    expect(buckets.some((bucket) => bucket.id === 'unknown')).toBe(true)
    expect(buckets.find((bucket) => bucket.id === 'come')?.clips.length).toBeGreaterThan(0)
    expect(buckets.find((bucket) => bucket.id === 'unknown')?.clips.length).toBeGreaterThan(0)
  })
})

describe('migrateStudioState personality radios', () => {
  it('fills Murphy/Riley radios on older libraries that only had notes', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs[0]
    const legacy = {
      ...seed,
      seedRevision: 2,
      dogs: [
        {
          ...murphy,
          personality: {
            breed: murphy.personality.breed,
            notes: murphy.personality.notes,
          } as DogPersonality,
        },
        ...seed.dogs.slice(1),
      ],
    }
    const migrated = migrateStudioState(legacy as ClipStudioState)
    expect(migrated.dogs[0].personality.vocalStyle).toBe('silent')
    expect(migrated.dogs[0].personality.touch).toBe('cuddly')
    expect(migrated.dogs[0].personality.eyes).toBe('goofy')
    expect(migrated.seedRevision).toBe(STUDIO_SEED_REVISION)
  })

  it('adds the unknown head-tilt intent to a personality-era library that lacks it', () => {
    const seed = createSeedStudioState()
    const withoutUnknown = {
      ...seed,
      seedRevision: 3,
      dogs: seed.dogs.map((dog) => ({
        ...dog,
        intents: dog.intents.filter((intent) => intent.id !== 'unknown'),
      })),
    }
    const migrated = migrateStudioState(withoutUnknown)
    expect(migrated.seedRevision).toBe(STUDIO_SEED_REVISION)
    for (const dog of migrated.dogs) {
      const unknown = dog.intents.find((intent) => intent.id === 'unknown')
      expect(unknown).toBeDefined()
      expect(unknown?.clipSlots.length).toBeGreaterThanOrEqual(1)
    }
    expect(migrated.dogs.find((dog) => dog.id === 'murphy')?.personality.vocalStyle).toBe(
      'silent',
    )
  })
})
