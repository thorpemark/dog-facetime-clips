/**
 * Holiday costume-walk intents (Halloween through Labor Day).
 * Suggest uses a 10s+ locked-camera walk, not the usual 6s react-idle arc.
 */

export interface HolidayIntentSpec {
  id: string
  description: string
  phrases: string[]
  semanticHints: string
  /** Phrase after “wearing …” in the costume-walk prompt. */
  costume: string
  clipLabels: [string, string]
  priority: number
  /** Extra id / description tokens that identify this holiday. */
  matchers: string[]
}

export const HOLIDAY_INTENTS: HolidayIntentSpec[] = [
  {
    id: 'halloween',
    description: 'Halloween',
    phrases: [
      'happy halloween',
      'halloween',
      'trick or treat',
      'trick-or-treat',
    ],
    semanticHints:
      'Happy Halloween, Halloween, trick or treat, spooky, costume night, jack-o-lantern. Holiday greeting — not a walk or a name call.',
    costume:
      'a Halloween dog costume that fits this dog (classic pet Halloween look — witch hat and cape, pumpkin, or skeleton — keep the same dog identity)',
    clipLabels: ['Costume walk', 'Costume walk, look at camera'],
    priority: 8,
    matchers: ['halloween', 'trick or treat', 'trick-or-treat'],
  },
  {
    id: 'thanksgiving',
    description: 'Thanksgiving',
    phrases: ['happy thanksgiving', 'thanksgiving', 'happy turkey day', 'turkey day'],
    semanticHints:
      'Happy Thanksgiving, Thanksgiving, turkey day, thankful, holiday dinner greeting. Not a treat or a walk.',
    costume: 'a Thanksgiving Pilgrim dog costume with hat and dog-jacket',
    clipLabels: ['Costume walk', 'Costume walk, look at camera'],
    priority: 8,
    matchers: ['thanksgiving', 'turkey day'],
  },
  {
    id: 'christmas',
    description: 'Christmas',
    phrases: ['merry christmas', 'christmas', 'happy christmas', 'christmas day'],
    semanticHints:
      'Merry Christmas, Christmas, happy Christmas, Christmas day, holiday greeting. Not a treat or a name call.',
    costume: 'a Christmas dog costume with a Santa hat and festive holiday sweater/jacket',
    clipLabels: ['Costume walk', 'Costume walk, look at camera'],
    priority: 8,
    matchers: ['christmas', 'merry christmas', 'santa'],
  },
  {
    id: 'new-years',
    description: "New Year's",
    phrases: [
      'happy new year',
      'happy new years',
      "new year's",
      'new years',
      'new years eve',
      "new year's eve",
      'new years day',
    ],
    semanticHints:
      "Happy New Year, New Year's Eve, New Year's Day, midnight, countdown greeting. Not a birthday.",
    costume: "a New Year's Eve party dog costume with a festive hat and sparkly collar/jacket",
    clipLabels: ['Costume walk', 'Costume walk, look at camera'],
    priority: 8,
    matchers: ['new year', 'new-years', 'new-year'],
  },
  {
    id: 'valentines-day',
    description: "Valentine's Day",
    phrases: [
      "happy valentine's day",
      'happy valentines day',
      "valentine's day",
      'valentines day',
      'happy valentine',
    ],
    semanticHints:
      "Happy Valentine's Day, Valentine, be mine, hearts, Cupid. Holiday greeting — not a hug request.",
    costume: "a Valentine's Day dog costume with Cupid wings and a heart-themed collar/jacket",
    clipLabels: ['Costume walk', 'Costume walk, look at camera'],
    priority: 8,
    matchers: ['valentine', 'valentines'],
  },
  {
    id: 'super-bowl-sunday',
    description: 'Super Bowl Sunday',
    phrases: [
      'super bowl',
      'super bowl sunday',
      'happy super bowl',
      'go birds',
      'football sunday',
    ],
    semanticHints:
      'Super Bowl, Super Bowl Sunday, game day, football sunday, go birds. Sports-holiday greeting — not a walk.',
    costume:
      'a Super Bowl Sunday game-day dog costume — a team jersey or sports sweater (Eagles green is fine)',
    clipLabels: ['Costume walk', 'Costume walk, look at camera'],
    priority: 8,
    matchers: ['super bowl', 'super-bowl', 'superbowl', 'go birds'],
  },
  {
    id: 'st-patricks-day',
    description: "St. Patrick's Day",
    phrases: [
      "happy st patrick's day",
      'happy st patricks day',
      "st patrick's day",
      'st patricks day',
      'happy st paddys day',
    ],
    semanticHints:
      "Happy St. Patrick's Day, St Paddy's, shamrock, wear green. Holiday greeting — not a walk.",
    costume: "a St. Patrick's Day dog costume with a green hat and shamrock jacket",
    clipLabels: ['Costume walk', 'Costume walk, look at camera'],
    priority: 8,
    matchers: ['st patrick', 'st-patrick', 'st padd', 'shamrock'],
  },
  {
    id: 'birthday',
    description: "Birthday (dog's birthday)",
    phrases: [
      'happy birthday',
      'happy birthday {dogName}',
      "it's your birthday",
      'birthday',
    ],
    semanticHints:
      "Happy birthday, it's your birthday, birthday dog, birthday party. The dog's birthday greeting — not praise and not New Year's.",
    costume: 'a birthday-party dog costume with a party hat and festive birthday bandana/jacket',
    clipLabels: ['Costume walk', 'Costume walk, look at camera'],
    priority: 8,
    matchers: ['birthday'],
  },
  {
    id: 'memorial-day',
    description: 'Memorial Day',
    phrases: ['happy memorial day', 'memorial day', 'memorial day weekend'],
    semanticHints:
      'Happy Memorial Day, Memorial Day weekend, remember and honor. Patriotic holiday greeting — not the 4th of July.',
    costume: 'a respectful Memorial Day patriotic dog costume — an American flag bandana or jacket',
    clipLabels: ['Costume walk', 'Costume walk, look at camera'],
    priority: 7,
    matchers: ['memorial day', 'memorial-day'],
  },
  {
    id: 'fourth-of-july',
    description: '4th of July',
    phrases: [
      'happy 4th of july',
      'happy fourth of july',
      '4th of july',
      'fourth of july',
      'july 4th',
      'independence day',
    ],
    semanticHints:
      'Happy 4th of July, Fourth of July, July 4th, Independence Day. Patriotic holiday greeting — not Memorial Day or Labor Day.',
    costume: 'a 4th of July patriotic dog costume — stars-and-stripes bandana or jacket',
    clipLabels: ['Costume walk', 'Costume walk, look at camera'],
    priority: 8,
    matchers: ['fourth of july', '4th of july', 'july 4', 'independence day', 'fourth-of-july'],
  },
  {
    id: 'labor-day',
    description: 'Labor Day',
    phrases: ['happy labor day', 'labor day', 'labour day', 'labor day weekend'],
    semanticHints:
      'Happy Labor Day, Labor Day weekend, end of summer holiday. Not Memorial Day or the 4th of July.',
    costume: 'a Labor Day weekend dog costume — a casual end-of-summer holiday bandana or jacket',
    clipLabels: ['Costume walk', 'Costume walk, look at camera'],
    priority: 7,
    matchers: ['labor day', 'labour day', 'labor-day', 'labour-day'],
  },
]

