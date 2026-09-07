/**
 * Shared seed reaction catalog (fallback + Clip Studio first-load template).
 *
 * Intents are free-form strings — add a new one in Clip Studio (`/studio`)
 * without changing this file. This module remains the baked demo fallback
 * and the template copied into Murphy/Riley seed libraries.
 *
 * Playback picks with `pickWeightedClip`; matching uses `matchTranscript`.
 */

/** Free-form intent id. New phrases/dogs/intents do not require a code change. */
export type ReactionBucketId = string

export interface WeightedClip {
  path: string
  /** Relative weight or percent — normalized at pick time. */
  weight: number
  label?: string
}

export interface ReactionBucket {
  id: ReactionBucketId
  /** Seed examples / keyword fallback; {dogName} / {ownerName} expand at runtime. */
  phrases: string[]
  clips: WeightedClip[]
  priority: number
  description?: string
  /** Free-text intent description used by the meaning matcher. */
  semanticHints?: string
}

/** Placeholder portrait clips — replace with Murphy/Riley AI renders. */
export const CLIPS_BASE = 'clips/reactions'

function clip(
  bucket: string,
  index: number,
  weight: number,
  label: string,
): WeightedClip {
  const n = String(index).padStart(2, '0')
  return {
    path: `${CLIPS_BASE}/${bucket}/${bucket}_${n}.mp4`,
    weight,
    label,
  }
}

function legacyClip(file: string, weight: number, label = 'Legacy placeholder'): WeightedClip {
  return { path: `clips/${file}`, weight, label }
}

