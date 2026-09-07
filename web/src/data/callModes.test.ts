import { describe, expect, it } from 'vitest'
import {
  CALL_MODES,
  callModeForName,
  defaultSourcePhotoForMode,
  isKeySeedIntent,
  modePhotoUrl,
} from './callModes'
import { STUDIO_SEED_REVISION } from './clipStudioSeed'
import { migrateStudioState } from '../utils/clipStudioStore'
import type { ClipStudioState } from '../types/clipStudio'

describe('call modes', () => {
  it('identifies Murphy as tan, Riley as black/white, Both as together', () => {
    expect(CALL_MODES.map((mode) => mode.id)).toEqual(['murphy', 'riley', 'both'])
    expect(callModeForName('Murphy')?.photoPath).toBe('modes/murphy.jpg')
    expect(callModeForName('Riley')?.photoPath).toBe('modes/riley.jpg')
    expect(callModeForName('together')?.id).toBe('both')
    expect(callModeForName('Both')?.kind).toBe('together')
    expect(CALL_MODES[0].subtitle).toMatch(/tan/i)
    expect(CALL_MODES[1].subtitle).toMatch(/black/i)
  })

  it('resolves public URLs for Pages and local', () => {
    const murphy = CALL_MODES[0]
    expect(modePhotoUrl(murphy)).toMatch(/modes\/murphy\.jpg$/)
    expect(defaultSourcePhotoForMode(murphy).publicPath).toBe('modes/murphy.jpg')
  })

  it('marks idle and key reaction intents for seed stills', () => {
    expect(isKeySeedIntent('idle')).toBe(true)
    expect(isKeySeedIntent('name')).toBe(true)
    expect(isKeySeedIntent('unknown')).toBe(true)
    expect(isKeySeedIntent('treat')).toBe(false)
  })
})

describe('studio seed migration', () => {
  it('adds Both and seed stills to an older Murphy/Riley studio', () => {
    const legacy: ClipStudioState = {
      version: 1,
      activeDogId: 'murphy',
      dogs: [
        {
          id: 'murphy',
          name: 'Murphy',
          personality: { breed: 'huskita', notes: [] } as ClipStudioState['dogs'][number]['personality'],
          intents: [
            {
              id: 'name',
              description: 'Dog name',
              phrases: ['{dogName}'],
              semanticHints: '',
              priority: 10,
              clipSlots: [
                {
                  id: 'murphy-name-1',
                  weight: 40,
                  prompt: 'p',
                  label: 'Perk',
                  sourcePhoto: null,
                  resultVideo: null,
                  status: 'empty',
                },
              ],
            },
          ],
        },
        {
          id: 'riley',
          name: 'Riley',
          personality: { breed: 'huskita', notes: [] } as ClipStudioState['dogs'][number]['personality'],
          intents: [],
        },
      ],
    }

    const next = migrateStudioState(legacy)
    expect(next.seedRevision).toBe(STUDIO_SEED_REVISION)
    expect(next.dogs.some((dog) => dog.id === 'both')).toBe(true)
    const murphy = next.dogs.find((dog) => dog.id === 'murphy')
    expect(murphy?.defaultPhoto?.publicPath).toBe('modes/murphy.jpg')
    expect(murphy?.intents[0]?.clipSlots[0]?.sourcePhoto?.publicPath).toBe(
      'modes/murphy.jpg',
    )
    expect(murphy?.personality.vocalStyle).toBe('silent')
    expect(murphy?.personality.touch).toBe('cuddly')
    expect(next.dogs.find((dog) => dog.id === 'riley')?.personality.touch).toBe(
      'grumble_hug',
    )
    expect(murphy?.intents.some((intent) => intent.id === 'unknown')).toBe(true)
    expect(
      murphy?.intents.find((intent) => intent.id === 'unknown')?.clipSlots[0]
        ?.sourcePhoto?.publicPath,
    ).toBe('modes/murphy.jpg')
  })
})
