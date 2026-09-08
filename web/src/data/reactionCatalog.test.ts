import { afterEach, describe, expect, it } from 'vitest'
import {
  isUnknownIntent,
  normalizeClipWeights,
  pickWeightedClip,
  REACTION_CATALOG,
  resetClipPickHistory,
  UNKNOWN_INTENT_ID,
  type ReactionBucket,
} from '../data/reactionCatalog'

function rngFrom(values: number[]): () => number {
  let i = 0
  return () => {
    const value = values[i] ?? 0
    i += 1
    return value
  }
}

const sampleBucket: ReactionBucket = {
  id: 'come',
  phrases: ['come here'],
  priority: 7,
  clips: [
    { path: 'a.mp4', weight: 70, label: 'A' },
    { path: 'b.mp4', weight: 30, label: 'B' },
    { path: 'c.mp4', weight: 0, label: 'C' },
  ],
}

describe('unknown catch-all', () => {
  it('ships a dedicated unknown head-tilt bucket', () => {
    const unknown = REACTION_CATALOG.find((bucket) => bucket.id === UNKNOWN_INTENT_ID)
    expect(unknown?.clips.length).toBeGreaterThanOrEqual(2)
    expect(unknown?.description).toMatch(/head-tilt/i)
    expect(isUnknownIntent('unknown')).toBe(true)
    expect(isUnknownIntent('confused')).toBe(true)
    expect(isUnknownIntent('come')).toBe(false)
  })
})

describe('holiday costume-walk catalog', () => {
  it('seeds holiday intents before the unknown catch-all', () => {
    const ids = REACTION_CATALOG.map((bucket) => bucket.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'halloween',
        'thanksgiving',
        'christmas',
        'new-years',
        'valentines-day',
        'super-bowl-sunday',
        'st-patricks-day',
        'birthday',
        'memorial-day',
        'fourth-of-july',
        'labor-day',
      ]),
    )
    expect(ids.indexOf('thanksgiving')).toBeLessThan(ids.indexOf(UNKNOWN_INTENT_ID))
    const thanksgiving = REACTION_CATALOG.find((bucket) => bucket.id === 'thanksgiving')
    expect(thanksgiving?.phrases).toContain('happy thanksgiving')
    expect(thanksgiving?.clips.every((clip) => clip.path === '')).toBe(true)
  })
})

describe('normalizeClipWeights', () => {
  it('converts relative weights to percents', () => {
    const result = normalizeClipWeights(sampleBucket.clips)
    expect(result[0].percent).toBe(70)
    expect(result[1].percent).toBe(30)
    expect(result[2].percent).toBe(0)
  })

  it('treats 40/30/30 the same as 4/3/3', () => {
    const a = normalizeClipWeights([
      { path: 'a', weight: 40 },
      { path: 'b', weight: 30 },
      { path: 'c', weight: 30 },
    ])
    const b = normalizeClipWeights([
      { path: 'a', weight: 4 },
      { path: 'b', weight: 3 },
      { path: 'c', weight: 3 },
    ])
    expect(a.map((c) => c.percent)).toEqual(b.map((c) => c.percent))
  })
})

describe('pickWeightedClip', () => {
  afterEach(() => {
    resetClipPickHistory()
  })

  it('always picks the only positive-weight clip', () => {
    const bucket: ReactionBucket = {
      ...sampleBucket,
      clips: [
        { path: 'only.mp4', weight: 100 },
        { path: 'zero.mp4', weight: 0 },
      ],
    }
    expect(pickWeightedClip(bucket, { rng: () => 0.99, excludeLast: false })).toBe(
      'only.mp4',
    )
  })

  it('is deterministic with a seeded rng', () => {
    const low = pickWeightedClip(sampleBucket, {
      rng: rngFrom([0.1]),
      excludeLast: false,
    })
    const high = pickWeightedClip(sampleBucket, {
      rng: rngFrom([0.9]),
      excludeLast: false,
    })
    expect(low).toBe('a.mp4')
    expect(high).toBe('b.mp4')
  })

  it('avoids repeating the last pick when possible', () => {
    pickWeightedClip(sampleBucket, { rng: rngFrom([0.0]), excludeLast: true })
    const second = pickWeightedClip(sampleBucket, {
      rng: rngFrom([0.0]),
      excludeLast: true,
    })
    expect(second).toBe('b.mp4')
  })
})
