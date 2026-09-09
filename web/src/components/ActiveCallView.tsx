import { useMemorialCall } from '../context/MemorialCallContext'
import { callListenCue } from '../utils/callListenCue'
import { CallControlsView } from './CallControlsView'
import { CallReactionHud } from './CallReactionHud'
import { CameraPreviewPlaceholder } from './CameraPreviewPlaceholder'
import { DebugPanelView } from './DebugPanelView'
import { DualMediaView } from './DualMediaView'
import { PhotoPlaybackControls } from './PhotoPlaybackControls'

export function ActiveCallView() {
  const {
    profile,
    behaviorState,
    isMuted,
    isListening,
    speechSupported,
    speechError,
    showDebugPanel,
    reactionHud,
    mediaPlayback,
  } = useMemorialCall()
  const clipCall = mediaPlayback.mode === 'video'
  const cue = callListenCue({
    behavior: behaviorState.type,
    isMuted,
    speechActuallyListening: isListening,
    speechSupported,
    speechError,
  })
  const showReactionHud =
    (behaviorState.type === 'react' || behaviorState.type === 'cooldown') &&
    reactionHud != null
  // Specific heard/reacting lines replace the generic Busy / Getting ready copy.
  const showListenStatus = cue.kind === 'muted' || !showReactionHud

  return (
    <div
      className={`screen active-call-screen${clipCall ? ' active-call-screen--portrait' : ''}`}
    >
      <div
        className={`call-stage${clipCall ? '' : ' call-stage--full'}${
          cue.kind === 'listening' ? '' : ' call-stage--not-listening'
        }`}
      >
        <DualMediaView />
        <PhotoPlaybackControls />

        <div className="call-overlay">
          <header className="call-header">
            <h2>{profile.dogName}</h2>
            {showListenStatus && (
              <div
                className={`call-status call-status--${cue.kind}`}
                role="status"
                aria-live="polite"
              >
                <span className="status-dot" />
                <span className="call-status-icon" aria-hidden>
                  {cue.icon}
                </span>
                <span className="call-status-label">{cue.label}</span>
              </div>
            )}
            <CallReactionHud
              dogName={profile.dogName}
              behavior={behaviorState.type}
              pin={reactionHud}
            />
          </header>

          <div className="call-footer">
            <div className="pip-row">
              <CameraPreviewPlaceholder />
            </div>
            <CallControlsView />
            {showDebugPanel && <DebugPanelView />}
          </div>
        </div>
      </div>
    </div>
  )
}
