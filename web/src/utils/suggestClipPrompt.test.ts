import { describe, expect, it } from 'vitest'
import { MURPHY_PERSONALITY, RILEY_PERSONALITY, createSeedStudioState } from '../data/clipStudioSeed'
import { suggestClipPrompt } from './suggestClipPrompt'

const framing = {
  portrait: { focalX: 0.5, focalY: 0.42, focalZoom: 1.6 },
  landscape: { focalX: 0.5, focalY: 0.5, focalZoom: 1 },
}

describe('suggestClipPrompt', () => {
  it('bakes Riley hug / howl and Murphy hug / howl personality', () => {
    const rileyHug = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'hug',
      intentDescription: 'Hug / cuddle',
      slotLabel: 'Side-touch reaction',
    })
    const murphyHug = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'hug',
      intentDescription: 'Hug / cuddle',
      slotLabel: 'Hug reaction',
    })
    const rileyHowl = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'howl',
      intentDescription: 'Howl / sing',
      slotLabel: 'Howl attempt',
    })
    const murphyHowl = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'howl',
      intentDescription: 'Howl / sing',
      slotLabel: 'Howl / sing',
    })

    expect(rileyHug).toMatch(/bares her teeth/i)
    expect(rileyHug).toMatch(/growl/i)
    expect(murphyHug).toMatch(/loves hugs/i)
    expect(murphyHug).toMatch(/chest scratch/i)
    expect(murphyHug).toMatch(/nose tilted up/i)
    expect(rileyHowl).toMatch(/awkward/i)
    expect(murphyHowl).toMatch(/howls well/i)
    expect(murphyHowl).toMatch(/strong, committed sing/i)
  })

  it('is ready to paste into Grok Imagine image-to-video', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'treat',
      intentDescription: 'Treat / chicken',
      slotLabel: 'Excited, mouth open',
      hasSourcePhoto: true,
      framing,
    })

    expect(prompt).toMatch(/Grok Imagine/i)
    expect(prompt).toMatch(/image-to-video/i)
    expect(prompt).toMatch(/6 second/i)
    expect(prompt).toMatch(/9:16/)
    expect(prompt).toMatch(/return to (a )?calm FaceTime idle/i)
    expect(prompt).toMatch(/peaks in the first ~2–3 seconds/i)
    expect(prompt).toMatch(/no zoom/i)
    expect(prompt).toMatch(/huskita/i)
    expect(prompt).toMatch(/Husky/i)
    expect(prompt).toMatch(/do not morph/i)
    expect(prompt).toMatch(/portrait/i)
    expect(prompt).toMatch(/treat/i)
    expect(prompt).toMatch(/attached source still/i)
    expect(prompt).toMatch(/tighter face-forward/i)
  })

  it('bakes react-then-idle into hug and howl personality variants', () => {
    const rileyHug = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'hug',
      intentDescription: 'Hug / cuddle',
      slotLabel: 'Side-touch reaction',
    })
    const murphyHowl = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'howl',
      intentDescription: 'Howl / sing',
      slotLabel: 'Howl / sing',
    })

    expect(rileyHug).toMatch(/bares her teeth/i)
    expect(rileyHug).toMatch(/returns to a calm FaceTime idle/i)
    expect(rileyHug).toMatch(/hold/i)
    expect(murphyHowl).toMatch(/howls well/i)
    expect(murphyHowl).toMatch(/returns to a calm FaceTime idle/i)
    expect(murphyHowl).toMatch(/6 second/i)
  })

  it('includes slot notes and generic personality when there is no dog-specific beat', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Biscuit',
      personality: {
        breed: 'huskita (Husky × Akita mix)',
        notes: ['Goofy and food-motivated.'],
      },
      intentId: 'come',
      intentDescription: 'Come here',
      slotLabel: 'Eager lean in',
      userNotes: 'Keep the white chest blaze sharp.',
    })

    expect(prompt).toMatch(/Biscuit/)
    expect(prompt).toMatch(/Goofy and food-motivated/)
    expect(prompt).toMatch(/Keep the white chest blaze sharp/)
    expect(prompt).toMatch(/Eager lean in/)
    expect(prompt).toMatch(/lean toward the camera/i)
  })

  it('matches seed studio prompts for hug / howl personality phrases', () => {
    const seed = createSeedStudioState()
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    const riley = seed.dogs.find((dog) => dog.id === 'riley')
    expect(murphy?.intents.find((intent) => intent.id === 'hug')?.clipSlots[0]?.prompt).toMatch(
      /loves hugs/i,
    )
    expect(riley?.intents.find((intent) => intent.id === 'hug')?.clipSlots[0]?.prompt).toMatch(
      /bares her teeth/i,
    )
  })
})
