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

const INVITING_SOUND = /soft dog sounds|pant\/huff\/whine|quiet pant|soft huff|tiny whine/i

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
    expect(rileyHug).toMatch(/silent warning/i)
    expect(rileyHug).toMatch(/no growl sound/i)
    expect(rileyHug).toMatch(/black huskita/i)
    expect(murphyHug).toMatch(/loves hugs/i)
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
      slotLabel: 'Excited, mouth open',
      hasSourcePhoto: true,
      framing,
    })

    expect(prompt).toMatch(/Grok Imagine/i)
    expect(prompt).toMatch(/image-to-video/i)
    expect(prompt).toMatch(/6s/)
    expect(prompt).toMatch(/9:16/)
    expect(prompt).toMatch(/return to (a )?calm FaceTime idle/i)
    expect(prompt).toMatch(/peaks in the first ~2–3 seconds/i)
    expect(prompt).toMatch(/LOCKED CAMERA/)
    expect(prompt).toMatch(/perfectly still/i)
    expect(prompt).toMatch(/no pan, tilt, dolly, zoom, push-in, pull-out, handheld shake, or reframing/i)
    expect(prompt).toMatch(/only the subject \(dog\) moves/i)
    expect(prompt).toMatch(/no zoom/i)
    expect(prompt).toMatch(/huskita/i)
    expect(prompt).toMatch(/Husky/i)
    expect(prompt).toMatch(/do not morph/i)
    expect(prompt).toMatch(/portrait/i)
    expect(prompt).toMatch(/treat/i)
    expect(prompt).toMatch(/attached source still/i)
    expect(prompt).toMatch(/tighter face-forward/i)
  })

  it('puts AUDIO first and keeps the prompt short', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'name',
      intentDescription: 'Dog name',
      slotLabel: 'Perk up / eye contact',
    })

    expect(prompt.startsWith('AUDIO (read first):')).toBe(true)
    expect(prompt).toMatch(/LOCKED CAMERA/)
    expect(prompt.split('\n').length).toBeLessThanOrEqual(10)
  })

  it('bakes react-then-idle into the shared 6s arc', () => {
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
    expect(rileyHug).toMatch(/return to (a )?calm FaceTime idle/i)
    expect(rileyHug).toMatch(/hold/i)
    expect(rileyHug).toMatch(/Camera stays perfectly still; only the dog moves/)
    expect(murphyHowl).toMatch(/howls well/i)
    expect(murphyHowl).toMatch(/return to (a )?calm FaceTime idle/i)
    expect(murphyHowl).toMatch(/6s/)
    expect(murphyHowl).toMatch(/identical framing first-to-last/)
  }

  it('always includes a strong LOCKED CAMERA block, including play and howl exceptions', () => {
    const samples = [
      suggestClipPrompt({
        dogName: 'Murphy',
        personality: MURPHY_PERSONALITY,
        intentId: 'name',
        intentDescription: 'Dog name',
        slotLabel: 'Perk up / eye contact',
      }),
      suggestClipPrompt({
        dogName: 'Riley',
        personality: RILEY_PERSONALITY,
        intentId: 'play',
        intentDescription: 'Play / play-bow',
        slotLabel: 'Challenge huff / play-bow',
      }),
      suggestClipPrompt({
        dogName: 'Murphy',
        personality: MURPHY_PERSONALITY,
        intentId: 'howl',
        intentDescription: 'Howl / sing',
        slotLabel: 'Howl / sing',
      }),
      suggestClipPrompt({
        dogName: 'Both',
        personality: BOTH_PERSONALITY,
        intentId: 'hug',
        intentDescription: 'Hug / cuddle',
        slotLabel: 'Together hug',
        hasSourcePhoto: true,
        framing,
      }),
    ]

    for (const prompt of samples) {
      expect(prompt).toMatch(/LOCKED CAMERA:/)
      expect(prompt).toMatch(/The camera is perfectly still/)
      expect(prompt).toMatch(/No pan, tilt, dolly, zoom, push-in, pull-out, handheld shake, or reframing/)
      expect(prompt).toMatch(/Framing is identical from the first frame to the last frame/)
      expect(prompt).toMatch(/same crop as the source still/)
      expect(prompt).toMatch(/Only the subject \(dog\) moves/)
      expect(prompt).toMatch(/Camera stays perfectly still; only the dog moves/)
      expect(prompt).toMatch(/Repeat: camera perfectly still/)
    }

    expect(samples[1]).toMatch(/Play clip/)
    expect(samples[1]).toMatch(/one short challenge huff/i)
    expect(samples[2]).toMatch(/Howl\/sing clip/)
    expect(samples[3]).toMatch(/Silence-first/)
    expect(samples[3]).toMatch(/attached source still/)
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
    expect(prompt).toMatch(/Silence-first/)
    expect(prompt).not.toMatch(/Murphy and Riley are remarkably non-vocal/)
  })

  it('uses silence-first AUDIO on name / come / treat and bans inviting sound language', () => {
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
      slotLabel: 'Excited, mouth open',
    })

    for (const prompt of [name, come, treat]) {
      expect(prompt.startsWith('AUDIO (read first):')).toBe(true)
      expect(prompt).toMatch(/Silence-first/)
      expect(prompt).toMatch(/Hard ban: bark, howl, whine, growl, music, speech, ambience/)
      expect(prompt).toMatch(/faint breath, soft paw on rug/)
      expect(prompt).toMatch(/Mouth closed/)
      expect(prompt).toMatch(/face and body/i)
      expect(prompt).toMatch(/remarkably non-vocal/)
      expect(prompt).not.toMatch(INVITING_SOUND)
      expect(prompt).not.toMatch(/Sings and howls well/)
      expect(prompt).not.toMatch(/Awkward howl attempt/)
    }

    expect(name).toMatch(/ears perk and eye contact only/i)
    expect(come).toMatch(/ears perk and eye contact only/i)
  })

  it('allows dog howl only on howl/sing intents, still forbids talking and other noise', () => {
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

    expect(howl.startsWith('AUDIO (read first):')).toBe(true)
    expect(howl).toMatch(/howl\/sing clip/i)
    expect(howl).toMatch(/dog howl/i)
    expect(howl).toMatch(/howls well/i)
    expect(howl).toMatch(/no human words/i)
    expect(howl).toMatch(/Hard ban: bark, speech, talking, music, ambience/)
    expect(howl).not.toMatch(/Silence-first/)
    expect(howl).not.toMatch(INVITING_SOUND)

    expect(hug.startsWith('AUDIO (read first):')).toBe(true)
    expect(hug).toMatch(/Silence-first/)
    expect(hug).toMatch(/bares her teeth/)
    expect(hug).toMatch(/no growl sound/)
    expect(hug).toMatch(/Mouth closed/)
    expect(hug).not.toMatch(INVITING_SOUND)
  })

  it('does not unlock vocalization from slot notes such as responds to a howl', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'come',
      intentDescription: 'Come here',
      slotLabel: 'Eager lean in',
      userNotes: 'responds to a howl from the other room',
    })
    expect(prompt).toMatch(/Silence-first/)
    expect(prompt).not.toMatch(/Howl\/sing clip/)
    expect(prompt).toMatch(/responds to a howl from the other room/)
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
    expect(hug).toMatch(/Silence-first/)
    expect(howl).toMatch(/Murphy sings/i)
    expect(howl).toMatch(/awkward weaker howl/i)
    expect(howl).toMatch(/kitchen-rug/i)
  })

  it('uses a play-bow plus one challenge huff on play intents only', () => {
    const play = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'play',
      intentDescription: 'Play / play-bow',
      slotLabel: 'Play-bow (front low, rear up)',
    })
    const rileyPlay = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'play',
      intentDescription: 'Play / play-bow',
      slotLabel: 'Challenge huff / play-bow',
    })
    const bothPlay = suggestClipPrompt({
      dogName: 'Both',
      personality: BOTH_PERSONALITY,
      intentId: 'play',
      intentDescription: 'Play / play-bow',
      slotLabel: 'Together play-bow',
    })
    const name = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'name',
      intentDescription: 'Dog name',
      slotLabel: 'Perk up / eye contact',
    })

    expect(play.startsWith('AUDIO (read first):')).toBe(true)
    expect(play).toMatch(/Play clip/)
    expect(play).toMatch(/one short challenge huff/i)
    expect(play).toMatch(/sneeze-like chuff/i)
    expect(play).toMatch(/Not a bark/)
    expect(play).toMatch(/Hard ban: bark, howl, music, speech, ambience/)
    expect(play).toMatch(/play-bow/i)
    expect(play).toMatch(/front low, rear up/)
    expect(play).toMatch(/downward-dog/)
    expect(play).not.toMatch(/Silence-first/)
    expect(play).not.toMatch(/Howl\/sing clip/)
    expect(play).not.toMatch(INVITING_SOUND)

    expect(rileyPlay).toMatch(/Riley asks to play-fight/)
    expect(rileyPlay).toMatch(/challenge huff/)
    expect(bothPlay).toMatch(/both drop into play-bows/i)
    expect(name).toMatch(/Silence-first/)
    expect(name).not.toMatch(/challenge huff/)
    expect(name).not.toMatch(/play-bow/)
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
    expect(murphy?.intents.find((intent) => intent.id === 'play')?.clipSlots[0]?.prompt).toMatch(
      /play-bow/i,
    )
    expect(murphy?.intents.find((intent) => intent.id === 'play')?.phrases).toEqual(
      expect.arrayContaining(['want to play', 'do you want to play', 'play', 'play fight', 'come play']),
    )
  })
})