export const HOLIDAY_INTENT_IDS = HOLIDAY_INTENTS.map((item) => item.id)

const HOLIDAY_ID_ALIASES: Record<string, string> = {
  'new-year': 'new-years',
  'new-year-s': 'new-years',
  'new-years-eve': 'new-years',
  'new-years-day': 'new-years',
  valentines: 'valentines-day',
  valentine: 'valentines-day',
  'valentine-s-day': 'valentines-day',
  'super-bowl': 'super-bowl-sunday',
  superbowl: 'super-bowl-sunday',
  'st-patrick': 'st-patricks-day',
  'st-patricks': 'st-patricks-day',
  'st-patrick-s-day': 'st-patricks-day',
  'st-paddys-day': 'st-patricks-day',
  '4th-of-july': 'fourth-of-july',
  'july-4th': 'fourth-of-july',
  'july-4': 'fourth-of-july',
  'independence-day': 'fourth-of-july',
  'labour-day': 'labor-day',
}

function normalizeHolidayNeedle(value: string): string {
  return value.trim().toLowerCase()
}

export function holidaySpecById(id: string): HolidayIntentSpec | undefined {
  const needle = normalizeHolidayNeedle(id)
  if (!needle) return undefined
  const aliased = HOLIDAY_ID_ALIASES[needle] ?? needle
  return (
    HOLIDAY_INTENTS.find((item) => item.id === aliased) ??
    HOLIDAY_INTENTS.find(
      (item) => needle === item.id || needle.startsWith(`${item.id}-`) || needle.startsWith(`${item.id}_`),
    )
  )
}

/** True when this Studio intent is already covering a seed holiday (do not add a duplicate). */
export function dogHasHolidayIntent(
  intents: Array<{ id: string; description?: string }>,
  holidayId: string,
): boolean {
  const spec = holidaySpecById(holidayId)
  if (!spec) return false
  return intents.some((intent) => {
    const id = normalizeHolidayNeedle(intent.id)
    if (id === spec.id || id.startsWith(`${spec.id}-`) || id.startsWith(`${spec.id}_`)) {
      return true
    }
    if (holidaySpecById(id)?.id === spec.id) return true
    const hay = `${id} ${intent.description ?? ''}`.toLowerCase()
    return spec.matchers.some((matcher) => hay.includes(matcher))
  })
}

export function holidaySpecFor(
  intentId: string,
  intentDescription = '',
): HolidayIntentSpec | undefined {
  const byId = holidaySpecById(intentId)
  if (byId) return byId
  const hay = `${intentId} ${intentDescription}`.toLowerCase()
  if (!hay.trim()) return undefined
  return HOLIDAY_INTENTS.find((item) => item.matchers.some((matcher) => hay.includes(matcher)))
}

export function isHolidayLikeIntent(intentId: string, intentDescription = ''): boolean {
  return Boolean(holidaySpecFor(intentId, intentDescription))
}
