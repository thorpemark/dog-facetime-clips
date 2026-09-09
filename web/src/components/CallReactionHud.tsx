import { buildCallReactionHud, type ReactionHudPin } from '../utils/callReactionHud'
import type { BehaviorState } from '../types'

export function CallReactionHud({
  dogName,
  behavior,
  pin,
}: {
  dogName: string
  behavior: BehaviorState['type']
  pin: ReactionHudPin | null
}) {
  const hud = buildCallReactionHud({
    dogName,
    behavior,
    pin,
  })

  if (hud.phase !== 'reacting') return null

  return (
    <div
      className={`call-reaction-hud${
        behavior === 'cooldown' ? ' call-reaction-hud--fade' : ''
      }`}
      role="status"
      aria-live="polite"
    >
      {hud.heardLine && (
        <p className="call-reaction-hud-heard">{hud.heardLine}</p>
      )}
      {hud.reactingLine && (
        <p className="call-reaction-hud-reacting">{hud.reactingLine}</p>
      )}
    </div>
  )
}
