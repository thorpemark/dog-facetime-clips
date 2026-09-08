import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeywordRulesConfig } from '../types'
import type { MotionPreset } from '../types/memorial'
import { pickWeightedClip, REACTION_CATALOG } from '../data/reactionCatalog'
import { resolveIdlePlayback } from '../utils/callIdentity'
import { getEffectiveCatalog } from '../utils/catalogOverrides'
import { findDog, getStudioState } from '../utils/clipStudioStore'
import { clipUrl } from '../utils/keywordRules'
import { loadVideoWithFallback, uniqueUrls } from '../utils/videoSource'
import {
  DEFAULT_FOCAL_X,
  DEFAULT_FOCAL_Y,
  DEFAULT_FOCAL_ZOOM,
  type PhotoSource,
  focalFrameFromValues,
  hasStoredLandscapeFraming,
  photoSourceFromFraming,
  photoSourcesFromUrls,
} from '../utils/focalPoint'
import { MANUAL_NAV_PAUSE_MS } from '../utils/kenBurnsSpeed'
import {
  REACTION_CROSSFADE_MS,
  REACTION_DURATION_MS,
  photoIndexForReaction,
  presetForRule,
} from '../utils/reactionPresets'

/** Short, calm FaceTime handoff — long enough to hide a cut, not a dissolve. */
const CROSSFADE_MS = 320

interface UseMediaPlaybackOptions {
  crossfadeIntervalMs: number
  idleAnimationMs: number
  dogName?: string
  /** Incoming / idle still is available — never cover it with placeholder idle. */
  hasIdentityStill?: boolean
}

function emptyPhotoSource(): PhotoSource {
  const portrait = {
    focalX: DEFAULT_FOCAL_X,
    focalY: DEFAULT_FOCAL_Y,
    focalZoom: DEFAULT_FOCAL_ZOOM,
  }
  const landscape = {
    focalX: DEFAULT_FOCAL_X,
    focalY: DEFAULT_FOCAL_Y,
    focalZoom: DEFAULT_FOCAL_ZOOM,
  }
  return photoSourceFromFraming(
    '',
    { portrait, landscape },
    false,
  )
}

