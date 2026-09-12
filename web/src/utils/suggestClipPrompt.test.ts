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
  isNoLikeIntent,
  isTreatLikeIntent,
  parseSlotGaze,
  parseSlotVocals,
  suggestClipPrompt,
} from './suggestClipPrompt'

const framing = {
  portrait: { focalX: 0.5, focalY: 0.42, focalZoom: 1.6 },
  landscape: { focalX: 0.5, focalY: 0.5, focalZoom: 1 },
}

const INVITING_SOUND = /soft dog sounds|pant\/huff\/whine|quiet pant|soft huff|tiny whine/i

function expectLockedCamera(prompt: string) {
  expect(prompt).toMatch(/LOCKED CAMERA:/)
  expect(prompt).toMatch(/perfectly still/)
  expect(prompt).toMatch(/No pan, tilt, zoom, dolly, shake, or reframing/)
  expect(prompt).toMatch(/Framing identical first frame to last/)
  expect(prompt).toMatch(/Only the dog moves/)
  expect(prompt).toMatch(/NO HUMANS:/)
  expect(prompt).toMatch(/no person, no hand, no arm, no finger/)
}

describe('parseSlotVocals', () => {
  it('reads short warning growl and leaves other vocals off', () => {
    expect(parseSlotVocals('short warning growl')).toEqual({
      growl: true,
      bark: false,
      howl: false,
      whine: false,
    })
  })

  it('reads howl|sing|aroo and respects negation', () => {
    expect(parseSlotVocals('let him howl')).toMatchObject({ howl: true })
    expect(parseSlotVocals('sing it / aroo')).toMatchObject({ howl: true })
    expect(parseSlotVocals('No howl. No bark.')).toEqual({
      growl: false,
      bark: false,
      howl: false,
      whine: false,
    })
  })
})

