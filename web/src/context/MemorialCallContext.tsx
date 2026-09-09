import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useKenBurnsSpeed } from '../hooks/useKenBurnsSpeed'
import { useKeywordSpotter } from '../hooks/useKeywordSpotter'
import { buildPhotoSources, useMediaPlayback } from '../hooks/useMediaPlayback'
import type { KenBurnsSpeed } from '../utils/kenBurnsSpeed'
import type {
  BehaviorState,
  CallPhase,
  DogProfile,
  KeywordRulesConfig,
} from '../types'
import { DEFAULT_PROFILE } from '../types'
import { getStudioBlob } from '../utils/clipStudioMedia'
import { rulesConfigFromCatalog } from '../utils/keywordRules'
import { hydrateStudioMedia, subscribeStudio } from '../utils/clipStudioStore'
import type { KeywordMatchDetail } from '../hooks/useKeywordSpotter'
import {
  intentHudLabel,
  type ReactionHudPin,
} from '../utils/callReactionHud'
import type { TranscriptMatch } from '../utils/matchTranscript'
import {
  applyCallVideoSound,
  releaseCallAudioUnlock,
  resetCallVideoSoundUnlock,
  SILENCE_WAV_DATA_URI,
  unlockCallVideoSound,
} from '../utils/callVideoSound'
import { stopMediaStream } from '../utils/micSession'
import {
  requestSelfViewStream,
  selfViewErrorMessage,
} from '../utils/selfViewCamera'

interface MemorialCallContextValue {
  profile: DogProfile
  callPhase: CallPhase
  behaviorState: BehaviorState
  isMuted: boolean
  showDebugPanel: boolean
  setShowDebugPanel: (show: boolean) => void
  rulesConfig: KeywordRulesConfig | null
  lastTranscript: string
  lastMatch: TranscriptMatch | null
  /** Transcript + intent that started the current (or last) reaction clip. */
  reactionHud: ReactionHudPin | null
  isListening: boolean
  videoSoundUnlocked: boolean
  speechSupported: boolean
  speechError: string | null
  selfViewStream: MediaStream | null
  selfViewError: string | null
  mediaPlayback: ReturnType<typeof useMediaPlayback>
  kenBurnsSpeed: KenBurnsSpeed
  setKenBurnsSpeed: (speed: KenBurnsSpeed) => void
  beginIncomingCall: () => void
  acceptCall: () => void
  endCall: () => void
  declineCall: () => void
  returnToIdleAfterEnd: () => void
  toggleMute: () => void
  triggerReaction: (clipId: string, transcript?: string) => void
  triggerPhrase: (phrase: string) => void
  unlockVideoSound: () => void
}

const MemorialCallContext = createContext<MemorialCallContextValue | null>(null)

interface MemorialCallProviderProps {
  children: ReactNode
  initialProfile?: DogProfile
}