export function useMediaPlayback(
  photos: PhotoSource[],
  rulesConfig: KeywordRulesConfig | null,
  options: UseMediaPlaybackOptions = {
    crossfadeIntervalMs: 5_000,
    idleAnimationMs: 12_000,
  },
) {
  const { crossfadeIntervalMs, idleAnimationMs, dogName, hasIdentityStill } = options
  const usePhotos = photos.length > 0

  const primaryRef = useRef<HTMLVideoElement>(null)
  const secondaryRef = useRef<HTMLVideoElement>(null)

  const [primaryOpacity, setPrimaryOpacity] = useState(hasIdentityStill ? 0 : 1)
  const [secondaryOpacity, setSecondaryOpacity] = useState(0)
  const [currentClipId, setCurrentClipId] = useState('idle')
  const [photoIndex, setPhotoIndex] = useState(0)
  const [activePhotoSlot, setActivePhotoSlot] = useState<'primary' | 'secondary'>(
    'primary',
  )
  const [primaryPhoto, setPrimaryPhoto] = useState<PhotoSource>(
    photos[0] ?? emptyPhotoSource(),
  )
  const [secondaryPhoto, setSecondaryPhoto] = useState<PhotoSource | null>(null)
  const [primaryMotion, setPrimaryMotion] = useState<MotionPreset>('idle')
  const [secondaryMotion, setSecondaryMotion] = useState<MotionPreset>('idle')
  const [primaryMotionKey, setPrimaryMotionKey] = useState(0)
  const [secondaryMotionKey, setSecondaryMotionKey] = useState(0)
  const [isReactionPlaying, setIsReactionPlaying] = useState(false)
  const [idleVisual, setIdleVisual] = useState<'video' | 'still'>(
    hasIdentityStill ? 'still' : 'video',
  )

  const activeSlotRef = useRef<'primary' | 'secondary'>('primary')
  const photoIndexRef = useRef(0)
  const activePhotoSlotRef = useRef<'primary' | 'secondary'>('primary')
  const isPlayingReactionRef = useRef(false)
  const onCompleteRef = useRef<(() => void) | null>(null)
  const idleTimerRef = useRef<number | null>(null)
  const reactionTimerRef = useRef<number | null>(null)
  const outgoingClearTimerRef = useRef<number | null>(null)
  const cancelLoadRef = useRef<(() => void) | null>(null)
  const photosRef = useRef(photos)
  const crossfadeIntervalRef = useRef(crossfadeIntervalMs)
  const prevCrossfadeIntervalRef = useRef(crossfadeIntervalMs)

  photosRef.current = photos
  crossfadeIntervalRef.current = crossfadeIntervalMs
  photoIndexRef.current = photoIndex
  activePhotoSlotRef.current = activePhotoSlot

  const crossfadeTo = useCallback((slot: 'primary' | 'secondary') => {
    if (slot === 'primary') {
      setPrimaryOpacity(1)
      setSecondaryOpacity(0)
    } else {
      setPrimaryOpacity(0)
      setSecondaryOpacity(1)
    }
    activeSlotRef.current = slot
  }, [])

  const crossfadePhotosTo = useCallback((slot: 'primary' | 'secondary') => {
    setActivePhotoSlot(slot)
    activePhotoSlotRef.current = slot
    if (slot === 'primary') {
      setPrimaryOpacity(1)
      setSecondaryOpacity(0)
    } else {
      setPrimaryOpacity(0)
      setSecondaryOpacity(1)
    }
  }, [])

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
    if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current)
    if (outgoingClearTimerRef.current) window.clearTimeout(outgoingClearTimerRef.current)
    idleTimerRef.current = null
    reactionTimerRef.current = null
    outgoingClearTimerRef.current = null
    cancelLoadRef.current?.()
    cancelLoadRef.current = null
  }, [])

  const bumpMotionKey = useCallback((slot: 'primary' | 'secondary') => {
    if (slot === 'primary') {
      setPrimaryMotionKey((key) => key + 1)
    } else {
      setSecondaryMotionKey((key) => key + 1)
    }
  }, [])

  const showPhotoAtIndex = useCallback(
    (
      nextIndex: number,
      motion: MotionPreset = 'idle',
      options?: { restartMotion?: boolean },
    ) => {
      const items = photosRef.current
      if (items.length === 0) return

      const normalized =
        ((nextIndex % items.length) + items.length) % items.length
      const incoming =
        activePhotoSlotRef.current === 'primary' ? 'secondary' : 'primary'
      const nextPhoto = items[normalized]

      if (incoming === 'secondary') {
        setSecondaryPhoto(nextPhoto)
        setSecondaryMotion(motion)
        if (options?.restartMotion) bumpMotionKey('secondary')
        crossfadePhotosTo('secondary')
      } else {
        setPrimaryPhoto(nextPhoto)
        setPrimaryMotion(motion)
        if (options?.restartMotion) bumpMotionKey('primary')
        crossfadePhotosTo('primary')
      }

      photoIndexRef.current = normalized
      setPhotoIndex(normalized)
    },
    [bumpMotionKey, crossfadePhotosTo],
  )

  const scheduleIdleCycle = useCallback(
    (delayMs = crossfadeIntervalRef.current) => {
      const items = photosRef.current
      if (!usePhotos || items.length <= 1 || isPlayingReactionRef.current) return
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)

      idleTimerRef.current = window.setTimeout(() => {
        if (isPlayingReactionRef.current) return
        const nextIndex = (photoIndexRef.current + 1) % items.length
        showPhotoAtIndex(nextIndex, 'idle', { restartMotion: true })
        scheduleIdleCycleRef.current()
      }, delayMs)
    },
    [showPhotoAtIndex, usePhotos],
  )

  const scheduleIdleCycleRef = useRef(scheduleIdleCycle)
  scheduleIdleCycleRef.current = scheduleIdleCycle

  const goToPhoto = useCallback(
    (nextIndex: number) => {
      if (!usePhotos || photosRef.current.length === 0) return
      if (isPlayingReactionRef.current) return

      clearTimers()
      showPhotoAtIndex(nextIndex, 'idle', { restartMotion: true })
      if (photosRef.current.length > 1) {
        scheduleIdleCycle(MANUAL_NAV_PAUSE_MS)
      }
    },
    [clearTimers, scheduleIdleCycle, showPhotoAtIndex, usePhotos],
  )

  const goToNextPhoto = useCallback(() => {
    goToPhoto(photoIndexRef.current + 1)
  }, [goToPhoto])

  const goToPrevPhoto = useCallback(() => {
    goToPhoto(photoIndexRef.current - 1)
  }, [goToPhoto])

  const idlePlan = useCallback(() => {
    const dog = findDog(getStudioState(), dogName)
    return resolveIdlePlayback(dogName, dog, Boolean(hasIdentityStill))
  }, [dogName, hasIdentityStill])

  const idleUrls = useCallback(() => {
    const plan = idlePlan()
    if (plan.kind === 'user-video') {
      return uniqueUrls(plan.urls.map((path) => clipUrl(path)))
    }
    if (plan.kind === 'still') return []
    return uniqueUrls([
      rulesConfig?.idleClip ? clipUrl(rulesConfig.idleClip) : undefined,
      ...plan.urls.map((path) => clipUrl(path)),
    ])
  }, [idlePlan, rulesConfig])

  const clearVideoElement = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return
    video.pause()
    video.removeAttribute('src')
    video.load()
  }, [])

  const scheduleClearOutgoing = useCallback(
    (outgoing: HTMLVideoElement | null, incomingSlot: 'primary' | 'secondary') => {
      if (outgoingClearTimerRef.current) {
        window.clearTimeout(outgoingClearTimerRef.current)
      }
      outgoingClearTimerRef.current = window.setTimeout(() => {
        outgoingClearTimerRef.current = null
        if (activeSlotRef.current === incomingSlot) {
          clearVideoElement(outgoing)
        }
      }, CROSSFADE_MS + 40)
    },
    [clearVideoElement],
  )

  const fadeVideosToStill = useCallback(() => {
    setPrimaryOpacity(0)
    setSecondaryOpacity(0)
    setIdleVisual('still')
    if (outgoingClearTimerRef.current) {
      window.clearTimeout(outgoingClearTimerRef.current)
    }
    outgoingClearTimerRef.current = window.setTimeout(() => {
      outgoingClearTimerRef.current = null
      if (!isPlayingReactionRef.current) {
        clearVideoElement(primaryRef.current)
        clearVideoElement(secondaryRef.current)
      }
    }, CROSSFADE_MS + 40)
  }, [clearVideoElement])

  const videoMatchesIdle = useCallback(
    (video: HTMLVideoElement | null, urls: string[]) => {
      if (!video || urls.length === 0) return false
      const src = video.currentSrc || video.src
      return Boolean(src && urls.some((url) => src === url || src.endsWith(url)))
    },
    [],
  )

  const playIdleOnSlot = useCallback(
    (
      slot: 'primary' | 'secondary',
      urls: string[],
      onSettled?: () => void,
    ) => {
      const idleVideo = slot === 'primary' ? primaryRef.current : secondaryRef.current
      if (!idleVideo) {
        fadeVideosToStill()
        onSettled?.()
        return
      }

      cancelLoadRef.current?.()
      cancelLoadRef.current = loadVideoWithFallback(idleVideo, urls, {
        loop: true,
        onReady: () => {
          cancelLoadRef.current = null
          setIdleVisual('video')
          void idleVideo.play()
          crossfadeTo(slot)
          const outgoing =
            slot === 'primary' ? secondaryRef.current : primaryRef.current
          scheduleClearOutgoing(outgoing, slot)
          onSettled?.()
        },
        onFail: () => {
          cancelLoadRef.current = null
          fadeVideosToStill()
          onSettled?.()
        },
      })
    },
    [crossfadeTo, fadeVideosToStill, scheduleClearOutgoing],
  )

  const finishReactionToIdle = useCallback(
    (onComplete?: () => void) => {
      const done = () => {
        setCurrentClipId('idle')
        isPlayingReactionRef.current = false
        setIsReactionPlaying(false)
        onComplete?.()
        onCompleteRef.current = null
      }

      const urls = idleUrls()
      if (urls.length === 0) {
        fadeVideosToStill()
        done()
        return
      }

      const idleSlot =
        activeSlotRef.current === 'primary' ? 'secondary' : 'primary'
      playIdleOnSlot(idleSlot, urls, done)
    },
    [fadeVideosToStill, idleUrls, playIdleOnSlot],
  )

  const loadIdle = useCallback(() => {
    clearTimers()
    isPlayingReactionRef.current = false
    setIsReactionPlaying(false)
    setCurrentClipId('idle')

    if (usePhotos) {
      photoIndexRef.current = 0
      activePhotoSlotRef.current = 'primary'
      setPhotoIndex(0)
      setPrimaryPhoto(photos[0] ?? emptyPhotoSource())
      setSecondaryPhoto(null)
      setPrimaryMotion('idle')
      setSecondaryMotion('idle')
      setPrimaryMotionKey(0)
      setSecondaryMotionKey(0)
      setActivePhotoSlot('primary')
      setPrimaryOpacity(1)
      setSecondaryOpacity(0)
      setIdleVisual('still')
      scheduleIdleCycle()
      return
    }

    const urls = idleUrls()
    if (urls.length === 0) {
      fadeVideosToStill()
      return
    }

    const active =
      activeSlotRef.current === 'primary' ? primaryRef.current : secondaryRef.current
    if (videoMatchesIdle(active, urls) && !active?.paused) {
      setIdleVisual('video')
      return
    }

    const incomingSlot =
      videoMatchesIdle(active, urls)
        ? activeSlotRef.current
        : activeSlotRef.current === 'primary'
          ? 'secondary'
          : 'primary'
    // First accept: both layers are empty — load on primary and fade up over the still.
    const usePrimary =
      !primaryRef.current?.src && !secondaryRef.current?.src
        ? 'primary'
        : incomingSlot
    playIdleOnSlot(usePrimary, urls)
  }, [
    clearTimers,
    fadeVideosToStill,
    idleUrls,
    photos,
    playIdleOnSlot,
    scheduleIdleCycle,
    usePhotos,
    videoMatchesIdle,
  ])

  const playPhotoReaction = useCallback(
    (clipId: string, onComplete: () => void) => {
      if (isPlayingReactionRef.current || photosRef.current.length === 0) return

      clearTimers()
      isPlayingReactionRef.current = true
      setIsReactionPlaying(true)
      onCompleteRef.current = onComplete
      setCurrentClipId(clipId)

      const preset = presetForRule(clipId)
      const nextIndex = photoIndexForReaction(
        photoIndexRef.current,
        clipId,
        photosRef.current.length,
      )
      const returnIndex = photoIndexRef.current

      showPhotoAtIndex(nextIndex, preset, { restartMotion: true })

      reactionTimerRef.current = window.setTimeout(() => {
        showPhotoAtIndex(returnIndex, 'idle', { restartMotion: true })
        setCurrentClipId('idle')
        isPlayingReactionRef.current = false
        setIsReactionPlaying(false)
        onCompleteRef.current?.()
        onCompleteRef.current = null
        scheduleIdleCycle()
      }, REACTION_DURATION_MS)
    },
    [clearTimers, scheduleIdleCycle, showPhotoAtIndex],
  )

  const playVideoReaction = useCallback(
    (clipId: string, onComplete: () => void) => {
      if (isPlayingReactionRef.current) return
      const catalog = getEffectiveCatalog(undefined, dogName)
      const bucket =
        catalog.find((item) => item.id === clipId) ??
        REACTION_CATALOG.find((item) => item.id === clipId)
      const picked = bucket
        ? pickWeightedClip(bucket, { excludeLast: true, clips: bucket.clips })
        : undefined
      const fallbackFile = rulesConfig?.rules.find((r) => r.id === clipId)?.clipFileName
      const urls = uniqueUrls([
        picked ? clipUrl(picked) : undefined,
        fallbackFile ? clipUrl(fallbackFile) : undefined,
        ...(bucket?.clips.map((c) => clipUrl(c.path)) ?? []),
      ])
      if (urls.length === 0) {
        onComplete()
        return
      }

      const incomingSlot =
        activeSlotRef.current === 'primary' ? 'secondary' : 'primary'
      const incomingVideo =
        incomingSlot === 'primary' ? primaryRef.current : secondaryRef.current
      if (!incomingVideo) return

      clearTimers()
      isPlayingReactionRef.current = true
      setIsReactionPlaying(true)
      setIdleVisual('video')
      onCompleteRef.current = onComplete
      setCurrentClipId(clipId)

      const onEnded = () => {
        incomingVideo.removeEventListener('ended', onEnded)
        finishReactionToIdle(onCompleteRef.current ?? onComplete)
      }

      cancelLoadRef.current?.()
      cancelLoadRef.current = loadVideoWithFallback(incomingVideo, urls, {
        loop: false,
        onReady: () => {
          cancelLoadRef.current = null
          void incomingVideo.play()
          crossfadeTo(incomingSlot)
          incomingVideo.addEventListener('ended', onEnded)
        },
        onFail: () => {
          cancelLoadRef.current = null
          finishReactionToIdle(onCompleteRef.current ?? onComplete)
        },
      })
    },
    [clearTimers, crossfadeTo, dogName, finishReactionToIdle, rulesConfig],
  )

  const playReaction = useCallback(
    (clipId: string, onComplete: () => void) => {
      // Dual mode: photos = Ken Burns stills (dog-facetime); video = clip library (this fork).
      // TODO: honor memorial playbackMode ('photos' | 'clips' | 'both') once schema lands.
      if (usePhotos) {
        playPhotoReaction(clipId, onComplete)
      } else {
        playVideoReaction(clipId, onComplete)
      }
    },
    [playPhotoReaction, playVideoReaction, usePhotos],
  )

  const stop = useCallback(() => {
    clearTimers()
    primaryRef.current?.pause()
    secondaryRef.current?.pause()
    isPlayingReactionRef.current = false
    setIsReactionPlaying(false)
    onCompleteRef.current = null
  }, [clearTimers])

  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  useEffect(() => {
    if (usePhotos && photos.length > 0) {
      setPrimaryPhoto(photos[0])
      photoIndexRef.current = 0
      setPhotoIndex(0)
    }
  }, [photos, usePhotos])

  useEffect(() => {
    if (prevCrossfadeIntervalRef.current === crossfadeIntervalMs) return
    prevCrossfadeIntervalRef.current = crossfadeIntervalMs

    if (!usePhotos || photos.length <= 1 || isPlayingReactionRef.current) return
    if (!idleTimerRef.current) return

    scheduleIdleCycle()
  }, [crossfadeIntervalMs, photos.length, scheduleIdleCycle, usePhotos])

  return {
    mode: usePhotos ? ('photos' as const) : ('video' as const),
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
    currentClipId,
    idleVisual,
    photoIndex,
    photoCount: photos.length,
    canNavigatePhotos: usePhotos && photos.length > 1 && !isReactionPlaying,
    isReactionPlaying,
    idleAnimationMs,
    crossfadeMs: usePhotos ? REACTION_CROSSFADE_MS : CROSSFADE_MS,
    loadIdle,
    playReaction,
    stop,
    goToNextPhoto,
    goToPrevPhoto,
  }
}

