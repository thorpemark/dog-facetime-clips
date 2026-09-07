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
import { loadKeywordRules, rulesConfigFromCatalog } from '../utils/keywordRules'
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
    () => rulesConfigFromCatalog(),
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

  const keywordSpotter = useKeywordSpotter((ruleId) => {
    triggerReactionRef.current(ruleId)
  })

  const {
    speed: kenBurnsSpeed,
    setSpeed: setKenBurnsSpeed,
    idleAnimationMs,
    crossfadeIntervalMs,
  } = useKenBurnsSpeed()

  const mediaPlayback = useMediaPlayback(photos, rulesConfig, {
    crossfadeIntervalMs,
    idleAnimationMs,
  })

  const startListening = useCallback(() => {
    if (
      !rulesConfig ||
      isMutedRef.current ||
      callPhaseRef.current !== 'active'
    ) {
      return
    }
    keywordSpotter.startListening(
      rulesConfig.rules,
      profile.dogName,
      profile.ownerName,
    )
    setBehaviorState({ type: 'listen' })
  }, [keywordSpotter, profile.dogName, profile.ownerName, rulesConfig])

  const triggerReaction = useCallback(
    (clipId: string) => {
      if (callPhaseRef.current !== 'active') return
      const state = behaviorStateRef.current
      if (state.type === 'react' || state.type === 'cooldown') return

      setBehaviorState({ type: 'react', clipId })
      keywordSpotter.stopListening()
      if ('vibrate' in navigator) navigator.vibrate(30)

      mediaPlayback.playReaction(clipId, enterCooldown)
    },
    [enterCooldown, keywordSpotter, mediaPlayback],
  )

  triggerReactionRef.current = triggerReaction

  useEffect(() => {
    loadKeywordRules()
      .then(setRulesConfig)
      .catch((err) => console.error(err))
  }, [])

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
    mediaPlayback.loadIdle()
    startListening()
  }, [startListening, mediaPlayback])

  const endCall = useCallback(() => {
    setCallPhase('ended')
    setBehaviorState({ type: 'idle' })
    keywordSpotter.stopListening()
    mediaPlayback.stop()
    setShowDebugPanel(false)
    if (cooldownRef.current) window.clearTimeout(cooldownRef.current)
  }, [keywordSpotter, mediaPlayback])

  const declineCall = useCallback(() => {
    setCallPhase('home')
    setBehaviorState({ type: 'idle' })
    keywordSpotter.stopListening()
    mediaPlayback.stop()
    setShowDebugPanel(false)
    if (cooldownRef.current) window.clearTimeout(cooldownRef.current)
  }, [keywordSpotter, mediaPlayback])

  const returnToIdleAfterEnd = useCallback(() => {
    setCallPhase('home')
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev
      if (next) {
        keywordSpotter.stopListening()
      } else if (callPhaseRef.current === 'active') {
        startListening()
      }
      return next
    })
  }, [keywordSpotter, startListening])

  const value = useMemo<MemorialCallContextValue>(
    () => ({
      profile,
      callPhase,
      behaviorState,
      isMuted,
      showDebugPanel,
      setShowDebugPanel,
      rulesConfig,
      lastTranscript: keywordSpotter.lastTranscript,
      lastMatch: keywordSpotter.lastMatch,
      speechSupported: keywordSpotter.speechSupported,
      speechError: keywordSpotter.speechError,
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
      triggerPhrase: keywordSpotter.triggerPhrase,
    }),
    [
      profile,
      callPhase,
      behaviorState,
      isMuted,
      showDebugPanel,
      rulesConfig,
      keywordSpotter.lastTranscript,
      keywordSpotter.lastMatch,
      keywordSpotter.speechSupported,
      keywordSpotter.speechError,
      keywordSpotter.triggerPhrase,
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
