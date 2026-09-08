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

  it('falls back to the unknown head-tilt below the confidence threshold', () => {
    const weather = matchTranscript('the weather is lovely today', names)
    expect(weather?.bucketId).toBe('unknown')
    expect(weather?.method).toBe('fallback')
    const gibberish = matchTranscript('asdf qwerty zxcv', names)
    expect(gibberish?.bucketId).toBe('unknown')
    expect(gibberish?.method).toBe('fallback')
    expect(matchTranscript('   ', names)).toBeNull()
  })

  it('does not steal recognized phrases for the unknown catch-all', () => {
    expect(matchTranscript('come here Murph', names)?.bucketId).toBe('come')
    expect(matchTranscript('want a hug', names)?.bucketId).toBe('hug')
    expect(matchTranscript('Murphy', names)?.method).not.toBe('fallback')
  })

  it('uses a per-library confused slot when that is the catch-all id', () => {
    const catalog = [
      {
        id: 'come',
        phrases: ['come here'],
        clips: [{ path: 'come.mp4', weight: 100 }],
        priority: 7,
      },
      {
        id: 'confused',
        phrases: [],
        clips: [{ path: 'tilt.mp4', weight: 100 }],
        priority: 0,
        description: 'Confused head-tilt',
      },
    ]
    const hit = matchTranscript('purple elephant calculus', {
      ...names,
      catalog,
    })
    expect(hit?.bucketId).toBe('confused')
    expect(hit?.method).toBe('fallback')
    expect(matchTranscript('come here', { ...names, catalog })?.bucketId).toBe(
      'come',
    )
  })

  it('uses keyword fallback for seed phrases', () => {
    const hit = matchTranscript('stop that', names)
    expect(hit?.bucketId).toBe('no')
    expect(hit?.method).toBe('keyword')
  })

  it('does not treat "no" inside other words as a match', () => {
    expect(matchTranscript('I know', names)?.bucketId).not.toBe('no')
  })

  it('matches hug and howl paraphrases', () => {
    expect(matchTranscript('want a hug', names)?.bucketId).toBe('hug')
    expect(matchTranscript('sing it', names)?.bucketId).toBe('howl')
  })

  it('matches play invitations to the play-bow bucket', () => {
    expect(matchTranscript('want to play', names)?.bucketId).toBe('play')
    expect(matchTranscript('do you want to play', names)?.bucketId).toBe('play')
    expect(matchTranscript('play', names)?.bucketId).toBe('play')
    expect(matchTranscript('play fight', names)?.bucketId).toBe('play')
    expect(matchTranscript('come play', names)?.bucketId).toBe('play')
  })

  it('matches holiday greetings to costume-walk intents', () => {
    expect(matchTranscript('happy thanksgiving', names)?.bucketId).toBe('thanksgiving')
    expect(matchTranscript('merry christmas', names)?.bucketId).toBe('christmas')
    expect(matchTranscript('happy halloween', names)?.bucketId).toBe('halloween')
    expect(matchTranscript('happy birthday', names)?.bucketId).toBe('birthday')
    expect(matchTranscript('super bowl', names)?.bucketId).toBe('super-bowl-sunday')
    expect(matchTranscript('go birds', names)?.bucketId).toBe('super-bowl-sunday')
    expect(matchTranscript('4th of july', names)?.bucketId).toBe('fourth-of-july')
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