/** v1 global catalog (Murphy/Riley demo). Per-memorial overrides planned via Supabase manifest. */
export const REACTION_CATALOG: ReactionBucket[] = [
  {
    id: 'name',
    phrases: ['{dogName}', 'murphy', 'riley', 'biscuit'],
    clips: [
      clip('name', 1, 40, 'Perk up / eye contact'),
      clip('name', 2, 35, 'Head turn toward camera'),
      clip('name', 3, 25, 'Soft recognition'),
      legacyClip('react_biscuit.mp4', 10),
    ],
    priority: 10,
    description: 'Dog name',
    semanticHints:
      'The dog hears their own name called. Greeting the dog by name. Hey buddy, hey pup. Recognition, looking up when addressed. Not a command — just saying the name.',
  },
  {
    id: 'come',
    phrases: ['come here', 'come over here', 'come over', 'get over here', 'come on', "c'mere", 'come to me', 'come'],
    clips: [
      clip('come', 1, 40, 'Head tilt, step forward'),
      clip('come', 2, 35, 'Eager lean in'),
      clip('come', 3, 25, 'Get up and approach'),
      legacyClip('react_come.mp4', 10),
    ],
    priority: 7,
    description: 'Come here',
    semanticHints:
      'Come here, come over, get over here, come to me, come closer, come on over, c’mere, come to the camera, come say hi, come to mom, come to dad. A recall / approach command, not merely looking this way.',
  },
  {
    id: 'here',
    phrases: ['here boy', 'here girl', 'over here', 'this way', 'here'],
    clips: [
      clip('here', 1, 55, 'Look toward camera'),
      clip('here', 2, 45, 'Glance this way'),
    ],
    priority: 6,
    description: 'Here / this way',
    semanticHints:
      'Over here, this way, look here, right here, here boy, here girl. Directing attention toward the speaker or camera without a full come-here recall.',
  },
  {
    id: 'good',
    phrases: ['good boy', 'good girl', 'good dog', "who's a good", 'good pup'],
    clips: [
      clip('good', 1, 40, 'Happy wag'),
      clip('good', 2, 35, 'Soft proud eyes'),
      clip('good', 3, 25, 'Pleased wriggle'),
      legacyClip('react_good.mp4', 10),
    ],
    priority: 7,
    description: 'Good dog',
    semanticHints:
      'Good boy, good girl, good dog, who’s a good dog, such a good pup, yes good, proud of you, that’s a good dog, nice job, attaboy, attagirl. Praise and affection.',
  },
  {
    id: 'treat',
    phrases: [
      'treat',
      'cookie',
      'snack',
      'chicken',
      'want some chicken',
      'want a treat',
    ],
    clips: [
      clip('treat', 1, 40, 'Eager treat interest'),
      clip('treat', 2, 35, 'Food interest'),
      clip('treat', 3, 25, 'Expectant lean'),
      legacyClip('react_treat.mp4', 10),
    ],
    priority: 8,
    description: 'Treat / chicken',
    semanticHints:
      'Treat, cookie, snack, chicken, want a treat, want some chicken, nummies, yum, food, dinner, breakfast, supper, something to eat. Excited about getting food.',
  },
  {
    id: 'walk',
    phrases: ['walk', 'go for a walk', 'wanna walk', 'go outside', 'outside', 'go out'],
    clips: [
      clip('walk', 1, 40, 'Alert, tail energy'),
      clip('walk', 2, 35, 'Door / leash excitement'),
      clip('walk', 3, 25, 'Ready to go'),
      legacyClip('react_walk.mp4', 10),
    ],
    priority: 8,
    description: 'Walk',
    semanticHints:
      'Walk, go for a walk, wanna walk, outside, go out, let’s go out, leash, go potty, potty time, backyard, go for a stroll. Heading outdoors, not indoor play.',
  },
  {
    id: 'no',
    phrases: ['no', 'no no', 'stop that', 'uh uh'],
    clips: [
      clip('no', 1, 55, 'Ears back, pause'),
      clip('no', 2, 45, 'Guilty settle'),
      legacyClip('react_no.mp4', 10),
    ],
    priority: 6,
    description: 'No',
    semanticHints:
      'No, no no, stop that, uh uh, don’t, leave it, ah ah, knock it off, stop it. A correction or prohibition — not praise.',
  },
  {
    id: 'owner',
    phrases: ['{ownerName}', 'mark'],
    clips: [
      clip('owner', 1, 55, 'Recognition, lean in'),
      clip('owner', 2, 45, 'Soft owner gaze'),
      legacyClip('react_owner.mp4', 10),
    ],
    priority: 9,
    description: 'Owner name',
    semanticHints:
      'The owner says their own name, or the dog hears the person’s name. Mark, mom, dad. Recognition of the familiar person — not the dog’s name.',
  },
  {
    id: 'play',
    phrases: ['play', 'ball', 'fetch', 'want to play'],
    clips: [
      clip('play', 1, 55, 'Bouncy'),
      clip('play', 2, 45, 'Play bow energy'),
    ],
    priority: 5,
    description: 'Play (future)',
    semanticHints:
      'Play, ball, fetch, want to play, toy, tug, let’s play, get the ball, playtime. Invitation to play, not a walk or a treat.',
  },
  {
    id: 'quiet',
    phrases: ['quiet', 'shh', 'settle', 'calm down'],
    clips: [
      clip('quiet', 1, 55, 'Calm down'),
      clip('quiet', 2, 45, 'Settle / rest'),
    ],
    priority: 4,
    description: 'Quiet (future)',
    semanticHints:
      'Quiet, shh, shush, settle, calm down, easy, relax, lie down, settle down, that’s enough barking. Asking the dog to be still and calm.',
  },
  {
    id: 'hug',
    phrases: ['hug', 'hugs', 'want a hug', 'give me a hug', 'cuddle', 'snuggle'],
    clips: [
      clip('hug', 1, 55, 'Hug reaction'),
      clip('hug', 2, 45, 'Side-touch reaction'),
    ],
    priority: 8,
    description: 'Hug / cuddle',
    semanticHints:
      'Hug, hugs, want a hug, give me a hug, cuddle, snuggle, squeeze, come here for a hug. Asking for or giving a hug — distinct from come-here or praise.',
  },
  {
    id: 'howl',
    phrases: ['howl', 'sing', 'sing it', 'aroo', 'speak'],
    clips: [
      clip('howl', 1, 55, 'Howl / sing'),
      clip('howl', 2, 45, 'Howl attempt'),
    ],
    priority: 7,
    description: 'Howl / sing',
    semanticHints:
      'Howl, sing, sing it, aroo, awoo, speak, let me hear you, husky song. Asking the dog to howl or sing — not a walk or a name call.',
  },
]

