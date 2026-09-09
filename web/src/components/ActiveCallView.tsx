import { useMemorialCall } from '../context/MemorialCallContext'
import { CallControlsView } from './CallControlsView'
import { CameraPreviewPlaceholder } from './CameraPreviewPlaceholder'
import { DebugPanelView } from './DebugPanelView'
import { DualMediaView } from './DualMediaView'
import { PhotoPlaybackControls } from './PhotoPlaybackControls'

function statusText(
  behaviorState: ReturnType<typeof useMemorialCall>['behaviorState'],
  isMuted: boolean,
): string {
  switch (behaviorState.type) {
    case 'idle':
      return 'Connected'
    case 'listen':
      return isMuted ? 'Muted' : 'Listening…'
    case 'react':
      return 'Responding…'
    case 'cooldown':
      return 'Connected'
  }
}

export function ActiveCallView() {
  const {
    profile,
    behaviorState,
    isMuted,
    showDebugPanel,
    mediaPlayback,
  } = useMemorialCall()
  const clipCall = mediaPlayback.mode === 'video'

  return (
    <div
      className={`screen active-call-screen${clipCall ? ' active-call-screen--portrait' : ''}`}
    >
      <div className={clipCall ? 'call-stage' : 'call-stage call-stage--full'}>
        <DualMediaView />
        <PhotoPlaybackControls />

        <div className="call-overlay">
          <header className="call-header">
            <h2>{profile.dogName}</h2>
            <div className="call-status">
              <span className="status-dot" />
              {statusText(behaviorState, isMuted)}
            </div>
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
