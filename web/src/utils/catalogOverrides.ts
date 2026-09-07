import type { ReactionBucket, WeightedClip } from '../data/reactionCatalog'
import { catalogForDogName } from './clipStudioCatalog'

export const WEIGHT_OVERRIDE_STORAGE_KEY = 'dog-facetime-clips.catalogWeightOverrides'

/** bucketId → clip path → weight */
export type WeightOverrides = Record<string, Record<string, number>>

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readWeightOverrides(): WeightOverrides {
  if (!canUseStorage()) return {}
  try {
    const raw = window.localStorage.getItem(WEIGHT_OVERRIDE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as WeightOverrides
  } catch {
    return {}
  }
}

export function writeWeightOverrides(overrides: WeightOverrides): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(WEIGHT_OVERRIDE_STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    /* quota / private mode */
  }
}

export function clearWeightOverrides(): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.removeItem(WEIGHT_OVERRIDE_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function applyWeightOverrides(
  clips: WeightedClip[],
  bucketId: string,
  overrides: WeightOverrides = readWeightOverrides(),
): WeightedClip[] {
  const bucketOverrides = overrides[bucketId]
  if (!bucketOverrides) return clips
  return clips.map((clip) => {
    const next = bucketOverrides[clip.path]
    if (typeof next !== 'number' || Number.isNaN(next)) return clip
    return { ...clip, weight: Math.max(0, next) }
  })
}

export function getEffectiveCatalog(
  overrides?: WeightOverrides,
  dogName?: string,
): ReactionBucket[] {
  const resolved = overrides ?? readWeightOverrides()
  return catalogForDogName(dogName).map((bucket) => ({
    ...bucket,
    clips: applyWeightOverrides(bucket.clips, bucket.id, resolved),
  }))
}

export function setClipWeightOverride(
  bucketId: string,
  path: string,
  weight: number,
): WeightOverrides {
  const overrides = readWeightOverrides()
  const bucket = { ...(overrides[bucketId] ?? {}), [path]: Math.max(0, weight) }
  const next = { ...overrides, [bucketId]: bucket }
  writeWeightOverrides(next)
  return next
}
