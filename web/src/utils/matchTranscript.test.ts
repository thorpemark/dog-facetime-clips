import { describe, expect, it } from 'vitest'
import { REACTION_CATALOG } from '../data/reactionCatalog'
import {
  MATCH_CONFIDENCE_THRESHOLD,
  matchTranscript,
  stripNames,
} from '../utils/matchTranscript'

const names = { dogName: 'Murphy', ownerName: 'Mark' }

describe('stripNames', () => {
  it('removes the dog name and common nicknames', () => {
    expect(stripNames('come here murph', 'Murphy', 'Mark')).toBe('come here')
    expect(stripNames('hey murphy', 'Murphy', 'Mark')).toBe('hey')
  })
})

describe('matchTranscript', () => {
  it('maps paraphrases of come-here to the come bucket', () => {
    expect(matchTranscript('come here Murph', names)?.bucketId).toBe('come')
    expect(matchTranscript('could you come over here', names)?.bucketId).toBe(
      'come',
    )
    expect(matchTranscript("c'mere buddy", names)?.bucketId).toBe('come')
  })

  it('matches treat and walk by meaning, not exact wording', () => {
    expect(matchTranscript('want some chicken?', names)?.bucketId).toBe('treat')
    expect(matchTranscript("let's go outside", names)?.bucketId).toBe('walk')
    expect(matchTranscript("who's a good boy", names)?.bucketId).toBe('good')
  })

  it('fires name when the name is the utterance', () => {
    expect(matchTranscript('Murphy', names)?.bucketId).toBe('name')
    expect(matchTranscript('hey Murphy', names)?.bucketId).toBe('name')
  })

  it('fires owner when the owner name is spoken alone', () => {
    expect(matchTranscript('Mark', names)?.bucketId).toBe('owner')
  })

  it('stays idle below the confidence threshold', () => {
    expect(matchTranscript('the weather is lovely today', names)).toBeNull()
    expect(matchTranscript('asdf qwerty zxcv', names)).toBeNull()
  })

  it('uses keyword fallback for seed phrases', () => {
    const hit = matchTranscript('stop that', names)
    expect(hit?.bucketId).toBe('no')
    expect(hit?.method).toBe('keyword')
  })

  it('does not treat "no" inside other words as a match', () => {
    expect(matchTranscript('I know', names)?.bucketId).not.toBe('no')
  })

  it('scores every catalog bucket without throwing', () => {
    for (const bucket of REACTION_CATALOG) {
      const phrase = bucket.phrases[0]?.replace('{dogName}', 'Murphy').replace(
        '{ownerName}',
        'Mark',
      )
      const hit = matchTranscript(phrase ?? bucket.id, names)
      expect(hit?.bucketId).toBe(bucket.id)
    }
    expect(MATCH_CONFIDENCE_THRESHOLD).toBeGreaterThan(0)
  })
})
