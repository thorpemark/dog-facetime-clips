import type { KeywordRule, KeywordRulesConfig } from '../types'
import {
  IDLE_CLIP_PATHS,
  pickWeightedClip,
  type ReactionBucket,
} from '../data/reactionCatalog'
import { getEffectiveCatalog } from './catalogOverrides'
import { matchTranscript } from './matchTranscript'

export function resolvePhrases(
  rule: KeywordRule,
  dogName: string,
  ownerName: string,
): string[] {
  return rule.phrases.map((phrase) =>
    phrase
      .replace(/\{dogName\}/g, dogName)
      .replace(/\{ownerName\}/g, ownerName),
  )
}

export function ruleMatchesTranscript(
  rule: KeywordRule,
  transcript: string,
  dogName: string,
  ownerName: string,
): boolean {
  const match = matchTranscript(transcript, { dogName, ownerName })
  return match?.bucketId === rule.id
}

export function findMatchingRule(
  rules: KeywordRule[],
  transcript: string,
  dogName: string,
  ownerName: string,
): KeywordRule | undefined {
  const match = matchTranscript(transcript, { dogName, ownerName })
  if (!match) return undefined
  return rules.find((rule) => rule.id === match.bucketId)
}

export function bucketToKeywordRule(bucket: ReactionBucket): KeywordRule {
  const ranked = [...bucket.clips].sort((a, b) => b.weight - a.weight)
  const fallbackClip = ranked[0]?.path ?? 'clips/idle.mp4'
  const fileName = fallbackClip.replace(/^clips\//, '')
  return {
    id: bucket.id,
    phrases: bucket.phrases,
    clipFileName: fileName,
    priority: bucket.priority,
    description: bucket.description,
  }
}

/** Catalog is the source of truth; keyword_rules.json remains a static fallback copy. */
export function rulesConfigFromCatalog(dogName?: string): KeywordRulesConfig {
  const catalog = getEffectiveCatalog(undefined, dogName)
  return {
    version: 2,
    idleClip: IDLE_CLIP_PATHS[2] ?? IDLE_CLIP_PATHS[0] ?? 'idle.mp4',
    rules: catalog.map(bucketToKeywordRule),
  }
}

export async function loadKeywordRules(): Promise<KeywordRulesConfig> {
  try {
    const base = import.meta.env.BASE_URL
    const response = await fetch(`${base}keyword_rules.json`)
    if (response.ok) {
      const legacy = (await response.json()) as KeywordRulesConfig
      const fromCatalog = rulesConfigFromCatalog()
      return {
        ...fromCatalog,
        idleClip: legacy.idleClip || fromCatalog.idleClip,
      }
    }
  } catch {
    /* catalog-only is enough for GitHub Pages */
  }
  return rulesConfigFromCatalog()
}

export function clipUrl(fileName: string): string {
  if (
    fileName.startsWith('blob:') ||
    fileName.startsWith('data:') ||
    fileName.startsWith('http://') ||
    fileName.startsWith('https://')
  ) {
    return fileName
  }
  const path = fileName.startsWith('clips/') ? fileName : `clips/${fileName}`
  return `${import.meta.env.BASE_URL}${path}`
}

/**
 * Resolve a reaction clip URL for a matched bucket id using weighted pick.
 */
export function reactionClipUrlForBucket(bucketId: string): string | undefined {
  const catalog = getEffectiveCatalog()
  const bucket = catalog.find((b) => b.id === bucketId)
  if (!bucket) return undefined
  const path = pickWeightedClip(bucket, { excludeLast: true, clips: bucket.clips })
  return path ? clipUrl(path) : undefined
}
