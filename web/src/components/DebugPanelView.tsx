import { useMemorialCall } from '../context/MemorialCallContext'
import { resolvePhrases } from '../utils/keywordRules'

export function DebugPanelView() {
  const {
    profile,
    behaviorState,
    lastTranscript,
    lastMatch,
    isListening,
    speechSupported,
    speechError,
    rulesConfig,
    triggerReaction,
    triggerPhrase,
    setShowDebugPanel,
  } = useMemorialCall()

  const stateLabel =
    behaviorState.type === 'react'
      ? `react(${behaviorState.clipId})`
      : behaviorState.type

  return (
    <div className="debug-panel">
      <div className="debug-header">
        <h3>Debug Panel</h3>
        <button
          type="button"
          className="debug-close"
          onClick={() => setShowDebugPanel(false)}
          aria-label="Close debug panel"
        >
          ✕
        </button>
      </div>

      <p className="debug-meta">State: {stateLabel}</p>
      <p className="debug-meta">
        Mic: {isListening ? 'listening' : 'not listening'}
        {speechSupported ? '' : ' (speech API unavailable)'}
      </p>
      {lastTranscript && (
        <p className="debug-meta">Heard: &ldquo;{lastTranscript}&rdquo;</p>
      )}
      {lastMatch && (
        <p className="debug-meta">
          Match: {lastMatch.bucketId} ({lastMatch.method}, {lastMatch.score.toFixed(2)}
          {lastMatch.matchedPhrase ? `, “${lastMatch.matchedPhrase}”` : ''})
        </p>
      )}
      {!speechSupported && (
        <p className="debug-warn">
          Web Speech API unavailable — use buttons or typed phrase below.
        </p>
      )}
      {speechError && <p className="debug-warn">{speechError}</p>}

      <div className="debug-phrase">
        <input
          type="text"
          placeholder='Type a phrase (e.g. "good boy")'
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              triggerPhrase(e.currentTarget.value)
              e.currentTarget.value = ''
            }
          }}
        />
        <button
          type="button"
          onClick={(e) => {
            const input = e.currentTarget.previousElementSibling as HTMLInputElement
            if (input?.value) {
              triggerPhrase(input.value)
              input.value = ''
            }
          }}
        >
          Send
        </button>
      </div>

      <p className="debug-section-title">Trigger Reactions</p>
      <div className="debug-grid">
        {rulesConfig?.rules.map((rule) => (
          <button
            key={rule.id}
            type="button"
            className="debug-trigger"
            onClick={() => triggerReaction(rule.id)}
            title={resolvePhrases(rule, profile.dogName, profile.ownerName).join(', ')}
          >
            {rule.description ?? rule.id}
          </button>
        ))}
      </div>
    </div>
  )
}
