import { describe, expect, it } from 'vitest'
import {
  BOTH_PERSONALITY,
  MURPHY_PERSONALITY,
  RILEY_PERSONALITY,
  createSeedStudioState,
} from '../data/clipStudioSeed'
import { defaultPersonality } from './dogPersonality'
import {
  classifySuggestIntent,
  suggestClipPrompt,
} from './suggestClipPrompt'

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

    expect(rileyHug).toMatch(/bares (her )?teeth/i)
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

    expect(rileyHug).toMatch(/bares (her )?teeth/i)
    expect(rileyHug).toMatch(/return to (a )?calm FaceTime idle/i)
    expect(rileyHug).toMatch(/hold/i)
    expect(rileyHug).toMatch(/Camera stays perfectly still; only the dog moves/)
    expect(murphyHowl).toMatch(/howls well/i)
    expect(murphyHowl).toMatch(/return to (a )?calm FaceTime idle/i)
    expect(murphyHowl).toMatch(/6s/)
    expect(murphyHowl).toMatch(/identical framing first-to-last/)
  })

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
    expect(samples[3]).toMatch(/Soft Foley wanted/)
    expect(samples[3]).not.toMatch(/Silence-first/)
    expect(samples[3]).not.toMatch(/not sound/)
    expect(samples[3]).toMatch(/attached source still/)
  })

  it('includes slot notes and generic personality when there is no dog-specific beat', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Biscuit',
      personality: defaultPersonality({
        notes: ['Goofy and food-motivated.'],
      }),
      intentId: 'come',
      intentDescription: 'Come here',
      slotLabel: 'Eager lean in',
      userNotes: 'Keep the white chest blaze sharp.',
    })

    expect(prompt).toMatch(/Biscuit/)
    expect(prompt).toMatch(/Goofy and food-motivated/)
    expect(prompt).toMatch(/Keep the white chest blaze sharp/)
    expect(prompt).toMatch(/Eager lean in/)
    expect(prompt).toMatch(/eager lean toward the phone/i)
    expect(prompt).toMatch(/Silence-first/)
    expect(prompt).not.toMatch(/Murphy and Riley are remarkably non-vocal/)
  })

  it('uses silence-first AUDIO on Murphy name / come / treat and bans inviting sound language', () => {
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
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
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
      expect(prompt).not.toMatch(/Soft Foley wanted/)
      expect(prompt).not.toMatch(/Sings and howls well/)
      expect(prompt).not.toMatch(/Awkward howl attempt/)
    }

    expect(name).toMatch(/Name-call spark/)
    expect(come).toMatch(/Recall lean/)
    expect(name).not.toMatch(/Intent \(treat\)/)
    expect(come).not.toMatch(/Intent \(no\)/)
  })

  it('invites soft Foley on Riley treat without not-sound or Mouth closed', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'treat',
      intentDescription: 'Treat / chicken',
      slotLabel: 'Excited, mouth open',
      userNotes: 'very excited, licks lips, sniffs air',
    })

    expect(prompt.startsWith('AUDIO (read first):')).toBe(true)
    expect(prompt).toMatch(/Soft-vocal/)
    expect(prompt).toMatch(/Soft Foley wanted/)
    expect(prompt).toMatch(/faint breath, soft mouth\/lick sounds, paw on rug, soft tail swish/)
    expect(prompt).toMatch(/Hard ban: bark, howl, music, speech, talking, ambience, heavy whine, growl/)
    expect(prompt).toMatch(/black huskita/)
    expect(prompt).toMatch(/brief lick/)
    expect(prompt).toMatch(/very excited, licks lips, sniffs air/)
    expect(prompt).not.toMatch(/Silence-first/)
    expect(prompt).not.toMatch(/not sound/)
    expect(prompt).not.toMatch(/remarkably non-vocal/)
    expect(prompt).not.toMatch(/Mouth closed/)
    expect(prompt).not.toMatch(/Express via face and body/)
  })

  it('still invites Foley if Riley or Both leftover seed is silent', () => {
    const leftoverSilent = defaultPersonality({ vocalStyle: 'silent' })
    const riley = suggestClipPrompt({
      dogName: 'Riley',
      personality: leftoverSilent,
      intentId: 'treat',
      intentDescription: 'Treat / chicken',
      slotLabel: 'Lick / expectant',
      userNotes: 'licks lips',
    })
    const both = suggestClipPrompt({
      dogName: 'Both',
      personality: leftoverSilent,
      intentId: 'name',
      intentDescription: 'Dog name',
      slotLabel: 'Perk up / eye contact',
    })
    const customSilent = suggestClipPrompt({
      dogName: 'Biscuit',
      personality: leftoverSilent,
      intentId: 'treat',
      intentDescription: 'Treat / chicken',
      slotLabel: 'Excited, mouth open',
    })

    expect(riley).toMatch(/Soft Foley wanted/)
    expect(riley).not.toMatch(/Silence-first/)
    expect(riley).not.toMatch(/Mouth closed/)
    expect(both).toMatch(/Soft Foley wanted/)
    expect(both).not.toMatch(/Silence-first/)
    expect(customSilent).toMatch(/Silence-first/)
    expect(customSilent).toMatch(/Mouth closed/)
    expect(customSilent).not.toMatch(/Soft Foley wanted/)
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
    expect(hug).toMatch(/Soft Foley wanted/)
    expect(hug).not.toMatch(/Silence-first/)
    expect(hug).not.toMatch(/not sound/)
    expect(hug).toMatch(/bares (her )?teeth/)
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
    expect(hug).toMatch(/Soft Foley wanted/)
    expect(hug).toMatch(/Riley warning is visual/)
    expect(hug).not.toMatch(/Silence-first/)
    expect(hug).not.toMatch(/not sound/)
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
      /bares (her )?teeth/i,
    )
    expect(murphy?.intents.find((intent) => intent.id === 'play')?.clipSlots[0]?.prompt).toMatch(
      /play-bow/i,
    )
    expect(murphy?.intents.find((intent) => intent.id === 'play')?.phrases).toEqual(
      expect.arrayContaining(['want to play', 'do you want to play', 'play', 'play fight', 'come play']),
    )
  })

  it('builds AUDIO and personality from traits, not dog-name ifs', () => {
    const barker = defaultPersonality({
      vocalStyle: 'barks',
      voiceSize: 'small_high',
      energy: 'hyper',
      eyes: 'soft_sad',
      mouth: 'slobberer',
      touch: 'cuddly',
      notes: ['Food-motivated terrier mix.'],
    })
    const howler = defaultPersonality({
      vocalStyle: 'howler',
      voiceSize: 'large_low',
      energy: 'calm',
      eyes: 'alert',
      touch: 'grumble_hug',
    })
    const talker = defaultPersonality({
      vocalStyle: 'talker',
      voiceSize: 'medium',
      energy: 'normal',
    })
    const soft = defaultPersonality({
      vocalStyle: 'soft',
      voiceSize: 'small_high',
    })

    const barkName = suggestClipPrompt({
      dogName: 'Biscuit',
      personality: barker,
      intentId: 'name',
      intentDescription: 'Dog name',
      slotLabel: 'Perk up',
    })
    const barkHug = suggestClipPrompt({
      dogName: 'Biscuit',
      personality: barker,
      intentId: 'hug',
      intentDescription: 'Hug / cuddle',
      slotLabel: 'Hug',
    })
    const howlTreat = suggestClipPrompt({
      dogName: 'Noodle',
      personality: howler,
      intentId: 'treat',
      intentDescription: 'Treat / chicken',
      slotLabel: 'Food interest',
    })
    const howlHug = suggestClipPrompt({
      dogName: 'Noodle',
      personality: howler,
      intentId: 'hug',
      intentDescription: 'Hug / cuddle',
      slotLabel: 'Side-touch',
    })
    const talkName = suggestClipPrompt({
      dogName: 'Echo',
      personality: talker,
      intentId: 'name',
      intentDescription: 'Dog name',
      slotLabel: 'Perk up',
    })
    const softName = suggestClipPrompt({
      dogName: 'Moth',
      personality: soft,
      intentId: 'come',
      intentDescription: 'Come here',
      slotLabel: 'Eager lean',
    })
    const silentHowl = suggestClipPrompt({
      dogName: 'Biscuit',
      personality: defaultPersonality({ vocalStyle: 'silent', voiceSize: 'small_high' }),
      intentId: 'howl',
      intentDescription: 'Howl / sing',
      slotLabel: 'Howl',
    })
    const silentPlay = suggestClipPrompt({
      dogName: 'Biscuit',
      personality: defaultPersonality({ vocalStyle: 'silent' }),
      intentId: 'play',
      intentDescription: 'Play / play-bow',
      slotLabel: 'Play-bow',
    })
    const calmName = suggestClipPrompt({
      dogName: 'Biscuit',
      personality: defaultPersonality({ vocalStyle: 'silent', energy: 'calm' }),
      intentId: 'name',
      intentDescription: 'Dog name',
      slotLabel: 'Perk up',
    })

    expect(barkName).toMatch(/Barking dog/)
    expect(barkName).toMatch(/high, small-dog-pitched barks/)
    expect(barkName).not.toMatch(/Silence-first/)
    expect(barkName).toMatch(/hyperactive/)
    expect(barkName).toMatch(/soft, slightly sad eyes/)
    expect(barkName).toMatch(/slobberer/)
    expect(barkHug).toMatch(/loves hugs/i)
    expect(barkHug).toMatch(/chest scratch/i)

    expect(howlTreat).toMatch(/Howler/)
    expect(howlTreat).toMatch(/low, large-dog howl/)
    expect(howlTreat).not.toMatch(/Silence-first/)
    expect(howlHug).toMatch(/bares (her )?teeth/)
    expect(howlHug).toMatch(/no growl sound/)
    expect(howlHug).not.toMatch(/loves hugs/i)

    expect(talkName).toMatch(/Talker \(experimental\)/)
    expect(talkName).toMatch(/English words/)
    expect(talkName).not.toMatch(/Silence-first/)

    expect(softName).toMatch(/Soft-vocal/)
    expect(softName).toMatch(/Soft Foley wanted/)
    expect(softName).toMatch(/faint breath, soft mouth\/lick sounds/)
    expect(softName).not.toMatch(/Silence-first/)
    expect(softName).not.toMatch(/not sound/)
    expect(softName).not.toMatch(/remarkably non-vocal/)
    expect(softName).not.toMatch(/Barking dog/)

    expect(silentHowl).toMatch(/Howl\/sing clip/)
    expect(silentHowl).not.toMatch(/Silence-first/)
    expect(silentPlay).toMatch(/one short challenge huff/i)
    expect(silentPlay).not.toMatch(/Silence-first/)

    expect(calmName).toMatch(/Silence-first/)
    expect(calmName).toMatch(/Slow, calm, unhurried/)
    expect(calmName).not.toMatch(/high, small-dog-pitched/)
    expect(calmName).not.toMatch(/Murphy and Riley are remarkably non-vocal/)
  })

  it('suggests a silence-first confused head-tilt for the unknown catch-all', () => {
    const murphy = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'unknown',
      intentDescription: 'Unknown / confused head-tilt',
      slotLabel: 'Curious head-tilt',
    })
    const riley = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'unknown',
      intentDescription: 'Unknown / confused head-tilt',
      slotLabel: 'Confused huh?',
    })
    const both = suggestClipPrompt({
      dogName: 'Both',
      personality: BOTH_PERSONALITY,
      intentId: 'unknown',
      intentDescription: 'Unknown / confused head-tilt',
      slotLabel: 'Curious head-tilt',
    })

    expect(murphy.startsWith('AUDIO (read first):')).toBe(true)
    expect(murphy).toMatch(/Silence-first/)
    expect(murphy).toMatch(/Hard ban: bark, howl, whine, growl, music, speech, ambience/)
    expect(murphy).toMatch(/head-tilt/i)
    expect(murphy).toMatch(/huh/)
    expect(murphy).not.toMatch(/Soft Foley wanted/)
    expect(murphy).not.toMatch(/Howl\/sing clip/)
    expect(murphy).not.toMatch(/challenge huff/)
    expect(murphy).not.toMatch(INVITING_SOUND)

    for (const prompt of [riley, both]) {
      expect(prompt.startsWith('AUDIO (read first):')).toBe(true)
      expect(prompt).toMatch(/Soft Foley wanted/)
      expect(prompt).toMatch(/head-tilt/i)
      expect(prompt).toMatch(/huh/)
      expect(prompt).not.toMatch(/Silence-first/)
      expect(prompt).not.toMatch(/not sound/)
      expect(prompt).not.toMatch(/remarkably non-vocal/)
      expect(prompt).not.toMatch(/Howl\/sing clip/)
      expect(prompt).not.toMatch(/challenge huff/)
    }

    expect(murphy).toMatch(/slightly goofy/)
    expect(riley).toMatch(/slightly puzzled/)
    expect(both).toMatch(/keep both dogs in frame/i)
    expect(both).toMatch(/Soft Foley ok/)

    const barker = suggestClipPrompt({
      dogName: 'Biscuit',
      personality: defaultPersonality({
        vocalStyle: 'barks',
        voiceSize: 'small_high',
        eyes: 'goofy',
      }),
      intentId: 'unknown',
      intentDescription: 'Unknown / confused head-tilt',
      slotLabel: 'Curious head-tilt',
    })
    expect(barker).toMatch(/head-tilt/i)
    expect(barker).toMatch(/Barking dog/)
    expect(barker).not.toMatch(/Silence-first/)
  })

  it('uses a 10s locked-camera costume walk for holiday intents', () => {
    const thanksgiving = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'thanksgiving',
      intentDescription: 'Thanksgiving',
      slotLabel: 'Costume walk',
      hasSourcePhoto: true,
    })
    const halloween = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'halloween',
      intentDescription: 'Halloween',
      slotLabel: 'Costume walk',
    })
    const bothChristmas = suggestClipPrompt({
      dogName: 'Both',
      personality: BOTH_PERSONALITY,
      intentId: 'christmas',
      intentDescription: 'Christmas',
      slotLabel: 'Costume walk',
    })
    const walk = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'walk',
      intentDescription: 'Walk',
      slotLabel: 'Alert, tail energy',
    })

    expect(thanksgiving.startsWith('AUDIO (read first):')).toBe(true)
    expect(thanksgiving).toMatch(/Silence-first/)
    expect(thanksgiving).toMatch(/LOCKED CAMERA/)
    expect(thanksgiving).toMatch(/10s/)
    expect(thanksgiving).toMatch(/15s/)
    expect(thanksgiving).toMatch(/Pilgrim dog costume with hat and dog-jacket/)
    expect(thanksgiving).toMatch(/walks completely off camera to the left/i)
    expect(thanksgiving).toMatch(/look right at the camera/)
    expect(thanksgiving).toMatch(/walk completely off screen on the right/)
    expect(thanksgiving).toMatch(/No fade, dissolve/)
    expect(thanksgiving).toMatch(/Costume appears or vanishes the instant they re-enter/)
    expect(thanksgiving).toMatch(/without any costume/)
    expect(thanksgiving).toMatch(/exact sitting position/)
    expect(thanksgiving).toMatch(/Do not use the usual 6s/)
    expect(thanksgiving).not.toMatch(/peaks in the first ~2–3 seconds/)
    expect(thanksgiving).not.toMatch(INVITING_SOUND)

    expect(halloween).toMatch(/Halloween dog costume/)
    expect(halloween).toMatch(/black huskita/)
    expect(halloween).toMatch(/Soft Foley wanted/)
    expect(halloween).not.toMatch(/Silence-first/)
    expect(halloween).not.toMatch(/not sound/)
    expect(halloween).toMatch(/10s/)

    expect(bothChristmas).toMatch(/both dogs stay identifiable/i)
    expect(bothChristmas).toMatch(/Santa hat/)
    expect(bothChristmas).toMatch(/Do not swap coats/)
    expect(bothChristmas).toMatch(/Soft Foley wanted/)
    expect(bothChristmas).not.toMatch(/Silence-first/)

    expect(walk).toMatch(/6s/)
    expect(walk).toMatch(/peaks in the first ~2–3 seconds/)
    expect(walk).not.toMatch(/Pilgrim/)
    expect(walk).not.toMatch(/costume walk/i)
  })

  it('keeps Riley No / Stop on ears-back / pause — never treat, lick, or chicken', () => {
    const no = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'no',
      intentDescription: 'No / Stop',
      slotLabel: 'Ears Back / Pause',
    })
    const noStop = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'no-stop',
      intentDescription: 'No / Stop',
      slotLabel: 'Guilty settle',
    })
    const stopAlias = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'correction',
      intentDescription: 'No / Stop',
      slotLabel: 'Ears Back / Pause',
    })
    const mislabeled = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'no',
      intentDescription: 'No / Stop',
      slotLabel: 'Lick / expectant',
      userNotes: 'very excited, licks lips, chicken',
    })
    const treat = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'treat',
      intentDescription: 'Treat / chicken',
      slotLabel: 'Lick / expectant',
    })
    const murphyNo = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'no',
      intentDescription: 'No / Stop',
      slotLabel: 'Ears Back / Pause',
    })

    for (const prompt of [no, noStop, stopAlias, mislabeled]) {
      expect(prompt).toMatch(/Intent \((no|no-stop|correction)\)/)
      expect(prompt).toMatch(/Correction beat/)
      expect(prompt).toMatch(/ears back/i)
      expect(prompt).toMatch(/guilty or settling/i)
      expect(prompt).not.toMatch(/Intent \(treat\)/)
      expect(prompt).not.toMatch(/Treat \/ chicken/)
      expect(prompt).not.toMatch(/eyes lock on an implied treat/i)
      expect(prompt).not.toMatch(/food-interest/i)
      expect(prompt).not.toMatch(/maybe a brief lick/i)
      expect(prompt).not.toMatch(/soft mouth\/lick/i)
    }

    expect(no).toMatch(/Variant beat \(Ears Back \/ Pause\)/)
    expect(no).toMatch(/Soft Foley wanted/)
    expect(no).toMatch(/No lick, no treat or food sounds/)
    expect(no).not.toMatch(/Silence-first/)
    expect(mislabeled).toMatch(/Director notes/)
    expect(mislabeled).toMatch(/chicken/)

    expect(treat).toMatch(/Intent \(treat\): Treat \/ chicken/)
    expect(treat).toMatch(/brief lick/)
    expect(treat).toMatch(/Variant beat \(Lick \/ expectant\)/)
    expect(treat).not.toMatch(/Correction beat/)
    expect(treat).not.toMatch(/No lick, no treat or food sounds/)

    expect(murphyNo).toMatch(/Silence-first/)
    expect(murphyNo).toMatch(/Correction beat/)
    expect(murphyNo).not.toMatch(/Soft Foley wanted/)
    expect(murphyNo).not.toMatch(/Intent \(treat\)/)
    expect(murphyNo).not.toMatch(/Treat \/ chicken/)
    expect(murphyNo).not.toMatch(/brief lick/)
  })

  it('does not cross-wire other seed intents onto treat or no motion', () => {
    const cases = [
      { intentId: 'walk', intentDescription: 'Walk', slotLabel: 'Alert, tail energy', family: 'walk' as const },
      { intentId: 'quiet', intentDescription: 'Quiet (future)', slotLabel: 'Settle / rest', family: 'quiet' as const },
      { intentId: 'come', intentDescription: 'Come here', slotLabel: 'Eager lean in', family: 'come' as const },
      { intentId: 'good', intentDescription: 'Good dog', slotLabel: 'Happy wag', family: 'good' as const },
      { intentId: 'hug', intentDescription: 'Hug / cuddle', slotLabel: 'Side-touch reaction', family: 'hug' as const },
      { intentId: 'halloween', intentDescription: 'Halloween', slotLabel: 'Costume walk', family: 'holiday' as const },
    ]

    for (const row of cases) {
      expect(classifySuggestIntent(row)).toBe(row.family)
      const prompt = suggestClipPrompt({
        dogName: 'Riley',
        personality: RILEY_PERSONALITY,
        intentId: row.intentId,
        intentDescription: row.intentDescription,
        slotLabel: row.slotLabel,
      })
      expect(prompt).not.toMatch(/Intent \(treat\)/)
      expect(prompt).not.toMatch(/eyes lock on an implied treat/i)
      expect(prompt).not.toMatch(/Correction beat/)
      if (row.family !== 'holiday') {
        expect(prompt).toMatch(new RegExp(`Intent \\(${row.intentId}\\)`))
      }
    }

    expect(classifySuggestIntent({ intentId: 'no', intentDescription: 'No / Stop' })).toBe('no')
    expect(classifySuggestIntent({ intentId: 'stop', intentDescription: 'Stop that' })).toBe('no')
    expect(
      classifySuggestIntent({ intentId: 'treat', intentDescription: 'Treat / chicken' }),
    ).toBe('treat')
    expect(
      classifySuggestIntent({ intentId: 'halloween', intentDescription: 'trick or treat' }),
    ).toBe('holiday')
  })

  it('bakes seed No / Stop prompts without treat text', () => {
    const seed = createSeedStudioState()
    const riley = seed.dogs.find((dog) => dog.id === 'riley')
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    const rileyNo = riley?.intents.find((intent) => intent.id === 'no')
    const murphyNo = murphy?.intents.find((intent) => intent.id === 'no')
    const rileyTreat = riley?.intents.find((intent) => intent.id === 'treat')

    expect(rileyNo?.description).toMatch(/No \/ Stop/)
    expect(rileyNo?.clipSlots[0]?.label).toMatch(/ears back/i)
    expect(rileyNo?.clipSlots[0]?.prompt).toMatch(/Intent \(no\)/)
    expect(rileyNo?.clipSlots[0]?.prompt).toMatch(/Correction beat/)
    expect(rileyNo?.clipSlots[0]?.prompt).not.toMatch(/Intent \(treat\)/)
    expect(rileyNo?.clipSlots[0]?.prompt).not.toMatch(/Treat \/ chicken/)
    expect(rileyTreat?.clipSlots.find((slot) => /lick/i.test(slot.label))?.prompt).toMatch(
      /Intent \(treat\)/,
    )
    expect(murphyNo?.clipSlots[0]?.prompt).toMatch(/Silence-first/)
    expect(murphyNo?.clipSlots[0]?.prompt).toMatch(/Correction beat/)
  })

  it('gives each seed intent a distinct fun beat and returns to the source sit', () => {
    const samples = [
      { intentId: 'name', intentDescription: 'Dog name', slotLabel: 'Perk up / eye contact', family: 'name', must: /Name-call spark/, mustNot: /Food-interest|Correction beat|Recall lean/ },
      { intentId: 'come', intentDescription: 'Come here', slotLabel: 'Eager lean in', family: 'come', must: /Recall lean/, mustNot: /Name-call spark|Food-interest|Correction beat/ },
      { intentId: 'here', intentDescription: 'Here / this way', slotLabel: 'Glance this way', family: 'here', must: /Orientation flick/, mustNot: /Recall lean|Food-interest/ },
      { intentId: 'owner', intentDescription: 'Owner name', slotLabel: 'Soft owner gaze', family: 'owner', must: /Person-recognition/, mustNot: /Food-interest|Correction beat/ },
      { intentId: 'good', intentDescription: 'Good dog', slotLabel: 'Happy wag', family: 'good', must: /Praise wriggle/, mustNot: /Food-interest|Correction beat/ },
      { intentId: 'treat', intentDescription: 'Treat / chicken', slotLabel: 'Lick / expectant', family: 'treat', must: /Food-interest/, mustNot: /Correction beat|Name-call spark/ },
      { intentId: 'walk', intentDescription: 'Walk', slotLabel: 'Door / leash excitement', family: 'walk', must: /Leash-word voltage/, mustNot: /Food-interest|Correction beat/ },
      { intentId: 'no', intentDescription: 'No / Stop', slotLabel: 'Guilty settle', family: 'no', must: /Correction beat/, mustNot: /Food-interest|Name-call spark/ },
      { intentId: 'quiet', intentDescription: 'Quiet (future)', slotLabel: 'Settle / rest', family: 'quiet', must: /Settle and calm/, mustNot: /Correction beat|Food-interest/ },
      { intentId: 'play', intentDescription: 'Play / play-bow', slotLabel: 'Play-bow (front low, rear up)', family: 'play', must: /Play-bow/, mustNot: /Food-interest|Correction beat/ },
      { intentId: 'hug', intentDescription: 'Hug / cuddle', slotLabel: 'Side-touch reaction', family: 'hug', must: /Hug \/ cuddle|Side-touch/, mustNot: /Food-interest|Correction beat|Name-call spark/ },
      { intentId: 'howl', intentDescription: 'Howl / sing', slotLabel: 'Howl attempt', family: 'howl', must: /Howl\/sing|howl attempt/i, mustNot: /Food-interest|Correction beat|Name-call spark/ },
      { intentId: 'unknown', intentDescription: 'Unknown / confused head-tilt', slotLabel: 'Curious head-tilt', family: 'unknown', must: /head-tilt|huh/i, mustNot: /Food-interest|Correction beat/ },
      { intentId: 'idle', intentDescription: 'Idle FaceTime hold', slotLabel: 'Calm look at camera', family: 'idle', must: /Calm FaceTime hold/, mustNot: /Food-interest|Correction beat|Name-call spark/ },
    ] as const

    for (const row of samples) {
      const prompt = suggestClipPrompt({
        dogName: 'Riley',
        personality: RILEY_PERSONALITY,
        intentId: row.intentId,
        intentDescription: row.intentDescription,
        slotLabel: row.slotLabel,
      })
      expect(prompt, row.intentId).toMatch(new RegExp(`Intent \\(${row.intentId}\\)`))
      expect(prompt, row.intentId).toMatch(row.must)
      expect(prompt, row.intentId).not.toMatch(row.mustNot)
      expect(prompt, row.intentId).toMatch(/exact sitting pose of the source still/)
      expect(prompt, row.intentId).toMatch(/Do not freeze mid-lick, mid-bow, or off-center/)
      expect(classifySuggestIntent(row)).toBe(row.family)
      if (row.intentId !== 'howl' && row.intentId !== 'play') {
        expect(prompt, row.intentId).toMatch(/Soft Foley wanted/)
        expect(prompt, row.intentId).not.toMatch(/Silence-first/)
      }
    }

    const murphyName = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'name',
      intentDescription: 'Dog name',
      slotLabel: 'Perk up / eye contact',
    })
    expect(murphyName).toMatch(/Silence-first/)
    expect(murphyName).toMatch(/Name-call spark/)
    expect(murphyName).not.toMatch(/Soft Foley wanted/)

    const halloween = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'halloween',
      intentDescription: 'Halloween',
      slotLabel: 'Costume walk',
    })
    expect(halloween).toMatch(/Intent \(halloween\)/)
    expect(halloween).toMatch(/walks completely off camera/)
    expect(halloween).toMatch(/Soft Foley wanted/)
    expect(halloween).not.toMatch(/Silence-first/)
    expect(halloween).not.toMatch(/Intent \(treat\)/)
    expect(halloween).not.toMatch(/Correction beat/)
    expect(halloween).not.toMatch(/Food-interest/)
    expect(halloween).not.toMatch(/peaks in the first ~2–3 seconds/)
    expect(classifySuggestIntent({ intentId: 'halloween', intentDescription: 'Halloween' })).toBe(
      'holiday',
    )
  })
})
