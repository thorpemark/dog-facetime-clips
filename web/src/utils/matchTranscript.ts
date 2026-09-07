import type { ReactionBucket } from '../data/reactionCatalog'
import { isNameLikeBucket } from '../data/reactionCatalog'
import { getEffectiveCatalog } from './catalogOverrides'

export const MATCH_CONFIDENCE_THRESHOLD = 0.34
/** When two buckets are this close, higher `priority` wins. */
export const MATCH_PRIORITY_TIE_DELTA = 0.08

export type MatchMethod = 'keyword' | 'semantic'

export interface TranscriptMatch {
  bucketId: string
  score: number
  method: MatchMethod
  matchedPhrase?: string
}

export interface MatchTranscriptOptions {
  dogName?: string
  ownerName?: string
  threshold?: number
  catalog?: ReactionBucket[]
}

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'to',
  'for',
  'of',
  'and',
  'or',
  'my',
  'your',
  'our',
  'please',
  'hey',
  'hi',
  'oh',
  'um',
  'uh',
  'just',
  'can',
  'you',
  'could',
  'would',
  'will',
  'lets',
  'let',
  'me',
  'us',
  'some',
  'that',
  'this',
  'it',
  'is',
  'are',
  'be',
  'do',
  'did',
  'does',
  'with',
  'on',
  'in',
  'at',
  'from',
])