/** Build photo sources from legacy url + optional focal arrays. */
export function buildPhotoSources(
  photoUrls: string[],
  photoFocalPoints?: Array<{
    focalX: number
    focalY: number
    focalZoom?: number
    cropWidth?: number
    cropHeight?: number
    focalRotationDeg?: number
    landscapeFocalX?: number
    landscapeFocalY?: number
    landscapeFocalZoom?: number
    landscapeCropWidth?: number
    landscapeCropHeight?: number
    landscapeFocalRotationDeg?: number
  }>,
): PhotoSource[] {
  if (!photoFocalPoints || photoFocalPoints.length === 0) {
    return photoSourcesFromUrls(photoUrls)
  }

  return photoUrls.map((url, index) => {
    const points = photoFocalPoints[index]
    const portrait = focalFrameFromValues(
      points?.focalX,
      points?.focalY,
      points?.focalZoom,
      points?.cropWidth,
      points?.cropHeight,
      points?.focalRotationDeg,
    )
    const landscapeStored = hasStoredLandscapeFraming(
      points?.landscapeFocalX,
      points?.landscapeFocalY,
      points?.landscapeFocalZoom,
      points?.landscapeCropWidth,
      points?.landscapeCropHeight,
      points?.landscapeFocalRotationDeg,
    )
    const landscape = landscapeStored
      ? focalFrameFromValues(
          points?.landscapeFocalX,
          points?.landscapeFocalY,
          points?.landscapeFocalZoom,
          points?.landscapeCropWidth,
          points?.landscapeCropHeight,
          points?.landscapeFocalRotationDeg,
        )
      : portrait

    return photoSourceFromFraming(
      url,
      { portrait, landscape },
      landscapeStored,
    )
  })
}
