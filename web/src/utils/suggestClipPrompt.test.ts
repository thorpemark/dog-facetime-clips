import { describe, expect, it } from 'vitest'
import {
  BOTH_PERSONALITY,
  MURPHY_PERSONALITY,
  RILEY_PERSONALITY,
  createSeedStudioState,
} from '../data/clipStudioSeed'
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
    expect(rileyHug).toMatch(/grumble-hug/i)
    expect(rileyHug).toMatch(/visual protest/i)
    expect(rileyHug).toMatch(/black huskita/i)
    expect(rileyHug).not.toMatch(/growl-show-teeth/i)
    expect(murphyHug).toMatch(/loves hugs/i)
    expect(murphyHug).toMatch(/melts in/i)
    expect(murphyHug).toMatch(/chest scratch/i)
    expect(murphyHug).toMatch(/nose tilted up/i)
    expect(murphyHug).toMatch(/other huskita/i)
    expect(murphyHug).toMatch(/not Riley/i)
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
      slotLabel: 'Eager treat interest',
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

  it('forbids speech and howling on name / come / treat, and repeats the rule', () => {
    const name = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'name',
      intentDescription: 'Dog name',
      slotLabel: 'Perk up / eye contact',
    })
    const come = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'come',
      intentDescription: 'Come here',
      slotLabel: 'Eager lean in',
    })
    const treat = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'treat',
      intentDescription: 'Treat / chicken',
      slotLabel: 'Eager treat interest',
    })

    for (const prompt of [name, come, treat]) {
      expect(prompt).toMatch(/AUDIO \(read first\)/)
      expect(prompt).toMatch(/Silence preferred/)
      expect(prompt).toMatch(/no bark/i)
      expect(prompt).toMatch(/no whine/i)
      expect(prompt).toMatch(/faint breath/)
      expect(prompt).toMatch(/soft paw on rug/)
      expect(prompt).toMatch(/no dialogue/i)
      expect(prompt).toMatch(/no talking/i)
      expect(prompt).toMatch(/NOT a howl clip/)
      expect(prompt).toMatch(/no howling/i)
      expect(prompt).toMatch(/no bay/i)
      expect(prompt).toMatch(/mouth closed/i)
      expect(prompt).toMatch(/ears, eyes, head/)
      expect(prompt.match(/no dialogue/gi)?.length).toBeGreaterThanOrEqual(2)
      expect(prompt).not.toMatch(/Sings and howls well/)
      expect(prompt).not.toMatch(/Awkward howl attempt/)
      expect(prompt).not.toMatch(/soft dog sounds/i)
      expect(prompt).not.toMatch(/quiet pant/i)
      expect(prompt).not.toMatch(/tiny whine/i)
      expect(prompt).not.toMatch(/soft pant\/huff\/whine/i)
    }

    expect(name).toMatch(/ears perk and eye contact only/i)
    expect(name).toMatch(/does not howl/i)
    expect(come).toMatch(/does not howl/i)
  })

  it('allows dog howl only on howl/sing intents, still forbids talking', () => {
    const howl = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'howl',
      intentDescription: 'Howl / sing',
      slotLabel: 'Howl / sing',
    })
    const hug = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'hug',
      intentDescription: 'Hug / cuddle',
      slotLabel: 'Side-touch reaction',
    })

    expect(howl).toMatch(/howl\/sing clip/i)
    expect(howl).toMatch(/dog howl/i)
    expect(howl).toMatch(/howls well/i)
    expect(howl).toMatch(/no dialogue/i)
    expect(howl).toMatch(/no talking/i)
    expect(howl).not.toMatch(/NOT a howl clip/)
    expect(howl).not.toMatch(/Silence preferred/)
    expect(howl).not.toMatch(/soft dog sounds/i)
    expect(howl.match(/no dialogue/gi)?.length).toBeGreaterThanOrEqual(2)

    expect(hug).toMatch(/NOT a howl clip/)
    expect(hug).toMatch(/Silence preferred/)
    expect(hug).toMatch(/visual protest/)
    expect(hug).toMatch(/no bark/)
    expect(hug).not.toMatch(/growl-show-teeth/)
    expect(hug).toMatch(/not a howl/i)
    expect(hug).toMatch(/no talking/i)
  })

  it('rewrites leftover mouth-open slot labels on non-howl intents', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'treat',
      intentDescription: 'Treat / chicken',
      slotLabel: 'Excited, mouth open',
    })
    expect(prompt).toMatch(/mouth closed/i)
    expect(prompt).not.toMatch(/mouth open/i)
  })

  it('allows howl when slot notes explicitly say responds to a howl', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'come',
      intentDescription: 'Come here',
      slotLabel: 'Eager lean in',
      userNotes: 'responds to a howl from the other room',
    })
    expect(prompt).toMatch(/Howl\/sing clip/i)
    expect(prompt).not.toMatch(/NOT a howl clip/)
  })

  it('bakes Both hug / howl together-shot personality and identity', () => {
    const hug = suggestClipPrompt({
      dogName: 'Both',
      personality: BOTH_PERSONALITY,
      intentId: 'hug',
      intentDescription: 'Hug / cuddle',
      slotLabel: 'Together hug',
    })
    const howl = suggestClipPrompt({
      dogName: 'Both',
      personality: BOTH_PERSONALITY,
      intentId: 'howl',
      intentDescription: 'Howl / sing',
      slotLabel: 'Together howl',
    })

    expect(hug).toMatch(/keep both dogs in frame/i)
    expect(hug).toMatch(/Murphy leans in/i)
    expect(hug).toMatch(/Riley is wary/i)
    expect(hug).toMatch(/black huskita/i)
    expect(howl).toMatch(/Murphy sings/i)
    expect(howl).toMatch(/awkward weaker howl/i)
    expect(howl).toMatch(/kitchen-rug/i)
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
