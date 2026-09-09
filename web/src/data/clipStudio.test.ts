import { describe, expect, it } from 'vitest'
import {
  STUDIO_SEED_REVISION,
  createEmptyClipSlot,
  createEmptyIntent,
  createSeedStudioState,
} from './clipStudioSeed'
import { dogLibraryToBuckets } from '../utils/clipStudioCatalog'
import { slugifyIntent } from '../utils/clipStudioMedia'
import { HOLIDAY_INTENT_IDS } from './holidayIntents'
import {
  applyStudioAction,
  deriveSlotStatus,
  migrateStudioState,
  resolveSourcePhoto,
  toPersistedStudioState,
} from '../utils/clipStudioStore'
import { fullImageDualFraming, type DualFraming } from '../utils/focalPoint'
import type { ClipSlot, ClipSourcePhoto, ClipStudioState, DogPersonality } from '../types/clipStudio'

function expectFullImageFraming(framing: DualFraming | undefined) {
  expect(framing?.portrait.cropWidth).toBe(1)
  expect(framing?.portrait.cropHeight).toBe(1)
  expect(framing?.portrait.focalX).toBe(0.5)
  expect(framing?.portrait.focalY).toBe(0.5)
  expect(framing?.landscape.cropWidth).toBe(1)
  expect(framing?.landscape.cropHeight).toBe(1)
  expect(framing?.landscape.focalX).toBe(0.5)
  expect(framing?.landscape.focalY).toBe(0.5)
}

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

  it('stores the original MP4 name on a slot without wiping sibling attachments', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs[0]
    const howl = murphy.intents.find((intent) => intent.id === 'howl')
    const hug = murphy.intents.find((intent) => intent.id === 'hug')
    const howlSlot = howl?.clipSlots[0]
    const hugSlot = hug?.clipSlots[0]
    if (!howlSlot || !hugSlot) throw new Error('missing slots')

    const withHug = applyStudioAction(seed, {
      type: 'updateSlot',
      dogId: murphy.id,
      intentId: 'hug',
      slotId: hugSlot.id,
      patch: {
        resultVideo: {
          objectUrl: 'blob:hug',
          blobKey: `video:${hugSlot.id}`,
          origin: 'user',
          fileName: 'riley-hug.mp4',
          originalName: 'riley-hug.mp4',
        },
      },
    })
    const withHowl = applyStudioAction(withHug, {
      type: 'updateSlot',
      dogId: murphy.id,
      intentId: 'howl',
      slotId: howlSlot.id,
      patch: {
        resultVideo: {
          objectUrl: 'blob:howl',
          blobKey: `video:${howlSlot.id}`,
          origin: 'user',
          fileName: 'murphy-howl-strong.mp4',
          originalName: 'murphy-howl-strong.mp4',
        },
      },
    })

    const persisted = toPersistedStudioState(withHowl)
    const persistedHowl = persisted.dogs[0].intents
      .find((intent) => intent.id === 'howl')
      ?.clipSlots.find((slot) => slot.id === howlSlot.id)
    const persistedHug = persisted.dogs[0].intents
      .find((intent) => intent.id === 'hug')
      ?.clipSlots.find((slot) => slot.id === hugSlot.id)
    expect(persistedHowl?.resultVideo?.objectUrl).toBeUndefined()
    expect(persistedHowl?.resultVideo?.blobKey).toBe(`video:${howlSlot.id}`)
    expect(persistedHowl?.resultVideo?.originalName).toBe('murphy-howl-strong.mp4')
    expect(persistedHowl?.resultVideo?.fileName).toBe('murphy-howl-strong.mp4')
    expect(persistedHug?.resultVideo?.blobKey).toBe(`video:${hugSlot.id}`)
    expect(persistedHug?.resultVideo?.originalName).toBe('riley-hug.mp4')
  })

  it('persists a preferred call-idle slot without dropping videos', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs[0]
    const idle = murphy.intents.find((intent) => intent.id === 'idle')
    const second = idle?.clipSlots[1]
    if (!second) throw new Error('missing idle slot')
    const withVideo = applyStudioAction(seed, {
      type: 'updateSlot',
      dogId: murphy.id,
      intentId: 'idle',
      slotId: second.id,
      patch: {
        resultVideo: { objectUrl: 'blob:chosen-idle', origin: 'user' },
      },
    })
    const chosen = applyStudioAction(withVideo, {
      type: 'setPreferredIdle',
      dogId: murphy.id,
      slotId: second.id,
    })
    expect(chosen.dogs[0].preferredIdleSlotId).toBe(second.id)
    const idleSlot = chosen.dogs[0].intents
      .find((intent) => intent.id === 'idle')
      ?.clipSlots.find((slot) => slot.id === second.id)
    expect(idleSlot?.resultVideo?.objectUrl).toBe('blob:chosen-idle')
  })

  it('stores a generation still without changing the tab avatar or attached videos', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs[0]
    const kitchen: ClipSourcePhoto = {
      id: 'kitchen',
      url: 'blob:kitchen',
      blobKey: 'photo:generation:murphy:kitchen',
      framing: {
        portrait: { focalX: 0.42, focalY: 0.31, focalZoom: 1.15 },
        landscape: { focalX: 0.4, focalY: 0.35, focalZoom: 1 },
      },
    }
    const idle = murphy.intents.find((intent) => intent.id === 'idle')
    const firstIdle = idle?.clipSlots[0]
    if (!firstIdle) throw new Error('missing idle')
    const withVideo = applyStudioAction(seed, {
      type: 'updateSlot',
      dogId: murphy.id,
      intentId: 'idle',
      slotId: firstIdle.id,
      patch: {
        resultVideo: { objectUrl: 'blob:idle-mp4', origin: 'user', blobKey: 'video:idle' },
      },
    })
    const treat = withVideo.dogs[0].intents.find((intent) => intent.id === 'treat')
    const emptyTreat = treat?.clipSlots.find((slot) => !slot.sourcePhoto)
    if (!emptyTreat) throw new Error('expected an empty treat slot')

    const next = applyStudioAction(withVideo, {
      type: 'setGenerationPhoto',
      dogId: murphy.id,
      photo: kitchen,
    })
    const dog = next.dogs[0]
    expect(dog.generationPhoto?.url).toBe('blob:kitchen')
    expectFullImageFraming(dog.generationPhoto?.framing)
    expect(dog.defaultPhoto?.publicPath).toBe('modes/murphy.jpg')
    expect(dog.avatarPath).toBe('modes/murphy.jpg')

    const idleAfter = dog.intents.find((intent) => intent.id === 'idle')?.clipSlots[0]
    expect(idleAfter?.sourcePhoto?.blobKey).toBe(kitchen.blobKey)
    expect(idleAfter?.sourcePhoto?.publicPath).toBeUndefined()
    expectFullImageFraming(idleAfter?.sourcePhoto?.framing)
    expect(idleAfter?.resultVideo?.objectUrl).toBe('blob:idle-mp4')
    expect(idleAfter?.resultVideo?.blobKey).toBe('video:idle')

    const filledTreat = dog.intents
      .find((intent) => intent.id === 'treat')
      ?.clipSlots.find((slot) => slot.id === emptyTreat.id)
    expect(filledTreat?.sourcePhoto?.blobKey).toBe(kitchen.blobKey)
    expectFullImageFraming(filledTreat?.sourcePhoto?.framing)
    expect(filledTreat?.sourcePhoto?.id).not.toBe(kitchen.id)
    expect(filledTreat?.status).toBe('photo_ready')

    const videosBefore: string[] = []
    const videosAfter: string[] = []
    for (const intent of withVideo.dogs[0].intents) {
      for (const slot of intent.clipSlots) {
        if (slot.resultVideo?.origin === 'user' && slot.resultVideo.objectUrl) {
          videosBefore.push(`${intent.id}:${slot.id}:${slot.resultVideo.objectUrl}`)
        }
      }
    }
    for (const intent of dog.intents) {
      for (const slot of intent.clipSlots) {
        if (slot.resultVideo?.origin === 'user' && slot.resultVideo.objectUrl) {
          videosAfter.push(`${intent.id}:${slot.id}:${slot.resultVideo.objectUrl}`)
        }
      }
    }
    expect(videosAfter).toEqual(videosBefore)
  })

  it('copies the generation still onto new intents, not the picker avatar', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs[0]
    const kitchen: ClipSourcePhoto = {
      id: 'kitchen',
      url: 'blob:kitchen',
      blobKey: 'photo:generation:murphy:kitchen',
      framing: {
        portrait: { focalX: 0.5, focalY: 0.28, focalZoom: 1.2 },
        landscape: { focalX: 0.5, focalY: 0.3, focalZoom: 1 },
      },
    }
    const withStill = applyStudioAction(seed, {
      type: 'setGenerationPhoto',
      dogId: murphy.id,
      photo: kitchen,
      fillEmptySlots: false,
    })
    const dog = withStill.dogs[0]
    const withIntent = applyStudioAction(withStill, {
      type: 'addIntent',
      dogId: dog.id,
      intent: createEmptyIntent(dog, 'Belly rub', 'belly-rub'),
    })
    const belly = withIntent.dogs[0].intents.find((intent) => intent.id === 'belly-rub')
    const slot = belly?.clipSlots[0]
    expect(slot?.sourcePhoto?.blobKey).toBe(kitchen.blobKey)
    expectFullImageFraming(slot?.sourcePhoto?.framing)
    expect(slot?.sourcePhoto?.publicPath).toBeUndefined()
    expect(slot?.status).toBe('photo_ready')

    const hugVariant = createEmptyClipSlot(dog, { id: 'hug', description: 'Hug' }, 4)
    expect(hugVariant.sourcePhoto?.blobKey).toBe(kitchen.blobKey)
    expectFullImageFraming(hugVariant.sourcePhoto?.framing)

    const withoutStill = createEmptyClipSlot(murphy, { id: 'hug', description: 'Hug' }, 5)
    expect(withoutStill.sourcePhoto).toBeNull()
    expect(withoutStill.status).toBe('empty')

    const emptySlot: ClipSlot = {
      id: 'empty-1',
      weight: 40,
      prompt: 'p',
      label: 'A',
      sourcePhoto: null,
      resultVideo: null,
      status: 'empty',
    }
    expect(resolveSourcePhoto(emptySlot, dog)?.url).toBe('blob:kitchen')
    expect(resolveSourcePhoto(emptySlot, murphy)?.url).toBeFalsy()
  })

  it('applies full-frame when setting a generation still even if the source crop was tight', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs[0]
    const cropped: ClipSourcePhoto = {
      id: 'tight',
      url: 'blob:tight',
      blobKey: 'photo:generation:murphy:tight',
      framing: {
        portrait: { focalX: 0.42, focalY: 0.31, focalZoom: 1.15, cropWidth: 0.4, cropHeight: 0.5 },
        landscape: { focalX: 0.4, focalY: 0.35, focalZoom: 1, cropWidth: 0.6, cropHeight: 0.4 },
      },
    }
    const applied = applyStudioAction(seed, {
      type: 'setGenerationPhoto',
      dogId: murphy.id,
      photo: cropped,
    })
    expectFullImageFraming(applied.dogs[0].generationPhoto?.framing)
    expectFullImageFraming(fullImageDualFraming())

    const refined = applyStudioAction(applied, {
      type: 'setGenerationPhoto',
      dogId: murphy.id,
      photo: cropped,
      fillEmptySlots: false,
    })
    expect(refined.dogs[0].generationPhoto?.framing.portrait.cropWidth).toBe(0.4)
    const laterIntent = applyStudioAction(refined, {
      type: 'addIntent',
      dogId: murphy.id,
      intent: createEmptyIntent(refined.dogs[0], 'Kitchen treat', 'kitchen-treat'),
    })
    const laterSlot = laterIntent.dogs[0].intents.find((intent) => intent.id === 'kitchen-treat')
      ?.clipSlots[0]
    expectFullImageFraming(laterSlot?.sourcePhoto?.framing)
  })

  it('keeps a custom unique slot photo when applying the generation still', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs[0]
    const kitchen: ClipSourcePhoto = {
      id: 'kitchen',
      url: 'blob:kitchen',
      blobKey: 'photo:generation:murphy:kitchen',
      framing: fullImageDualFraming(),
    }
    const treat = murphy.intents.find((intent) => intent.id === 'treat')
    const treatSlot = treat?.clipSlots[0]
    if (!treatSlot) throw new Error('missing treat slot')
    const custom: ClipSourcePhoto = {
      id: 'custom-crop',
      url: 'blob:custom',
      blobKey: `photo:${treatSlot.id}`,
      framing: {
        portrait: { focalX: 0.4, focalY: 0.3, focalZoom: 1.4, cropWidth: 0.5, cropHeight: 0.6 },
        landscape: { focalX: 0.4, focalY: 0.3, focalZoom: 1.2, cropWidth: 0.6, cropHeight: 0.5 },
      },
    }
    const withCustom = applyStudioAction(seed, {
      type: 'updateSlot',
      dogId: murphy.id,
      intentId: 'treat',
      slotId: treatSlot.id,
      patch: { sourcePhoto: custom },
    })
    const withStill = applyStudioAction(withCustom, {
      type: 'setGenerationPhoto',
      dogId: murphy.id,
      photo: kitchen,
    })
    const afterApply = applyStudioAction(withStill, {
      type: 'applyGenerationStill',
      dogId: murphy.id,
    })
    const treatAfter = afterApply.dogs[0].intents
      .find((intent) => intent.id === 'treat')
      ?.clipSlots.find((slot) => slot.id === treatSlot.id)
    expect(treatAfter?.sourcePhoto?.blobKey).toBe(`photo:${treatSlot.id}`)
    expect(treatAfter?.sourcePhoto?.url).toBe('blob:custom')
    expect(treatAfter?.sourcePhoto?.framing.portrait.cropWidth).toBe(0.5)

    const riley = seed.dogs.find((dog) => dog.id === 'riley')
    if (!riley) throw new Error('missing riley')
    const rileyStill = applyStudioAction(seed, {
      type: 'setGenerationPhoto',
      dogId: riley.id,
      photo: {
        id: 'riley-kitchen',
        url: 'blob:riley-kitchen',
        blobKey: 'photo:generation:riley:kitchen',
        framing: fullImageDualFraming(),
      },
    })
    const rileyDog = rileyStill.dogs.find((dog) => dog.id === 'riley')
    const rileyHug = rileyDog?.intents.find((intent) => intent.id === 'hug')?.clipSlots[0]
    expect(rileyHug?.sourcePhoto?.blobKey).toBe('photo:generation:riley:kitchen')
    expectFullImageFraming(rileyHug?.sourcePhoto?.framing)
    expect(rileyHug?.sourcePhoto?.publicPath).toBeUndefined()
  })

  it('applyGenerationStill copies the portrait onto Riley and Both defaults without dropping videos', () => {
    const seed = createSeedStudioState()
    const riley = seed.dogs.find((dog) => dog.id === 'riley')
    const both = seed.dogs.find((dog) => dog.id === 'both')
    if (!riley || !both) throw new Error('missing seed dogs')
    const hug = riley.intents.find((intent) => intent.id === 'hug')?.clipSlots[0]
    if (!hug) throw new Error('missing riley hug')
    const withVideo = applyStudioAction(seed, {
      type: 'updateSlot',
      dogId: riley.id,
      intentId: 'hug',
      slotId: hug.id,
      patch: {
        resultVideo: { objectUrl: 'blob:riley-hug', origin: 'user', blobKey: 'video:riley-hug' },
      },
    })
    const withStill = applyStudioAction(withVideo, {
      type: 'setGenerationPhoto',
      dogId: riley.id,
      photo: {
        id: 'riley-gen',
        url: 'blob:riley-gen',
        blobKey: 'photo:generation:riley:gen',
        framing: {
          portrait: { focalX: 0.4, focalY: 0.3, focalZoom: 1.2 },
          landscape: { focalX: 0.4, focalY: 0.3, focalZoom: 1 },
        },
      },
      fillEmptySlots: false,
    })
    const applied = applyStudioAction(withStill, {
      type: 'applyGenerationStill',
      dogId: riley.id,
    })
    const rileyAfter = applied.dogs.find((dog) => dog.id === 'riley')
    const hugAfter = rileyAfter?.intents.find((intent) => intent.id === 'hug')?.clipSlots[0]
    expect(hugAfter?.sourcePhoto?.blobKey).toBe('photo:generation:riley:gen')
    expectFullImageFraming(hugAfter?.sourcePhoto?.framing)
    expect(hugAfter?.resultVideo?.objectUrl).toBe('blob:riley-hug')

    const bothApplied = applyStudioAction(applied, {
      type: 'setGenerationPhoto',
      dogId: both.id,
      photo: {
        id: 'both-gen',
        url: 'blob:both-gen',
        blobKey: 'photo:generation:both:gen',
        framing: fullImageDualFraming(),
      },
    })
    const bothAfter = bothApplied.dogs.find((dog) => dog.id === 'both')
    const bothIdle = bothAfter?.intents.find((intent) => intent.id === 'idle')?.clipSlots[0]
    expect(bothIdle?.sourcePhoto?.blobKey).toBe('photo:generation:both:gen')
    expectFullImageFraming(bothIdle?.sourcePhoto?.framing)
    expect(bothAfter?.defaultPhoto?.publicPath).toBe('modes/both.jpg')
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

      for (const holidayId of HOLIDAY_INTENT_IDS) {
        const holiday = dog?.intents.find((intent) => intent.id === holidayId)
        expect(holiday, `${dog?.name} missing ${holidayId}`).toBeDefined()
        expect(holiday?.clipSlots.length).toBeGreaterThanOrEqual(1)
        expect(holiday?.clipSlots[0]?.resultVideo).toBeNull()
        expect(holiday?.clipSlots[0]?.prompt).toMatch(/walks off camera/i)
        expect(holiday?.clipSlots[0]?.prompt).toMatch(/10s/)
        expect(holiday?.clipSlots[0]?.prompt).toMatch(/Do not use the usual 6s/)
        expect(holiday?.clipSlots[0]?.prompt).not.toMatch(/peaks in the first ~2–3 seconds/)
      }
    }

    const thanksgiving = murphy?.intents.find((intent) => intent.id === 'thanksgiving')
    expect(thanksgiving?.phrases).toEqual(
      expect.arrayContaining(['happy thanksgiving', 'thanksgiving']),
    )
    expect(thanksgiving?.clipSlots[0]?.prompt).toMatch(/Pilgrim dog costume/i)
    const bothHoliday = both?.intents.find((intent) => intent.id === 'thanksgiving')
    expect(bothHoliday?.clipSlots[0]?.prompt).toMatch(/both dogs stay identifiable/i)
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

  it('plays attached user clips instead of leftover placeholder variants', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs[0]
    const hug = murphy.intents.find((intent) => intent.id === 'hug')
    if (!hug) throw new Error('missing hug')
    const withUser = {
      ...murphy,
      intents: murphy.intents.map((intent) =>
        intent.id === 'hug'
          ? {
              ...intent,
              clipSlots: [
                {
                  ...hug.clipSlots[0],
                  resultVideo: { objectUrl: 'blob:hug-user', origin: 'user' as const },
                },
                ...hug.clipSlots.slice(1),
              ],
            }
          : intent,
      ),
    }
    const hugBucket = dogLibraryToBuckets(withUser).find((bucket) => bucket.id === 'hug')
    expect(hugBucket?.clips.map((clip) => clip.path)).toEqual(['blob:hug-user'])
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

  it('adds missing holiday intents without wiping Halloween videos or the generation still', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    if (!murphy) throw new Error('missing murphy')
    const halloween = murphy.intents.find((intent) => intent.id === 'halloween')
    if (!halloween) throw new Error('missing halloween')
    const halloweenSlot = {
      ...halloween.clipSlots[0],
      resultVideo: {
        objectUrl: 'blob:murphy-halloween',
        blobKey: 'video:murphy-halloween',
        origin: 'user' as const,
        fileName: 'halloween.mp4',
      },
      status: 'video_attached' as const,
    }
    const kitchen: ClipSourcePhoto = {
      id: 'kitchen',
      url: 'blob:kitchen',
      blobKey: 'photo:generation:murphy:kitchen',
      framing: fullImageDualFraming(),
    }
    const stored = {
      ...seed,
      seedRevision: 5,
      dogs: seed.dogs.map((dog) => {
        if (dog.id !== 'murphy') {
          return {
            ...dog,
            intents: dog.intents.filter((intent) => !HOLIDAY_INTENT_IDS.includes(intent.id)),
          }
        }
        return {
          ...dog,
          generationPhoto: kitchen,
          intents: dog.intents
            .filter((intent) => intent.id === 'halloween' || !HOLIDAY_INTENT_IDS.includes(intent.id))
            .map((intent) =>
              intent.id === 'halloween'
                ? {
                    ...intent,
                    description: 'Halloween',
                    clipSlots: [halloweenSlot, ...intent.clipSlots.slice(1)],
                  }
                : intent,
            ),
        }
      }),
    }
    const migrated = migrateStudioState(stored)
    expect(migrated.seedRevision).toBe(STUDIO_SEED_REVISION)
    const migratedMurphy = migrated.dogs.find((dog) => dog.id === 'murphy')
    const keptHalloween = migratedMurphy?.intents.find((intent) => intent.id === 'halloween')
    expect(keptHalloween?.clipSlots[0]?.resultVideo?.objectUrl).toBe('blob:murphy-halloween')
    expect(keptHalloween?.clipSlots[0]?.resultVideo?.blobKey).toBe('video:murphy-halloween')
    expect(migratedMurphy?.generationPhoto?.blobKey).toBe(kitchen.blobKey)

    for (const holidayId of HOLIDAY_INTENT_IDS) {
      expect(
        migratedMurphy?.intents.some((intent) => intent.id === holidayId),
        `murphy missing ${holidayId} after migrate`,
      ).toBe(true)
    }
    const thanksgiving = migratedMurphy?.intents.find((intent) => intent.id === 'thanksgiving')
    expect(thanksgiving?.clipSlots[0]?.sourcePhoto?.blobKey).toBe(kitchen.blobKey)
    expectFullImageFraming(thanksgiving?.clipSlots[0]?.sourcePhoto?.framing)

    const migratedRiley = migrated.dogs.find((dog) => dog.id === 'riley')
    expect(migratedRiley?.intents.some((intent) => intent.id === 'thanksgiving')).toBe(true)
    expect(migratedRiley?.intents.some((intent) => intent.id === 'labor-day')).toBe(true)
  })
})
