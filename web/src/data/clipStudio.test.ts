import { describe, expect, it } from 'vitest'
import { createEmptyClipSlot, createEmptyIntent, createSeedStudioState } from './clipStudioSeed'
import { dogLibraryToBuckets } from '../utils/clipStudioCatalog'
import { slugifyIntent } from '../utils/clipStudioMedia'
import {
  applyStudioAction,
  deriveSlotStatus,
} from '../utils/clipStudioStore'
import type { ClipSlot } from '../types/clipStudio'

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

describe('seed personality', () => {
  it('bakes Riley hug / howl and Murphy hug / howl into prompts', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    const riley = seed.dogs.find((dog) => dog.id === 'riley')
    const murphyHug = murphy?.intents.find((intent) => intent.id === 'hug')?.clipSlots[0]
    const rileyHug = riley?.intents.find((intent) => intent.id === 'hug')?.clipSlots[0]
    const murphyHowl = murphy?.intents.find((intent) => intent.id === 'howl')?.clipSlots[0]
    const rileyHowl = riley?.intents.find((intent) => intent.id === 'howl')?.clipSlots[0]

    expect(murphyHug?.prompt).toMatch(/loves hugs/i)
    expect(rileyHug?.prompt).toMatch(/bares her teeth/i)
    expect(murphyHowl?.prompt).toMatch(/howls well/i)
    expect(rileyHowl?.prompt).toMatch(/awkward/i)
  })

  it('exposes hug and howl as playback buckets', () => {
    const seed = createSeedStudioState()
    const buckets = dogLibraryToBuckets(seed.dogs[0])
    expect(buckets.some((bucket) => bucket.id === 'hug')).toBe(true)
    expect(buckets.some((bucket) => bucket.id === 'howl')).toBe(true)
    expect(buckets.find((bucket) => bucket.id === 'come')?.clips.length).toBeGreaterThan(0)
  })
})