export function MemorialCallProvider({
  children,
  initialProfile,
}: MemorialCallProviderProps) {
  const profile = initialProfile ?? DEFAULT_PROFILE
  const photoUrls = profile.photoUrls ?? []
  const photos = useMemo(
    () => buildPhotoSources(photoUrls, profile.photoFocalPoints),
    [photoUrls, profile.photoFocalPoints],
  )

  const [callPhase, setCallPhase] = useState<CallPhase>('home')
  const [behaviorState, setBehaviorState] = useState<BehaviorState>({
    type: 'idle',
  })
  const [isMuted, setIsMuted] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [reactionHud, setReactionHud] = useState<ReactionHudPin | null>(null)
  const [rulesConfig, setRulesConfig] = useState<KeywordRulesConfig | null>(
    () => rulesConfigFromCatalog(profile.dogName),
  )

  const cooldownRef = useRef<number | null>(null)
  const callPhaseRef = useRef(callPhase)
  const behaviorStateRef = useRef(behaviorState)
  const isMutedRef = useRef(isMuted)
  const rulesConfigRef = useRef(rulesConfig)

  callPhaseRef.current = callPhase
  behaviorStateRef.current = behaviorState
  isMutedRef.current = isMuted
  rulesConfigRef.current = rulesConfig

  const triggerReactionRef = useRef<
    (clipId: string, transcript?: string) => void
  >(() => {})
  const onKeywordMatch = useCallback(
    (ruleId: string, detail: KeywordMatchDetail) => {
      triggerReactionRef.current(ruleId, detail.transcript)
    },
    [],
  )

  const {
    lastTranscript,
    lastMatch,
    isListening,
    speechSupported,
    speechError,
    startListening: startSpotter,
    stopListening,
    setCanProcessMatches,
    triggerPhrase,
  } = useKeywordSpotter(onKeywordMatch)

  const [videoSoundUnlocked, setVideoSoundUnlocked] = useState(false)
  const unlockAudioRef = useRef<HTMLAudioElement>(null)
  const [selfViewStream, setSelfViewStream] = useState<MediaStream | null>(null)
  const [selfViewError, setSelfViewError] = useState<string | null>(null)
  const selfViewStreamRef = useRef<MediaStream | null>(null)
  const selfViewGenerationRef = useRef(0)

  const enterCooldown = useCallback(() => {
    setCanProcessMatches(false)
    setBehaviorState({ type: 'cooldown' })
    if (cooldownRef.current) window.clearTimeout(cooldownRef.current)
    cooldownRef.current = window.setTimeout(() => {
      if (callPhaseRef.current !== 'active') return
      setBehaviorState({ type: 'listen' })
    }, 800)
  }, [setCanProcessMatches])

  const {
    speed: kenBurnsSpeed,
    setSpeed: setKenBurnsSpeed,
    idleAnimationMs,
    crossfadeIntervalMs,
  } = useKenBurnsSpeed()

  const mediaPlayback = useMediaPlayback(photos, rulesConfig, {
    crossfadeIntervalMs,
    idleAnimationMs,
    dogName: profile.dogName,
    hasIdentityStill: Boolean(profile.avatarUrl),
  })

  const playReaction = mediaPlayback.playReaction
  const loadIdle = mediaPlayback.loadIdle
  const stopPlayback = mediaPlayback.stop

  const unlockVideoSound = useCallback(() => {
    unlockCallVideoSound(unlockAudioRef.current)
    setVideoSoundUnlocked(true)
    applyCallVideoSound(mediaPlayback.primaryRef.current)
    applyCallVideoSound(mediaPlayback.secondaryRef.current)
  }, [mediaPlayback.primaryRef, mediaPlayback.secondaryRef])

  const startListening = useCallback(() => {
    if (
      !rulesConfig ||
      isMutedRef.current ||
      callPhaseRef.current !== 'active'
    ) {
      return
    }
    startSpotter(rulesConfig.rules, profile.dogName, profile.ownerName)
  }, [startSpotter, profile.dogName, profile.ownerName, rulesConfig])

  const triggerReaction = useCallback(
    (clipId: string, transcript?: string) => {
      if (callPhaseRef.current !== 'active') return
      const state = behaviorStateRef.current
      if (state.type === 'react' || state.type === 'cooldown') return

      const description = rulesConfigRef.current?.rules.find(
        (rule) => rule.id === clipId,
      )?.description
      setReactionHud({
        transcript: transcript?.trim() ?? '',
        intentId: clipId,
        intentLabel: intentHudLabel(clipId, description),
      })
      setCanProcessMatches(false, { skipBucketId: clipId })
      setBehaviorState({ type: 'react', clipId })
      unlockVideoSound()
      if ('vibrate' in navigator) navigator.vibrate(30)

      playReaction(clipId, enterCooldown)
    },
    [enterCooldown, playReaction, setCanProcessMatches, unlockVideoSound],
  )

  triggerReactionRef.current = triggerReaction

  useEffect(() => {
    const refresh = () => setRulesConfig(rulesConfigFromCatalog(profile.dogName))
    refresh()
    let cancelled = false
    void hydrateStudioMedia(getStudioBlob).then(() => {
      if (!cancelled) refresh()
    })
    const unsub = subscribeStudio(refresh)
    return () => {
      cancelled = true
      unsub()
    }
  }, [profile.dogName])

  const prevRulesConfigRef = useRef(rulesConfig)
  useEffect(() => {
    const previous = prevRulesConfigRef.current
    prevRulesConfigRef.current = rulesConfig
    if (previous === rulesConfig) return
    if (callPhaseRef.current !== 'active') return
    if (behaviorStateRef.current.type === 'react') return
    loadIdle()
  }, [loadIdle, rulesConfig])

  useEffect(() => {
    if (callPhase === 'active' && !isMuted) {
      startListening()
    }
  }, [callPhase, isMuted, startListening])

  useEffect(() => {
    if (callPhase !== 'active' || isMuted) {
      setCanProcessMatches(false)
      return
    }
    const busy =
      behaviorState.type === 'react' || behaviorState.type === 'cooldown'
    if (busy) {
      setCanProcessMatches(false)
      return
    }
    const speechReady = !speechSupported || isListening || Boolean(speechError)
    if (behaviorState.type === 'idle' && speechReady) {
      setBehaviorState({ type: 'listen' })
      setCanProcessMatches(true)
      return
    }
    if (behaviorState.type === 'listen' && speechReady) {
      setCanProcessMatches(true)
    } else {
      setCanProcessMatches(false)
    }
  }, [
    behaviorState.type,
    callPhase,
    isListening,
    isMuted,
    setCanProcessMatches,
    speechError,
    speechSupported,
  ])

  useEffect(() => {
    if (callPhase !== 'active') return
    const state = behaviorStateRef.current.type
    if (state === 'react' || state === 'cooldown') return
    loadIdle()
  }, [callPhase, loadIdle])

  useEffect(() => {
    if (callPhase !== 'active' || isMuted) return
    if (behaviorState.type !== 'idle') return
    const timer = window.setTimeout(() => {
      if (
        callPhaseRef.current === 'active' &&
        behaviorStateRef.current.type === 'idle'
      ) {
        setBehaviorState({ type: 'listen' })
      }
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [behaviorState.type, callPhase, isMuted])

  const stopSelfView = useCallback(() => {
    selfViewGenerationRef.current += 1
    stopMediaStream(selfViewStreamRef.current)
    selfViewStreamRef.current = null
    setSelfViewStream(null)
    setSelfViewError(null)
  }, [])

  const startSelfView = useCallback(() => {
    stopMediaStream(selfViewStreamRef.current)
    selfViewStreamRef.current = null
    setSelfViewStream(null)
    setSelfViewError(null)
    const generation = ++selfViewGenerationRef.current
    // Fire from Accept's user-gesture stack — do not await before getUserMedia.
    void requestSelfViewStream()
      .then((stream) => {
        if (
          generation !== selfViewGenerationRef.current ||
          callPhaseRef.current !== 'active'
        ) {
          stopMediaStream(stream)
          return
        }
        selfViewStreamRef.current = stream
        setSelfViewStream(stream)
      })
      .catch((error: unknown) => {
        if (generation !== selfViewGenerationRef.current) return
        setSelfViewError(selfViewErrorMessage(error))
      })
  }, [])

  useEffect(() => {
    return () => {
      if (cooldownRef.current) window.clearTimeout(cooldownRef.current)
      selfViewGenerationRef.current += 1
      stopMediaStream(selfViewStreamRef.current)
      selfViewStreamRef.current = null
    }
  }, [])

  const beginIncomingCall = useCallback(() => {
    setCallPhase('incoming')
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100])
  }, [])

  const acceptCall = useCallback(() => {
    callPhaseRef.current = 'active'
    behaviorStateRef.current = { type: 'idle' }
    setCallPhase('active')
    setBehaviorState({ type: 'idle' })
    unlockVideoSound()
    startSelfView()
    loadIdle()
    startListening()
  }, [startListening, loadIdle, unlockVideoSound, startSelfView])

  const resetCallMedia = useCallback(() => {
    stopListening()
    stopPlayback()
    stopSelfView()
    setCanProcessMatches(false)
    releaseCallAudioUnlock(unlockAudioRef.current)
    resetCallVideoSoundUnlock()
    setVideoSoundUnlocked(false)
    setShowDebugPanel(false)
    setReactionHud(null)
    if (cooldownRef.current) window.clearTimeout(cooldownRef.current)
  }, [setCanProcessMatches, stopListening, stopPlayback, stopSelfView])

  const endCall = useCallback(() => {
    callPhaseRef.current = 'ended'
    setCallPhase('ended')
    setBehaviorState({ type: 'idle' })
    resetCallMedia()
  }, [resetCallMedia])

  const declineCall = useCallback(() => {
    callPhaseRef.current = 'home'
    setCallPhase('home')
    setBehaviorState({ type: 'idle' })
    resetCallMedia()
  }, [resetCallMedia])

  const returnToIdleAfterEnd = useCallback(() => {
    setCallPhase('home')
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev
      isMutedRef.current = next
      if (next) {
        stopListening()
        setCanProcessMatches(false)
      } else if (callPhaseRef.current === 'active') {
        startListening()
      }
      return next
    })
  }, [setCanProcessMatches, startListening, stopListening])

  const value = useMemo<MemorialCallContextValue>(
    () => ({
      profile,
      callPhase,
      behaviorState,
      isMuted,
      showDebugPanel,
      setShowDebugPanel,
      rulesConfig,
      lastTranscript,
      lastMatch,
      reactionHud,
      isListening,
      videoSoundUnlocked,
      speechSupported,
      speechError,
      selfViewStream,
      selfViewError,
      mediaPlayback,
      kenBurnsSpeed,
      setKenBurnsSpeed,
      beginIncomingCall,
      acceptCall,
      endCall,
      declineCall,
      returnToIdleAfterEnd,
      toggleMute,
      triggerReaction,
      triggerPhrase,
      unlockVideoSound,
    }),
    [
      profile,
      callPhase,
      behaviorState,
      isMuted,
      showDebugPanel,
      rulesConfig,
      lastTranscript,
      lastMatch,
      reactionHud,
      isListening,
      videoSoundUnlocked,
      speechSupported,
      speechError,
      selfViewStream,
      selfViewError,
      mediaPlayback,
      kenBurnsSpeed,
      setKenBurnsSpeed,
      beginIncomingCall,
      acceptCall,
      endCall,
      declineCall,
      returnToIdleAfterEnd,
      toggleMute,
      triggerReaction,
      triggerPhrase,
      unlockVideoSound,
    ],
  )

  return (
    <MemorialCallContext.Provider value={value}>
      <audio
        ref={unlockAudioRef}
        src={SILENCE_WAV_DATA_URI}
        preload="auto"
        playsInline
        tabIndex={-1}
        aria-hidden
        className="call-audio-unlock"
      />
      {children}
    </MemorialCallContext.Provider>
  )
}

export function useMemorialCall() {
  const ctx = useContext(MemorialCallContext)
  if (!ctx) {
    throw new Error('useMemorialCall must be used within MemorialCallProvider')
  }
  return ctx
}
