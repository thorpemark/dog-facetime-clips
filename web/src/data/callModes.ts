/**
 * Built-in call modes: Murphy (tan, folded ears), Riley (black/white, upright
 * ears), and Both (Murphy left + Riley right). Photos live in
 * `web/public/modes/`.
 */
import type { ClipSourcePhoto } from '../types/clipStudio'
import type { CallTargetKind } from '../types/memorial'
import { publicAssetUrl } from '../lib/urls'
import {
  LANDSCAPE_CALL_ASPECT,
  PORTRAIT_CALL_ASPECT,
  fitFullImageFraming,
  focalFrameFromCenter,
  type DualFraming,
} from '../utils/focalPoint'

export const MODE_PHOTO_DIR = 'modes'

export type CallModeId = 'murphy' | 'riley' | 'both'

export interface CallMode {
  id: CallModeId
  name: string
  /** Catalog / Studio dog name (same as `name` for the seed dogs). */
  dogName: string
  kind: CallTargetKind
  subtitle: string
  /** Relative path under `web/public/`. */
  photoPath: string
  /** Source image width / height. */
  imageAspect: number
  framing: DualFraming
  preferWideFrame: boolean
}

/** Portrait headshots (1200×1600). */
const SOLO_ASPECT = 1200 / 1600

/** Together still (1400×788). */
const BOTH_ASPECT = 1400 / 788

function soloFraming(): DualFraming {
  return {
    portrait: focalFrameFromCenter(
      0.5,
      0.4,
      0.88,
      0.66,
      SOLO_ASPECT,
      PORTRAIT_CALL_ASPECT,
    ),
    landscape: focalFrameFromCenter(
      0.5,
      0.38,
      1,
      0.52,
      SOLO_ASPECT,
      LANDSCAPE_CALL_ASPECT,
    ),
  }
}

function bothFraming(): DualFraming {
  return {
    // Keep both dogs visible on a phone; letterbox/pillarbox rather than
    // slicing one of them out of a 9:16 cover crop.
    portrait: fitFullImageFraming(BOTH_ASPECT, PORTRAIT_CALL_ASPECT),
    landscape: focalFrameFromCenter(
      0.5,
      0.58,
      0.78,
      1,
      BOTH_ASPECT,
      LANDSCAPE_CALL_ASPECT,
    ),
  }
}

export const CALL_MODES: CallMode[] = [
  {
    id: 'murphy',
    name: 'Murphy',
    dogName: 'Murphy',
    kind: 'dog_a',
    subtitle: 'Tan huskita · folded ears',
    photoPath: `${MODE_PHOTO_DIR}/murphy.jpg`,
    imageAspect: SOLO_ASPECT,
    framing: soloFraming(),
    preferWideFrame: false,
  },
  {
    id: 'riley',
    name: 'Riley',
    dogName: 'Riley',
    kind: 'dog_b',
    subtitle: 'Black & white huskita · upright ears',
    photoPath: `${MODE_PHOTO_DIR}/riley.jpg`,
    imageAspect: SOLO_ASPECT,
    framing: soloFraming(),
    preferWideFrame: false,
  },
  {
    id: 'both',
    name: 'Both',
    dogName: 'Both',
    kind: 'together',
    subtitle: 'Murphy left · Riley right',
    photoPath: `${MODE_PHOTO_DIR}/both.jpg`,
    imageAspect: BOTH_ASPECT,
    framing: bothFraming(),
    preferWideFrame: true,
  },
]

export function callModeById(id: string): CallMode | undefined {
  return CALL_MODES.find((mode) => mode.id === id)
}

export function callModeForName(name?: string): CallMode | undefined {
  if (!name) return undefined
  const needle = name.trim().toLowerCase()
  if (needle === 'together') return callModeById('both')
  return CALL_MODES.find(
    (mode) =>
      mode.id === needle ||
      mode.name.toLowerCase() === needle ||
      mode.dogName.toLowerCase() === needle,
  )
}

export function modePhotoUrl(mode: Pick<CallMode, 'photoPath'> | string): string {
  const path = typeof mode === 'string' ? mode : mode.photoPath
  return publicAssetUrl(path)
}

export function defaultSourcePhotoForMode(mode: CallMode): ClipSourcePhoto {
  return {
    id: `seed-photo-${mode.id}`,
    url: modePhotoUrl(mode),
    publicPath: mode.photoPath,
    framing: structuredClone(mode.framing),
  }
}

/** Intents that always get the dog’s seed still (idle + key reactions). */
export const KEY_SEED_INTENT_IDS = ['idle', 'name', 'come', 'hug', 'howl', 'unknown'] as const

export function isKeySeedIntent(intentId: string): boolean {
  return (KEY_SEED_INTENT_IDS as readonly string[]).includes(intentId)
}
