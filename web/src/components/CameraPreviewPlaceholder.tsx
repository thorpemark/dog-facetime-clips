import { useEffect, useRef } from 'react'
import { useMemorialCall } from '../context/MemorialCallContext'
import { attachSelfViewVideo } from '../utils/selfViewCamera'

export function CameraPreviewPlaceholder() {
  const { selfViewStream, selfViewError } = useMemorialCall()
  const videoRef = useRef<HTMLVideoElement>(null)
  const live = Boolean(selfViewStream)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    attachSelfViewVideo(video, selfViewStream)
    return () => {
      attachSelfViewVideo(video, null)
    }
  }, [selfViewStream])

  return (
    <div
      className={`camera-preview${live ? ' camera-preview--live' : ''}`}
      aria-label={live ? 'You' : undefined}
      aria-hidden={!live && !selfViewError}
    >
      <video
        ref={videoRef}
        className="camera-preview-video"
        playsInline
        muted
        autoPlay
      />
      {!live && (
        <>
          <span className="camera-preview-icon" aria-hidden>
            👤
          </span>
          {selfViewError ? (
            <p className="camera-preview-message" role="status">
              {selfViewError}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
