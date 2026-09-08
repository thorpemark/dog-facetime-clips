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
import type { TranscriptMatch } from '../utils/matchTranscript'

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
  speechSupported: boolean
  speechError: string | null
  mediaPlayback: ReturnType<typeof useMediaPlayback>
  kenBurnsSpeed: KenBurnsSpeed
  setKenBurnsSpeed: (speed: KenBurnsSpeed) => void
  beginIncomingCall: () => void
  acceptCall: () => void
  endCall: () => void
  declineCall: () => void
  returnToIdleAfterEnd: () => void
  toggleMute: () => void
  triggerReaction: (clipId: string) => void
  triggerPhrase: (phrase: string) => void
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
  const [rulesConfig, setRulesConfig] = useState<KeywordRulesConfig | null>(
    () => rulesConfigFromCatalog(profile.dogName),
  )

  const cooldownRef = useRef<number | null>(null)
  const callPhaseRef = useRef(callPhase)
  const behaviorStateRef = useRef(behaviorState)
  const isMutedRef = useRef(isMuted)

  callPhaseRef.current = callPhase
  behaviorStateRef.current = behaviorState
  isMutedRef.current = isMuted

  const enterCooldown = useCallback(() => {
    setBehaviorState({ type: 'cooldown' })
    if (cooldownRef.current) window.clearTimeout(cooldownRef.current)
    cooldownRef.current = window.setTimeout(() => {
      if (callPhaseRef.current !== 'active') return
      setBehaviorState({ type: 'listen' })
    }, 800)
  }, [])

  const triggerReactionRef = useRef<(clipId: string) => void>(() => {})
  const onKeywordMatch = useCallback((ruleId: string) => {
    triggerReactionRef.current(ruleId)
  }, [])

  const {
    lastTranscript,
    lastMatch,
    speechSupported,
    speechError,
    startListening: startSpotter,
    stopListening,
    triggerPhrase,
  } = useKeywordSpotter(onKeywordMatch)

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

  const startListening = useCallback(() => {
    if (
      !rulesConfig ||
      isMutedRef.current ||
      callPhaseRef.current !== 'active'
    ) {
      return
    }
    startSpotter(rulesConfig.rules, profile.dogName, profile.ownerName)
    setBehaviorState((prev) => (prev.type === 'listen' ? prev : { type: 'listen' }))
  }, [startSpotter, profile.dogName, profile.ownerName, rulesConfig])

  const triggerReaction = useCallback(
    (clipId: string) => {
      if (callPhaseRef.current !== 'active') return
      const state = behaviorStateRef.current
      if (state.type === 'react' || state.type === 'cooldown') return

      setBehaviorState({ type: 'react', clipId })
      stopListening()
      if ('vibrate' in navigator) navigator.vibrate(30)

      playReaction(clipId, enterCooldown)
    },
    [enterCooldown, playReaction, stopListening],
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

  const rulesConfigRef = useRef(rulesConfig)
  useEffect(() => {
    const previous = rulesConfigRef.current
    rulesConfigRef.current = rulesConfig
    if (previous === rulesConfig) return
    if (callPhaseRef.current !== 'active') return
    if (behaviorStateRef.current.type === 'react') return
    loadIdle()
  }, [loadIdle, rulesConfig])

  useEffect(() => {
    if (behaviorState.type === 'listen' && callPhase === 'active' && !isMuted) {
      startListening()
    }
  }, [behaviorState.type, callPhase, isMuted, startListening])

  useEffect(() => {
    return () => {
      if (cooldownRef.current) window.clearTimeout(cooldownRef.current)
    }
  }, [])

  const beginIncomingCall = useCallback(() => {
    setCallPhase('incoming')
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100])
  }, [])

  const acceptCall = useCallback(() => {
    setCallPhase('active')
    setBehaviorState({ type: 'idle' })
    loadIdle()
    startListening()
  }, [startListening, loadIdle])

  const endCall = useCallback(() => {
    setCallPhase('ended')
    setBehaviorState({ type: 'idle' })
    stopListening()
    stopPlayback()
    setShowDebugPanel(false)
    if (cooldownRef.current) window.clearTimeout(cooldownRef.current)
  }, [stopListening, stopPlayback])

  const declineCall = useCallback(() => {
    setCallPhase('home')
    setBehaviorState({ type: 'idle' })
    stopListening()
    stopPlayback()
    setShowDebugPanel(false)
    if (cooldownRef.current) window.clearTimeout(cooldownRef.current)
  }, [stopListening, stopPlayback])

  const returnToIdleAfterEnd = useCallback(() => {
    setCallPhase('home')
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev
      if (next) {
        stopListening()
      } else if (callPhaseRef.current === 'active') {
        startListening()
      }
      return next
    })
  }, [startListening, stopListening])

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
      speechSupported,
      speechError,
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
      speechSupported,
      speechError,
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
    ],
  )

  return (
    <MemorialCallContext.Provider value={value}>
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