describe('parseSlotGaze', () => {
  it('treats plain side eye / side-eye / sideeye / sclera as the keeper (no GAZE: prefix)', () => {
    for (const notes of ['side eye', 'side-eye', 'sideeye', 'sclera', 'sclera side-eye']) {
      expect(parseSlotGaze(notes), notes).toMatchObject({
        requested: true,
        sideEye: true,
        cameraLock: true,
        muzzle: 'left',
        degrees: 30,
      })
    }
    expect(parseSlotGaze('GAZE: side-eye')).toMatchObject({ sideEye: true, muzzle: 'left' })
  })

  it('treats plain camera lock as eyes on lens without a side-eye turn', () => {
    expect(parseSlotGaze('camera lock')).toMatchObject({
      requested: true,
      sideEye: false,
      cameraLock: true,
    })
    expect(parseSlotGaze('eyes on lens')).toMatchObject({
      requested: true,
      sideEye: false,
      cameraLock: true,
    })
    expect(parseSlotGaze('stare at camera')).toMatchObject({
      requested: true,
      sideEye: false,
      cameraLock: true,
    })
  })

  it('keeps side eye + camera lock as the full side-eye turn', () => {
    expect(parseSlotGaze('side eye, camera lock')).toMatchObject({
      sideEye: true,
      cameraLock: true,
    })
  })

  it('mirrors yaw when notes say muzzle right / to his right', () => {
    expect(parseSlotGaze('side eye muzzle right')).toMatchObject({
      sideEye: true,
      muzzle: 'right',
    })
    expect(parseSlotGaze('side eye to his right')).toMatchObject({
      sideEye: true,
      muzzle: 'right',
    })
  })
})

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

    expect(rileyHug).toMatch(/bares (his |her )?teeth/i)
    expect(rileyHug).toMatch(/silent warning/i)
    expect(rileyHug).toMatch(/no growl sound/i)
    expect(rileyHug).toMatch(/male black huskita/i)
    expect(rileyHug).toMatch(/He is not Murphy/)
    expect(rileyHug).not.toMatch(/\bher\b/)
    expect(rileyHug).not.toMatch(/\bShe is not Murphy/)
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
    expect(prompt).toMatch(/6 seconds/)
    expect(prompt).toMatch(/9:16/)
    expect(prompt).toMatch(/exact source sit/i)
    expect(prompt).toMatch(/0–2s:/)
    expect(prompt).toMatch(/2–4s:/)
    expect(prompt).toMatch(/4–6s:/)
    expectLockedCamera(prompt)
    expect(prompt).toMatch(/huskita/i)
    expect(prompt).toMatch(/Husky/i)
    expect(prompt).toMatch(/do not morph/i)
    expect(prompt).toMatch(/portrait/i)
    expect(prompt).toMatch(/treat/i)
    expect(prompt).toMatch(/Attached still is frame 1/)
    expect(prompt).toMatch(/tighter face-forward/i)
    expect(prompt).toMatch(/Natural light/)
  })

  it('follows Mark’s template order: length → MUST HAVE AUDIO → SOUND → LOCKED CAMERA → NO HUMANS → ACTION', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'name',
      intentDescription: 'Dog name',
      slotLabel: 'Perk up / eye contact',
    })

    expect(prompt.startsWith('6 seconds, 9:16')).toBe(true)
    const must = prompt.indexOf('MUST HAVE AUDIO')
    const sound = prompt.indexOf('SOUND:')
    const locked = prompt.indexOf('LOCKED CAMERA:')
    const humans = prompt.indexOf('NO HUMANS:')
    const action = prompt.indexOf('ACTION, one continuous shot:')
    expect(must).toBeGreaterThan(-1)
    expect(sound).toBeGreaterThan(must)
    expect(locked).toBeGreaterThan(sound)
    expect(humans).toBeGreaterThan(locked)
    expect(action).toBeGreaterThan(humans)
    expectLockedCamera(prompt)
  })

  it('bakes timed ACTION 0–2 / 2–4 / 4–6 into the shared 6s arc', () => {
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

    expect(rileyHug).toMatch(/bares (his |her )?teeth/i)
    expect(rileyHug).toMatch(/0–2s:/)
    expect(rileyHug).toMatch(/4–6s:/)
    expect(rileyHug).toMatch(/exact source sit/i)
    expect(rileyHug).toMatch(/Only the dog moves/)
    expect(murphyHowl).toMatch(/howls well/i)
    expect(murphyHowl).toMatch(/exact source sit/i)
    expect(murphyHowl).toMatch(/6 seconds/)
    expect(murphyHowl).toMatch(/Framing identical first frame to last/)
  })

  it('always includes LOCKED CAMERA and NO HUMANS, including play and howl exceptions', () => {
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
      expectLockedCamera(prompt)
      expect(prompt).toMatch(/small FaceTime-scale backup only/)
    }

    expect(samples[1]).toMatch(/Play clip/)
    expect(samples[1]).toMatch(/one short challenge huff/i)
    expect(samples[2]).toMatch(/Howl\/sing clip/)
    expect(samples[3]).toMatch(/Soft Foley wanted/)
    expect(samples[3]).not.toMatch(/Silence-first/)
    expect(samples[3]).not.toMatch(/not sound/)
    expect(samples[3]).toMatch(/Attached still is frame 1/)
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
    expect(prompt).toMatch(/lean toward the camera/i)
    expect(prompt).toMatch(/Silence-first/)
    expect(prompt).toMatch(/Director notes for this slot: Keep the white chest blaze sharp/)
    expect(prompt).not.toMatch(/Murphy and Riley are remarkably non-vocal/)
  })

  it('uses silence-first SOUND on Murphy name / come / treat and bans inviting sound language', () => {
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
      expect(prompt).toMatch(/SOUND:/)
      expect(prompt).toMatch(/Silence-first/)
      expect(prompt).toMatch(/Hard ban: bark, howl, whine, growl, music, speech, ambience/)
      expect(prompt).toMatch(/faint breath, soft paw on rug/)
      expect(prompt).toMatch(/Mouth closed/)
      expect(prompt).toMatch(/face and body/i)
      expect(prompt).toMatch(/remarkably non-vocal/)
      expect(prompt).not.toMatch(/MUST HAVE AUDIO/)
      expect(prompt).not.toMatch(INVITING_SOUND)
      expect(prompt).not.toMatch(/Soft Foley wanted/)
      expect(prompt).not.toMatch(/Sings and howls well/)
      expect(prompt).not.toMatch(/Awkward howl attempt/)
    }

    expect(name).toMatch(/ears perk and eye contact only/i)
    expect(come).toMatch(/ears perk and eye contact only/i)
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

    expect(prompt).toMatch(/MUST HAVE AUDIO/)
    expect(prompt).toMatch(/SOUND:/)
    expect(prompt).toMatch(/Soft-vocal/)
    expect(prompt).toMatch(/Soft Foley wanted/)
    expect(prompt).toMatch(/faint breath, soft mouth\/lick sounds, paw on rug, soft tail swish/)
    expect(prompt).toMatch(/No howl/)
    expect(prompt).toMatch(/No bark/)
    expect(prompt).toMatch(/No growl/)
    expect(prompt).toMatch(/male black huskita/)
    expect(prompt).toMatch(/brief lick/)
    expect(prompt).toMatch(/very excited, licks lips, sniffs air/)
    expect(prompt).toMatch(/Director notes for this slot: very excited, licks lips, sniffs air/)
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
    expect(riley).toMatch(/MUST HAVE AUDIO/)
    expect(riley).not.toMatch(/Silence-first/)
    expect(riley).not.toMatch(/Mouth closed/)
    expect(both).toMatch(/Soft Foley wanted/)
    expect(both).not.toMatch(/Silence-first/)
    expect(customSilent).toMatch(/Silence-first/)
    expect(customSilent).toMatch(/Mouth closed/)
    expect(customSilent).not.toMatch(/Soft Foley wanted/)
    expect(customSilent).not.toMatch(/MUST HAVE AUDIO/)
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

    expect(howl).toMatch(/MUST HAVE AUDIO/)
    expect(howl).toMatch(/howl\/sing clip/i)
    expect(howl).toMatch(/dog howl/i)
    expect(howl).toMatch(/howls well/i)
    expect(howl).toMatch(/no human words/i)
    expect(howl).toMatch(/No bark/)
    expect(howl).not.toMatch(/Silence-first/)
    expect(howl).not.toMatch(INVITING_SOUND)

    expect(hug).toMatch(/MUST HAVE AUDIO/)
    expect(hug).toMatch(/Soft Foley wanted/)
    expect(hug).not.toMatch(/Silence-first/)
    expect(hug).not.toMatch(/not sound/)
    expect(hug).toMatch(/bares (his |her )?teeth/)
    expect(hug).toMatch(/no growl sound/)
    expect(hug).toMatch(/Mouth closed/)
    expect(hug).toMatch(/No howl/)
    expect(hug).toMatch(/No bark/)
    expect(hug).not.toMatch(INVITING_SOUND)
  })

  it('lets slot notes request a howl vocal on a non-howl intent', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'come',
      intentDescription: 'Come here',
      slotLabel: 'Eager lean in',
      userNotes: 'howl / aroo once',
    })
    expect(prompt).toMatch(/MUST HAVE AUDIO/)
    expect(prompt).toMatch(/Howl\/sing clip/)
    expect(prompt).toMatch(/No bark/)
    expect(prompt).not.toMatch(/Silence-first/)
    expect(prompt).toMatch(/Director notes for this slot: howl \/ aroo once/)
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
    expect(hug).toMatch(/Riley is wary|Riley stays wary/i)
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

    expect(play).toMatch(/MUST HAVE AUDIO/)
    expect(play).toMatch(/Play clip/)
    expect(play).toMatch(/one short challenge huff/i)
    expect(play).toMatch(/sneeze-like chuff/i)
    expect(play).toMatch(/Not a bark/)
    expect(play).toMatch(/No howl/)
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
      /bares (his |her )?teeth/i,
    )
    expect(riley?.intents.find((intent) => intent.id === 'hug')?.clipSlots[0]?.prompt).toMatch(
      /male black huskita/i,
    )
    expect(murphy?.intents.find((intent) => intent.id === 'play')?.clipSlots[0]?.prompt).toMatch(
      /play-bow/i,
    )
    expect(murphy?.intents.find((intent) => intent.id === 'play')?.phrases).toEqual(
      expect.arrayContaining(['want to play', 'do you want to play', 'play', 'play fight', 'come play']),
    )
  })

  it('builds SOUND and personality from traits, not dog-name ifs', () => {
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
    expect(howlHug).toMatch(/bares (his |her )?teeth/)
    expect(howlHug).toMatch(/no growl sound/)
    expect(howlHug).not.toMatch(/loves hugs/i)

    expect(talkName).toMatch(/Talker \(experimental\)/)
    expect(talkName).toMatch(/English words/)
    expect(talkName).not.toMatch(/Silence-first/)

    expect(softName).toMatch(/Soft-vocal/)
    expect(softName).toMatch(/Soft Foley wanted/)
    expect(softName).toMatch(/faint breath/)
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

    expect(murphy).toMatch(/SOUND:/)
    expect(murphy).toMatch(/Silence-first/)
    expect(murphy).toMatch(/Hard ban: bark, howl, whine, growl, music, speech, ambience/)
    expect(murphy).toMatch(/head-tilt/i)
    expect(murphy).toMatch(/huh/)
    expect(murphy).not.toMatch(/MUST HAVE AUDIO/)
    expect(murphy).not.toMatch(/Soft Foley wanted/)
    expect(murphy).not.toMatch(/Howl\/sing clip/)
    expect(murphy).not.toMatch(/challenge huff/)
    expect(murphy).not.toMatch(INVITING_SOUND)

    for (const prompt of [riley, both]) {
      expect(prompt).toMatch(/MUST HAVE AUDIO/)
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

    expect(thanksgiving).toMatch(/SOUND:/)
    expect(thanksgiving).toMatch(/Silence-first/)
    expect(thanksgiving).toMatch(/LOCKED CAMERA/)
    expect(thanksgiving).toMatch(/10s/)
    expect(thanksgiving).toMatch(/15s/)
    expect(thanksgiving).toMatch(/Pilgrim dog costume with hat and dog-jacket/)
    expect(thanksgiving).toMatch(/walks completely off camera to the left/i)
    expect(thanksgiving).toMatch(/looks right at the camera/)
    expect(thanksgiving).toMatch(/walk completely off screen on the right/)
    expect(thanksgiving).toMatch(/eye contact while crossing/)
    expect(thanksgiving).toMatch(/instantly come back wearing/)
    expect(thanksgiving).toMatch(/instantly walk back in without any costume/)
    expect(thanksgiving).toMatch(/No fade, dissolve/)
    expect(thanksgiving).toMatch(/Costume appears or vanishes the instant they re-enter/)
    expect(thanksgiving).toMatch(/without any costume/)
    expect(thanksgiving).toMatch(/exact original sitting position/)
    expect(thanksgiving).toMatch(/Do not use the usual 6s/)
    expect(thanksgiving).not.toMatch(/0–2s:/)
    expect(thanksgiving).not.toMatch(/peaks in the first ~2–3 seconds/)
    expect(thanksgiving).not.toMatch(INVITING_SOUND)

    expect(halloween).toMatch(/Halloween dog costume/)
    expect(halloween).toMatch(/black huskita/)
    expect(halloween).toMatch(/Soft Foley wanted/)
    expect(halloween).toMatch(/MUST HAVE AUDIO/)
    expect(halloween).not.toMatch(/Silence-first/)
    expect(halloween).not.toMatch(/not sound/)
    expect(halloween).toMatch(/10s/)

    expect(bothChristmas).toMatch(/both dogs do this same costume-walk pattern/i)
    expect(bothChristmas).toMatch(/both dogs stay identifiable/i)
    expect(bothChristmas).toMatch(/Santa hat/)
    expect(bothChristmas).toMatch(/Do not swap coats/)
    expect(bothChristmas).toMatch(/Soft Foley wanted/)
    expect(bothChristmas).not.toMatch(/Silence-first/)

    expect(walk).toMatch(/6 seconds/)
    expect(walk).toMatch(/0–2s:/)
    expect(walk).toMatch(/4–6s:/)
    expect(walk).not.toMatch(/Pilgrim/)
    expect(walk).not.toMatch(/costume walk/i)
  })

  it('binds Riley soft no/stop Suggest to ears-back correction, not treat lick', () => {
    const rileyNo = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'no',
      intentDescription: 'No / Stop',
      slotLabel: 'Ears Back / Pause',
    })
    const rileyGuilty = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'no',
      intentDescription: 'No / Stop',
      slotLabel: 'Guilty settle',
    })
    const murphyNo = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'no',
      intentDescription: 'No / Stop',
      slotLabel: 'Ears Back / Pause',
    })
    const rileyTreat = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'treat',
      intentDescription: 'Treat / chicken',
      slotLabel: 'Lick / expectant',
    })

    for (const prompt of [rileyNo, rileyGuilty]) {
      expect(prompt).toMatch(/MUST HAVE AUDIO/)
      expect(prompt).toMatch(/Soft Foley wanted/)
      expect(prompt).toMatch(/Intent \(no\): No \/ Stop/)
      expect(prompt).toMatch(/ears (go )?back/i)
      expect(prompt).toMatch(/pause/i)
      expect(prompt).toMatch(/guilty|uh oh/i)
      expect(prompt).toMatch(/Mouth closed/)
      expect(prompt).not.toMatch(/Intent \(treat\)/)
      expect(prompt).not.toMatch(/Treat \/ chicken/)
      expect(prompt).not.toMatch(/eyes lock on an implied treat/i)
      expect(prompt).not.toMatch(/food-interest/i)
      expect(prompt).not.toMatch(/expectant lick|Lick \/ expectant/i)
      expect(prompt).not.toMatch(/maybe a brief lick/i)
      expect(prompt).not.toMatch(/bares (his |her )?teeth/i)
      expect(prompt).not.toMatch(/silent warning/i)
      expect(prompt).not.toMatch(/Silence-first/)
    }

    expect(rileyNo).toMatch(/Variant beat: Ears Back \/ Pause/)
    expect(rileyNo).toMatch(/No lick, no treat or food sounds/)
    expect(rileyNo).not.toMatch(/soft mouth\/lick/)
    expect(rileyGuilty).toMatch(/Variant beat: Guilty settle/)

    expect(murphyNo).toMatch(/Silence-first/)
    expect(murphyNo).toMatch(/Intent \(no\): No \/ Stop/)
    expect(murphyNo).toMatch(/ears (go )?back/i)
    expect(murphyNo).toMatch(/guilty|uh oh/i)
    expect(murphyNo).not.toMatch(/Soft Foley wanted/)
    expect(murphyNo).not.toMatch(/Intent \(treat\)/)
    expect(murphyNo).not.toMatch(/Treat \/ chicken/)
    expect(murphyNo).not.toMatch(/eyes lock on an implied treat/i)
    expect(murphyNo).not.toMatch(/Lick \/ expectant/i)

    expect(rileyTreat).toMatch(/Intent \(treat\): Treat \/ chicken/)
    expect(rileyTreat).toMatch(/eyes lock on an implied treat/i)
    expect(rileyTreat).toMatch(/Variant beat: Lick \/ expectant/)
    expect(rileyTreat).toMatch(/Soft Foley wanted/)
  })

  it('does not let leaked treat slot labels or notes reclassify a no parent intent', () => {
    const leaked = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'no',
      intentDescription: 'No / Stop',
      slotLabel: 'Lick / expectant',
      userNotes: 'licks lips, treat chicken, expectant food',
    })

    expect(leaked).toMatch(/Intent \(no\): No \/ Stop/)
    expect(leaked).toMatch(/Correction beat: ears back/i)
    expect(leaked).toMatch(/Mouth closed/)
    expect(leaked).not.toMatch(/Intent \(treat\)/)
    expect(leaked).not.toMatch(/Treat \/ chicken/)
    expect(leaked).not.toMatch(/eyes lock on an implied treat/i)
    expect(leaked).not.toMatch(/food-interest/i)
    expect(leaked).not.toMatch(/Variant beat: Lick \/ expectant/)
    expect(leaked).toMatch(/Director notes for this slot: licks lips, treat chicken, expectant food/)
  })

  it('does not cross-wire hug / howl / play / unknown from treat slot copy', () => {
    const leakedTreat = {
      slotLabel: 'Lick / expectant',
      userNotes: 'treat / chicken, expectant lick',
    }
    const hug = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'hug',
      intentDescription: 'Hug / cuddle',
      ...leakedTreat,
    })
    const howl = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'howl',
      intentDescription: 'Howl / sing',
      ...leakedTreat,
    })
    const play = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'play',
      intentDescription: 'Play / play-bow',
      ...leakedTreat,
    })
    const unknown = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'unknown',
      intentDescription: 'Unknown / confused head-tilt',
      ...leakedTreat,
    })

    expect(hug).toMatch(/Intent \(hug\)/)
    expect(hug).toMatch(/bares (his |her )?teeth/i)
    expect(hug).not.toMatch(/Intent \(treat\)/)
    expect(hug).not.toMatch(/eyes lock on an implied treat/i)
    expect(hug).not.toMatch(/Variant beat: Lick \/ expectant/)

    expect(howl).toMatch(/Intent \(howl\)/)
    expect(howl).toMatch(/awkward/i)
    expect(howl).not.toMatch(/Intent \(treat\)/)
    expect(howl).not.toMatch(/eyes lock on an implied treat/i)

    expect(play).toMatch(/Intent \(play\)/)
    expect(play).toMatch(/play-bow/i)
    expect(play).not.toMatch(/Intent \(treat\)/)
    expect(play).not.toMatch(/eyes lock on an implied treat/i)

    expect(unknown).toMatch(/Intent \(unknown\)/)
    expect(unknown).toMatch(/head-tilt/i)
    expect(unknown).not.toMatch(/Intent \(treat\)/)
    expect(unknown).not.toMatch(/Intent \(no\)/)
    expect(unknown).not.toMatch(/eyes lock on an implied treat/i)
    expect(unknown).not.toMatch(/Correction beat/i)
  })

  it('classifies no/stop and treat from the parent intent, not unknown or slot labels', () => {
    expect(isNoLikeIntent('no', 'No / Stop')).toBe(true)
    expect(isNoLikeIntent('no-stop', 'No / Stop')).toBe(true)
    expect(isNoLikeIntent('stop', 'Stop that')).toBe(true)
    expect(isNoLikeIntent('unknown', 'Unknown / confused head-tilt')).toBe(false)
    expect(isNoLikeIntent('treat', 'Treat / chicken')).toBe(false)
    expect(isTreatLikeIntent('treat', 'Treat / chicken')).toBe(true)
    expect(isTreatLikeIntent('no', 'No / Stop')).toBe(false)
    expect(isTreatLikeIntent('unknown', 'Unknown / confused head-tilt')).toBe(false)
    expect(isTreatLikeIntent('halloween', 'Halloween')).toBe(false)
  })

  it('does not treat an empty or unlabeled intent as treat', () => {
    const empty = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: '',
      intentDescription: '',
      slotLabel: 'Lick / expectant',
    })
    const idle = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'idle',
      intentDescription: 'Idle FaceTime hold',
      slotLabel: 'Calm look at camera',
    })

    expect(empty).toMatch(/Intent \(reaction\)/)
    expect(empty).not.toMatch(/Intent \(treat\)/)
    expect(empty).not.toMatch(/eyes lock on an implied treat/i)
    expect(empty).not.toMatch(/food-interest/i)
    expect(empty).not.toMatch(/maybe a brief lick/i)
    expect(idle).toMatch(/Intent \(idle\)/)
    expect(idle).not.toMatch(/Intent \(treat\)/)
    expect(idle).not.toMatch(/eyes lock on an implied treat/i)
  })

  it('puts a short warning growl in SOUND from slot notes and bans howl/bark', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'hug',
      intentDescription: 'Hug / cuddle',
      slotLabel: 'Side-touch reaction',
      userNotes: 'short warning growl',
      hasSourcePhoto: true,
      framing,
    })

    expect(prompt).toMatch(/MUST HAVE AUDIO/)
    expect(prompt).toMatch(/SOUND:/)
    expect(prompt).toMatch(/short low warning growl/i)
    expect(prompt).toMatch(/Not a long rumble/)
    expect(prompt).toMatch(/Not an attack roar/)
    expect(prompt).toMatch(/No howl/)
    expect(prompt).toMatch(/No bark/)
    expect(prompt).toMatch(/No whine/)
    expect(prompt).toMatch(/2–4s:[\s\S]*short low growl lands here/)
    expect(prompt).toMatch(/Director notes for this slot: short warning growl/)
    expect(prompt).toMatch(/male black huskita/)
    expect(prompt).not.toMatch(/Silence-first/)
    expect(prompt).not.toMatch(/no growl sound/)
  })

  it('expands plain “side eye” (no GAZE: prefix) to the full canonical GAZE MECHANICS block', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'hug',
      intentDescription: 'Hug / cuddle',
      slotLabel: 'Side-touch reaction',
      userNotes: 'side eye',
    })

    expect(prompt).toMatch(/GAZE MECHANICS \(do this exactly\)/)
    expect(prompt).toMatch(/The camera lens is a fixed point in space/)
    expect(prompt).toMatch(/Riley's pupils stay aimed at that same point for all 6 seconds/)
    expect(prompt).toMatch(/yaws about 30 degrees to his left \(viewer's right\)/)
    expect(prompt).toMatch(/eyeballs counter-rotate in the sockets/)
    expect(prompt).toMatch(/stare never leaves the lens/)
    expect(prompt).toMatch(/head\/snout turns, eyes do not/)
    expect(prompt).toMatch(/sliver of eye-white \(sclera\)/)
    expect(prompt).toMatch(/classic side-eye/)
    expect(prompt).toMatch(/never looks where the snout points/)
    expect(prompt).toMatch(/0–2s:[\s\S]*counter-rotate/)
    expect(prompt).toMatch(/Director notes for this slot: side eye/)
    expect(prompt).not.toMatch(/Director notes for this slot:[\s\S]*GAZE MECHANICS \(do this exactly\)/)
  })

  it('expands sideeye / sclera the same way, and still accepts an optional GAZE: prefix', () => {
    const phrases = ['side-eye', 'sideeye', 'sclera side-eye', 'GAZE: side-eye']
    for (const userNotes of phrases) {
      const prompt = suggestClipPrompt({
        dogName: 'Riley',
        personality: RILEY_PERSONALITY,
        intentId: 'name',
        intentDescription: 'Dog name',
        slotLabel: 'Perk up / eye contact',
        userNotes,
      })
      expect(prompt, userNotes).toMatch(/GAZE MECHANICS \(do this exactly\)/)
      expect(prompt, userNotes).toMatch(/counter-rotate/)
      expect(prompt, userNotes).toMatch(/his left \(viewer's right\)/)
      expect(prompt, userNotes).toMatch(`Director notes for this slot: ${userNotes}`)
    }

    const noGaze = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'hug',
      intentDescription: 'Hug / cuddle',
      slotLabel: 'Side-touch reaction',
    })
    expect(noGaze).not.toMatch(/GAZE MECHANICS/)
    expect(noGaze).not.toMatch(/counter-rotate/)
  })

  it('expands plain camera lock without a side-eye turn', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Murphy',
      personality: MURPHY_PERSONALITY,
      intentId: 'name',
      intentDescription: 'Dog name',
      slotLabel: 'Perk up / eye contact',
      userNotes: 'camera lock',
    })
    expect(prompt).toMatch(/GAZE MECHANICS \(do this exactly\)/)
    expect(prompt).toMatch(/Murphy's pupils stay aimed/)
    expect(prompt).toMatch(/Eyes on the lens/)
    expect(prompt).toMatch(/No 30-degree side-eye muzzle yaw/)
    expect(prompt).toMatch(/Director notes for this slot: camera lock/)
    expect(prompt).not.toMatch(/yaws about 30 degrees/)
    expect(prompt).not.toMatch(/classic side-eye/)
    expect(prompt).not.toMatch(/counter-rotate/)
  })

  it('muzzle right on plain side eye mirrors yaw to the dog’s right (viewer’s left)', () => {
    const prompt = suggestClipPrompt({
      dogName: 'Riley',
      personality: RILEY_PERSONALITY,
      intentId: 'hug',
      intentDescription: 'Hug / cuddle',
      slotLabel: 'Side-touch reaction',
      userNotes: 'side eye muzzle right',
    })
    expect(prompt).toMatch(/GAZE MECHANICS \(do this exactly\)/)
    expect(prompt).toMatch(/his right \(viewer's left\)/)
    expect(prompt).not.toMatch(/his left \(viewer's right\)/)
    expect(prompt).toMatch(/counter-rotate/)
    expect(prompt).toMatch(/Director notes for this slot: side eye muzzle right/)
  })

  it('bakes Riley and Murphy no/stop seed slots without treat lick copy', () => {
    const seed = createSeedStudioState()
    const riley = seed.dogs.find((dog) => dog.id === 'riley')
    const murphy = seed.dogs.find((dog) => dog.id === 'murphy')
    const rileyNo = riley?.intents.find((intent) => intent.id === 'no')
    const murphyNo = murphy?.intents.find((intent) => intent.id === 'no')
    expect(rileyNo?.description).toMatch(/No \/ Stop/)
    expect(rileyNo?.clipSlots[0]?.label).toMatch(/ears back/i)
    expect(rileyNo?.clipSlots[0]?.prompt).toMatch(/Intent \(no\)/)
    expect(rileyNo?.clipSlots[0]?.prompt).toMatch(/ears (go )?back/i)
    expect(rileyNo?.clipSlots[0]?.prompt).toMatch(/Soft Foley wanted/)
    expect(rileyNo?.clipSlots[0]?.prompt).not.toMatch(/Intent \(treat\)/)
    expect(rileyNo?.clipSlots[0]?.prompt).not.toMatch(/Treat \/ chicken/)
    expect(rileyNo?.clipSlots[0]?.prompt).not.toMatch(/eyes lock on an implied treat/i)
    expect(rileyNo?.clipSlots[0]?.prompt).not.toMatch(/Lick \/ expectant/i)
    expect(murphyNo?.clipSlots[0]?.prompt).toMatch(/Silence-first/)
    expect(murphyNo?.clipSlots[0]?.prompt).toMatch(/Intent \(no\)/)
    expect(murphyNo?.clipSlots[0]?.prompt).not.toMatch(/Intent \(treat\)/)
    expect(murphyNo?.clipSlots[0]?.prompt).not.toMatch(/Soft Foley wanted/)
    expect(rileyNo?.clipSlots[0]?.prompt).toMatch(/Correction beat/)
    expect(murphyNo?.clipSlots[0]?.prompt).toMatch(/Correction beat/)
  })

  it('keeps Riley No / Stop aliases on ears-back / pause — never treat, lick, or chicken', () => {
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

    for (const prompt of [noStop, stopAlias, mislabeled]) {
      expect(prompt).toMatch(/Intent \((no|no-stop|correction)\)/)
      expect(prompt).toMatch(/Correction beat/)
      expect(prompt).toMatch(/ears (go )?back/i)
      expect(prompt).not.toMatch(/Intent \(treat\)/)
      expect(prompt).not.toMatch(/Treat \/ chicken/)
      expect(prompt).not.toMatch(/eyes lock on an implied treat/i)
      expect(prompt).not.toMatch(/food-interest/i)
      expect(prompt).not.toMatch(/maybe a brief lick/i)
      expect(prompt).not.toMatch(/soft mouth\/lick/i)
    }

    expect(mislabeled).toMatch(/Director notes/)
    expect(mislabeled).toMatch(/chicken/)
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
      expect(prompt, row.intentId).toMatch(/loop back to idle without a jump/)
      expect(prompt, row.intentId).toMatch(/Do not freeze mid-lick, mid-bow, off-center, or in a different pose/)
      expect(prompt, row.intentId).toMatch(/0–2s:/)
      expect(prompt, row.intentId).toMatch(/4–6s:/)
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
    expect(halloween).not.toMatch(/loop back to idle without a jump/)
    expect(halloween).toMatch(/exact original sitting position of the source still/)
    expect(classifySuggestIntent({ intentId: 'halloween', intentDescription: 'Halloween' })).toBe(
      'holiday',
    )
  })
})