export const IDLE_CLIP_PATHS = [
  'clips/idle/idle_01.mp4',
  'clips/idle/idle_02.mp4',
  'clips/idle.mp4',
]

const NAME_LIKE_BUCKETS = new Set<string>(['name', 'owner'])

export function isNameLikeBucket(id: string): boolean {
  return NAME_LIKE_BUCKETS.has(id)
}

export function clipPathsOf(bucket: ReactionBucket): string[] {
  return bucket.clips.map((c) => c.path)
}

export function normalizeClipWeights(
  clips: WeightedClip[],
): Array<WeightedClip & { percent: number }> {
  const total = clips.reduce((sum, c) => sum + Math.max(0, c.weight), 0)
  if (total <= 0) {
    const even = clips.length === 0 ? 0 : 100 / clips.length
    return clips.map((c) => ({ ...c, percent: even }))
  }
  return clips.map((c) => ({
    ...c,
    percent: (Math.max(0, c.weight) / total) * 100,
  }))
}

export type Rng = () => number

const lastPickByBucket = new Map<string, string>()

export interface PickClipOptions {
  excludeLast?: boolean
  rng?: Rng
  /** When set, use these clips instead of bucket.clips (localStorage overrides). */
  clips?: WeightedClip[]
}

function defaultRng(): number {
  return Math.random()
}

/**
 * Weighted random clip for a bucket. Weights are relative; they do not need
 * to sum to 100. Optional `excludeLast` skips the previous pick when others exist.
 */
export function pickWeightedClip(
  bucket: ReactionBucket | string,
  options: PickClipOptions = { excludeLast: true },
): string | undefined {
  const resolved =
    typeof bucket === 'string'
      ? REACTION_CATALOG.find((b) => b.id === bucket)
      : bucket
  if (!resolved) return undefined

  const source = options.clips ?? resolved.clips
  const viable = source.filter((c) => c.weight > 0 && c.path)
  if (viable.length === 0) return undefined

  const excludeLast = options.excludeLast !== false
  const last = lastPickByBucket.get(resolved.id)
  const pool =
    excludeLast && last && viable.length > 1
      ? viable.filter((c) => c.path !== last)
      : viable
  const use = pool.length > 0 ? pool : viable

  const rng = options.rng ?? defaultRng
  const total = use.reduce((sum, c) => sum + c.weight, 0)
  if (total <= 0) {
    const pick = use[Math.floor(rng() * use.length)]?.path
    if (pick) lastPickByBucket.set(resolved.id, pick)
    return pick
  }

  let cursor = rng() * total
  let pick = use[use.length - 1].path
  for (const clipOption of use) {
    cursor -= clipOption.weight
    if (cursor <= 0) {
      pick = clipOption.path
      break
    }
  }

  lastPickByBucket.set(resolved.id, pick)
  return pick
}

/** @deprecated Prefer pickWeightedClip — kept as an equal-weight alias. */
export function pickRandomClipForBucket(
  bucketId: string,
  options: { excludeLast?: boolean; rng?: Rng } = { excludeLast: true },
): string | undefined {
  return pickWeightedClip(bucketId, options)
}

export function resetClipPickHistory(): void {
  lastPickByBucket.clear()
}

export function bucketById(id: string): ReactionBucket | undefined {
  return REACTION_CATALOG.find((b) => b.id === id)
}

/** Sorted for priority matching (highest first). */
export function catalogSortedByPriority(): ReactionBucket[] {
  return [...REACTION_CATALOG].sort((a, b) => b.priority - a.priority)
}

export function pickIdleClipPath(options: PickClipOptions = {}): string {
  const rng = options.rng ?? defaultRng
  const last = lastPickByBucket.get('idle')
  const pool =
    options.excludeLast !== false && last && IDLE_CLIP_PATHS.length > 1
      ? IDLE_CLIP_PATHS.filter((p) => p !== last)
      : IDLE_CLIP_PATHS
  const use = pool.length > 0 ? pool : IDLE_CLIP_PATHS
  const pick = use[Math.floor(rng() * use.length)] ?? IDLE_CLIP_PATHS[0]
  lastPickByBucket.set('idle', pick)
  return pick
}
