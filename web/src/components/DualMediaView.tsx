import type { CSSProperties } from 'react'
import { useMemorialCall } from '../context/MemorialCallContext'
import { useDisplayOrientation } from '../hooks/useDisplayOrientation'
import { identityStillForDog } from '../utils/callIdentity'
import { findDog, getStudioState } from '../utils/clipStudioStore'
import { focalForOrientation, photoSourceFromFraming } from '../utils/focalPoint'
import { FocalPhotoLayer } from './FocalPhotoLayer'

function photoLayerWrapperStyle(
  opacity: number,
  transition: string,
): CSSProperties {
  return { opacity, transition }
}

export function DualMediaView() {
  const { mediaPlayback, profile } = useMemorialCall()
  const displayOrientation = useDisplayOrientation()
  const identityStill =
    identityStillForDog(profile.dogName, findDog(getStudioState(), profile.dogName))
  const idleStillUrl = identityStill?.url ?? profile.avatarUrl
  const {
    mode,
    primaryRef,
    secondaryRef,
    primaryOpacity,
    secondaryOpacity,
    primaryPhoto,
    secondaryPhoto,
    primaryMotion,
    secondaryMotion,
    primaryMotionKey,
    secondaryMotionKey,
    idleVisual,
    idleAnimationMs,
    crossfadeMs,
  } = mediaPlayback

  const transition = `opacity ${crossfadeMs}ms ease-in-out`
  const kenBurnsStyle = {
    '--ken-burns-idle-duration': `${idleAnimationMs}ms`,
  } as CSSProperties

  if (mode === 'photos') {
    const primaryFocal = focalForOrientation(primaryPhoto, displayOrientation)
    const secondaryFocal = secondaryPhoto
      ? focalForOrientation(secondaryPhoto, displayOrientation)
      : null

    return (
      <div className="dual-video dual-media" style={kenBurnsStyle}>
        <div
          key={`primary-${primaryPhoto.url}-${displayOrientation}-${primaryMotionKey}`}
          className="photo-layer"
          style={photoLayerWrapperStyle(primaryOpacity, transition)}
        >
          <FocalPhotoLayer
            imageUrl={primaryPhoto.url}
            focal={primaryFocal}
            displayOrientation={displayOrientation}
            motionClassName={`photo-layer-media motion-${primaryMotion}`}
          />
        </div>
        {secondaryPhoto?.url && secondaryFocal && (
          <div
            key={`secondary-${secondaryPhoto.url}-${displayOrientation}-${secondaryMotionKey}`}
            className="photo-layer"
            style={photoLayerWrapperStyle(secondaryOpacity, transition)}
          >
            <FocalPhotoLayer
              imageUrl={secondaryPhoto.url}
              focal={secondaryFocal}
              displayOrientation={displayOrientation}
              motionClassName={`photo-layer-media motion-${secondaryMotion}`}
            />
          </div>
        )}
      </div>
    )
  }

  const idlePhoto = identityStill
    ? photoSourceFromFraming(identityStill.url, identityStill.framing, true)
    : null
  const idleFocal = idlePhoto
    ? focalForOrientation(idlePhoto, displayOrientation)
    : null

  return (
    <div
      className={`dual-video${idleVisual === 'still' ? ' dual-video--still-idle' : ''}`}
      style={kenBurnsStyle}
    >
      {idleStillUrl && (
        <div className="call-idle-still-layer photo-layer" aria-hidden>
          {idleFocal && idlePhoto ? (
            <FocalPhotoLayer
              imageUrl={idleStillUrl}
              focal={idleFocal}
              imageAspect={identityStill?.imageAspect}
              displayOrientation={displayOrientation}
              className="photo-layer"
              motionClassName="photo-layer-media motion-idle"
            />
          ) : (
            <img
              className={`call-idle-still${profile.dogName.toLowerCase() === 'both' ? ' call-idle-still--wide' : ''}`}
              src={idleStillUrl}
              alt=""
            />
          )}
        </div>
      )}
      <video
        ref={primaryRef}
        className="video-layer"
        playsInline
        muted
        style={{ opacity: primaryOpacity, transition }}
      />
      <video
        ref={secondaryRef}
        className="video-layer"
        playsInline
        muted
        style={{ opacity: secondaryOpacity, transition }}
      />
    </div>
  )
}