/** Word → canonical tokens that help paraphrase matching. */
const WORD_ALIASES: Record<string, string> = {
  "c'mere": 'come',
  cmere: 'come',
  cmon: 'come',
  "c'mon": 'come',
  comeon: 'come',
  closer: 'come',
  approach: 'come',
  cookie: 'treat',
  cookies: 'treat',
  snack: 'treat',
  snacks: 'treat',
  chicken: 'treat',
  nummies: 'treat',
  yum: 'treat',
  yummy: 'treat',
  food: 'treat',
  dinner: 'treat',
  breakfast: 'treat',
  supper: 'treat',
  outside: 'walk',
  outdoors: 'walk',
  leash: 'walk',
  potty: 'walk',
  pee: 'walk',
  backyard: 'walk',
  stroll: 'walk',
  fetch: 'play',
  ball: 'play',
  toy: 'play',
  toys: 'play',
  tug: 'play',
  playtime: 'play',
  shh: 'quiet',
  shush: 'quiet',
  settle: 'quiet',
  relax: 'quiet',
  easy: 'quiet',
  attaboy: 'good',
  attagirl: 'good',
  pup: 'dog',
  puppy: 'dog',
  boy: 'boy',
  girl: 'girl',
  wanna: 'want',
  wanta: 'want',
  gonna: 'going',
  dont: 'no',
  "don't": 'no',
  stop: 'no',
  nope: 'no',
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function expandPlaceholders(
  phrase: string,
  dogName: string,
  ownerName: string,
): string {
  return phrase
    .replace(/\{dogName\}/g, dogName)
    .replace(/\{ownerName\}/g, ownerName)
}

export function normalizeTranscript(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/c['']mere/g, 'cmere')
    .replace(/c['']mon/g, 'cmon')
    .replace(/who['']s/g, 'whos')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nameVariants(name: string): string[] {
  const n = normalizeTranscript(name)
  if (n.length < 2) return []
  const variants = new Set<string>([n])
  if (n.length >= 5) {
    variants.add(n.slice(0, Math.max(4, n.length - 1)))
    variants.add(n.slice(0, Math.max(4, n.length - 2)))
  }
  return [...variants]
}

export function stripNames(
  transcript: string,
  dogName: string,
  ownerName: string,
): string {
  let text = ` ${transcript} `
  const names = [...nameVariants(dogName), ...nameVariants(ownerName)]
  for (const name of names) {
    if (!name) continue
    const re = new RegExp(`\\b${escapeRegExp(name)}\\w*\\b`, 'gi')
    text = text.replace(re, ' ')
  }
  return text.replace(/\s+/g, ' ').trim()
}

function tokenize(text: string): string[] {
  return normalizeTranscript(text)
    .split(' ')
    .filter((t) => t.length > 0)
    .map((t) => WORD_ALIASES[t] ?? t)
    .filter((t) => !STOPWORDS.has(t))
}

function charNgrams(text: string, n = 3): string[] {
  const padded = ` ${normalizeTranscript(text)} `
  if (padded.length < n) return padded.length > 2 ? [padded] : []
  const grams: string[] = []
  for (let i = 0; i <= padded.length - n; i++) {
    grams.push(padded.slice(i, i + n))
  }
  return grams
}

function termFreq(terms: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const term of terms) {
    freq.set(term, (freq.get(term) ?? 0) + 1)
  }
  return freq
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let magA = 0
  let magB = 0
  for (const value of a.values()) magA += value * value
  for (const value of b.values()) magB += value * value
  if (magA === 0 || magB === 0) return 0
  const [shorter, longer] = a.size < b.size ? [a, b] : [b, a]
  for (const [key, value] of shorter) {
    const other = longer.get(key)
    if (other) dot += value * other
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

function tokenCoverage(queryTokens: string[], docTokens: Set<string>): number {
  if (queryTokens.length === 0) return 0
  let hit = 0
  for (const token of queryTokens) {
    if (docTokens.has(token)) hit += 1
  }
  return hit / queryTokens.length
}

interface BucketIndex {
  bucket: ReactionBucket
  phrases: string[]
  ngramVec: Map<string, number>
  tokenSet: Set<string>
}

function bucketDocument(bucket: ReactionBucket, dogName: string, ownerName: string): string {
  const phrases = bucket.phrases
    .map((p) => expandPlaceholders(p, dogName || 'dogname', ownerName || 'ownername'))
    .join(' ')
  return `${phrases} ${bucket.semanticHints ?? ''} ${bucket.description ?? ''}`
}

function buildIndex(
  catalog: ReactionBucket[],
  dogName: string,
  ownerName: string,
): BucketIndex[] {
  const docs = catalog.map((bucket) => ({
    bucket,
    phrases: bucket.phrases.map((p) =>
      normalizeTranscript(expandPlaceholders(p, dogName, ownerName)),
    ),
    ngrams: charNgrams(bucketDocument(bucket, dogName, ownerName)),
    tokenSet: new Set(tokenize(bucketDocument(bucket, dogName, ownerName))),
  }))

  const df = new Map<string, number>()
  for (const doc of docs) {
    const seen = new Set(doc.ngrams)
    for (const gram of seen) {
      df.set(gram, (df.get(gram) ?? 0) + 1)
    }
  }
  const n = docs.length || 1

  return docs.map((doc) => {
    const tf = termFreq(doc.ngrams)
    const ngramVec = new Map<string, number>()
    for (const [gram, count] of tf) {
      const idf = Math.log((n + 1) / ((df.get(gram) ?? 0) + 1)) + 1
      ngramVec.set(gram, count * idf)
    }
    return {
      bucket: doc.bucket,
      phrases: doc.phrases.filter(Boolean),
      ngramVec,
      tokenSet: doc.tokenSet,
    }
  })
}

function phraseMatchesTranscript(phrase: string, transcript: string): boolean {
  if (!phrase) return false
  if (phrase.length <= 3 || !phrase.includes(' ')) {
    const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i')
    return re.test(transcript)
  }
  return transcript.includes(phrase)
}

interface KeywordHit {
  phrase: string
  score: number
}

function bestKeywordHit(phrases: string[], transcript: string): KeywordHit | null {
  let best: KeywordHit | null = null
  for (const phrase of phrases) {
    if (!phraseMatchesTranscript(phrase, transcript)) continue
    const words = phrase.split(' ').filter(Boolean).length
    const score = Math.min(1, 0.72 + Math.min(phrase.length, 24) / 80 + Math.min(words, 4) * 0.04)
    if (!best || score > best.score || phrase.length > best.phrase.length) {
      best = { phrase, score }
    }
  }
  return best
}

function semanticScore(transcript: string, index: BucketIndex): number {
  const tokens = tokenize(transcript)
  if (tokens.length === 0 && transcript.length < 2) return 0
  const ngramVec = termFreq(charNgrams(transcript))
  const ngram = cosine(ngramVec, index.ngramVec)
  const coverage = tokenCoverage(tokens, index.tokenSet)
  return 0.42 * coverage + 0.58 * ngram
}

const CONTENT_PREFERENCE = 0.06

/**
 * Match a spoken/typed transcript to a reaction bucket.
 *
 * 1. Keyword / substring against seed phrases (word-bounded for short tokens)
 * 2. Meaning similarity: token coverage + char n-gram cosine vs phrases+hints
 * 3. Below `threshold` → no match (stay on idle)
 * 4. Near-ties broken by bucket `priority`
 *
 * Dog/owner names are stripped before scoring content buckets so
 * "come here Murph" lands on come, not name.
 */
export function matchTranscript(
  raw: string,
  options: MatchTranscriptOptions = {},
): TranscriptMatch | null {
  const dogName = options.dogName?.trim() || ''
  const ownerName = options.ownerName?.trim() || ''
  const threshold = options.threshold ?? MATCH_CONFIDENCE_THRESHOLD
  const catalog = options.catalog ?? getEffectiveCatalog()
  const transcript = normalizeTranscript(raw)
  if (!transcript) return null

  const stripped = stripNames(transcript, dogName, ownerName)
  const index = buildIndex(catalog, dogName, ownerName)

  interface Candidate {
    bucketId: string
    score: number
    method: MatchMethod
    matchedPhrase?: string
    priority: number
    nameLike: boolean
  }

  const candidates: Candidate[] = []

  for (const entry of index) {
    const nameLike = isNameLikeBucket(entry.bucket.id)
    const keywordText = nameLike ? transcript : stripped || transcript
    const keyword = bestKeywordHit(entry.phrases, keywordText)
    const semanticText = nameLike ? transcript : stripped || transcript
    const semantic = semanticScore(semanticText, entry)

    if (keyword) {
      let score = keyword.score
      if (nameLike && stripped.trim().length > 0) {
        score = Math.min(score, 0.45)
      }
      candidates.push({
        bucketId: entry.bucket.id,
        score,
        method: 'keyword',
        matchedPhrase: keyword.phrase,
        priority: entry.bucket.priority,
        nameLike,
      })
    }

    if (semantic >= threshold * 0.85) {
      candidates.push({
        bucketId: entry.bucket.id,
        score: semantic,
        method: 'semantic',
        priority: entry.bucket.priority,
        nameLike,
      })
    }
  }

  if (candidates.length === 0) return null

  const byBucket = new Map<string, Candidate>()
  for (const candidate of candidates) {
    const prev = byBucket.get(candidate.bucketId)
    if (!prev || candidate.score > prev.score + 0.001) {
      byBucket.set(candidate.bucketId, candidate)
      continue
    }
    if (Math.abs(candidate.score - prev.score) <= 0.001 && candidate.method === 'keyword') {
      byBucket.set(candidate.bucketId, { ...prev, method: 'keyword', matchedPhrase: candidate.matchedPhrase ?? prev.matchedPhrase })
    }
  }

  const ranked = [...byBucket.values()].sort((a, b) => {
    const scoreA = a.score + (a.nameLike ? 0 : CONTENT_PREFERENCE)
    const scoreB = b.score + (b.nameLike ? 0 : CONTENT_PREFERENCE)
    if (Math.abs(scoreA - scoreB) <= MATCH_PRIORITY_TIE_DELTA) {
      if (b.priority !== a.priority) return b.priority - a.priority
    }
    return scoreB - scoreA
  })

  const best = ranked[0]
  if (!best || best.score < threshold) return null

  return {
    bucketId: best.bucketId,
    score: Number(best.score.toFixed(3)),
    method: best.method,
    matchedPhrase: best.matchedPhrase,
  }
}

/** Rank all buckets for the catalog tester UI. */
export function rankTranscriptMatches(
  raw: string,
  options: MatchTranscriptOptions = {},
): TranscriptMatch[] {
  const dogName = options.dogName?.trim() || ''
  const ownerName = options.ownerName?.trim() || ''
  const catalog = options.catalog ?? getEffectiveCatalog()
  const transcript = normalizeTranscript(raw)
  if (!transcript) return []

  const stripped = stripNames(transcript, dogName, ownerName)
  const index = buildIndex(catalog, dogName, ownerName)

  return index
    .map((entry) => {
      const nameLike = isNameLikeBucket(entry.bucket.id)
      const keywordText = nameLike ? transcript : stripped || transcript
      const keyword = bestKeywordHit(entry.phrases, keywordText)
      const semantic = semanticScore(nameLike ? transcript : stripped || transcript, entry)
      const score = Math.max(keyword?.score ?? 0, semantic)
      const method: MatchMethod = keyword && (keyword.score >= semantic) ? 'keyword' : 'semantic'
      return {
        bucketId: entry.bucket.id,
        score: Number(score.toFixed(3)),
        method,
        matchedPhrase: keyword?.phrase,
      }
    })
    .sort((a, b) => b.score - a.score)
}
