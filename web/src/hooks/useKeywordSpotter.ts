import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeywordRule } from '../types'
import { isUnknownIntent } from '../data/reactionCatalog'
import { catalogForDogName } from '../utils/clipStudioCatalog'
import {
  MATCH_CONFIDENCE_THRESHOLD,
  matchTranscript,
  type TranscriptMatch,
} from '../utils/matchTranscript'
import {
  attachSilentMicHold,
  speechRestartDelayMs,
  speechRestartMinIntervalMs,
  stopMediaStream,
} from '../utils/micSession'
import {
  holdLatestFinal,
  isEchoOfLastReaction,
  takePendingIfFresh,
  type PendingTranscript,
} from '../utils/pendingTranscript'

type SpeechRecognitionCtor = new () => SpeechRecognition

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function audioContextCtor(): typeof AudioContext | undefined {
  const w = window as Window & { webkitAudioContext?: typeof AudioContext }
  return window.AudioContext ?? w.webkitAudioContext
}

/**
 * One mic session per listen period (Accept → End / Mute).
 * Safari iOS re-shows “Microphone access allowed” (and may beep) if
 * SpeechRecognition is aborted and reconstructed on every onend.
 */
export function useKeywordSpotter(onMatch: (ruleId: string) => void) {
  const [isListening, setIsListening] = useState(false)
  const [lastTranscript, setLastTranscript] = useState('')
  const [lastMatch, setLastMatch] = useState<TranscriptMatch | null>(null)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const sessionActiveRef = useRef(false)
  const shouldListenRef = useRef(false)
  const runningRef = useRef(false)
  const restartTimerRef = useRef<number | null>(null)
  const lastStartAtRef = useRef(0)
  const micStreamRef = useRef<MediaStream | null>(null)
  const micHoldCleanupRef = useRef<(() => void) | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const rulesRef = useRef<KeywordRule[]>([])
  const dogNameRef = useRef('')
  const ownerNameRef = useRef('')
  const lastMatchTimeRef = useRef(0)
  const onMatchRef = useRef(onMatch)
  const canProcessRef = useRef(false)
  const pendingRef = useRef<PendingTranscript | null>(null)
  const skipBucketRef = useRef<string | null>(null)
  const matchCooldownMs = 2000
  onMatchRef.current = onMatch

  useEffect(() => {
    setSpeechSupported(getSpeechRecognition() !== null)
  }, [])

  const processTranscript = useCallback(
    (transcript: string, options?: { isFinal?: boolean; ignoreMatchCooldown?: boolean }) => {
      const trimmed = transcript.trim()
      if (trimmed) setLastTranscript(trimmed)

      const isFinal = options?.isFinal ?? true
      if (!canProcessRef.current) {
        if (isFinal) {
          pendingRef.current = holdLatestFinal(
            pendingRef.current,
            trimmed,
            Date.now(),
          )
        }
        return
      }

      const now = Date.now()
      if (!options?.ignoreMatchCooldown && now - lastMatchTimeRef.current < matchCooldownMs) {
        return
      }

      const match = matchTranscript(trimmed, {
        dogName: dogNameRef.current,
        ownerName: ownerNameRef.current,
        catalog: catalogForDogName(dogNameRef.current),
      })
      if (match) {
        const known = rulesRef.current.some((rule) => rule.id === match.bucketId)
        const allowUnknown =
          match.method === 'fallback' || isUnknownIntent(match.bucketId)
        if (!known && rulesRef.current.length > 0 && !allowUnknown) return
        if (isEchoOfLastReaction(match.bucketId, skipBucketRef.current)) {
          skipBucketRef.current = null
          return
        }
        lastMatchTimeRef.current = now
        setLastMatch(match)
        onMatchRef.current(match.bucketId)
      }
    },
    [],
  )

  const processTranscriptRef = useRef(processTranscript)
  processTranscriptRef.current = processTranscript

  const flushPending = useCallback(() => {
    const pending = pendingRef.current
    pendingRef.current = null
    const transcript = takePendingIfFresh(pending, Date.now())
    if (transcript) {
      processTranscript(transcript, { isFinal: true, ignoreMatchCooldown: true })
    }
    skipBucketRef.current = null
  }, [processTranscript])

  const setCanProcessMatches = useCallback(
    (enabled: boolean, options?: { skipBucketId?: string | null }) => {
      if (options && 'skipBucketId' in options) {
        skipBucketRef.current = options.skipBucketId ?? null
      }
      canProcessRef.current = enabled
      if (enabled) flushPending()
    },
    [flushPending],
  )

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }, [])

  const releaseMicHold = useCallback(() => {
    micHoldCleanupRef.current?.()
    micHoldCleanupRef.current = null
    stopMediaStream(micStreamRef.current)
    micStreamRef.current = null
    const ctx = audioContextRef.current
    audioContextRef.current = null
    if (ctx && ctx.state !== 'closed') {
      void ctx.close().catch(() => {})
    }
  }, [])

  const holdMic = useCallback(() => {
    if (micStreamRef.current) return
    if (!navigator.mediaDevices?.getUserMedia) return
    void navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        if (!sessionActiveRef.current) {
          stopMediaStream(stream)
          return
        }
        if (micStreamRef.current) {
          stopMediaStream(stream)
          return
        }
        micStreamRef.current = stream
        const Ctor = audioContextCtor()
        if (!Ctor) return
        const ctx = audioContextRef.current ?? new Ctor()
        audioContextRef.current = ctx
        void ctx.resume()
        micHoldCleanupRef.current = attachSilentMicHold(stream, ctx)
      })
      .catch(() => {
        /* SpeechRecognition may still start; permission errors surface there */
      })
  }, [])

  const bindRecognizer = useCallback((recognition: SpeechRecognition) => {
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      runningRef.current = true
      lastStartAtRef.current = Date.now()
      setIsListening(true)
      setSpeechError(null)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      let isFinal = false
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
        isFinal = event.results[i].isFinal
      }
      processTranscriptRef.current(transcript.trim(), { isFinal })
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        setSpeechError('Microphone permission denied')
        shouldListenRef.current = false
        sessionActiveRef.current = false
        runningRef.current = false
        setIsListening(false)
        releaseMicHold()
        return
      }
      // no-speech / aborted are normal; onend restarts the same instance.
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setSpeechError(event.error)
      }
    }

    recognition.onend = () => {
      runningRef.current = false
      if (recognitionRef.current !== recognition) return
      if (!sessionActiveRef.current || !shouldListenRef.current) {
        setIsListening(false)
        return
      }
      // Stay in "Listening" across Safari's obligatory onend; do not rebuild.
      const delay = speechRestartDelayMs(
        lastStartAtRef.current,
        Date.now(),
        speechRestartMinIntervalMs(
          navigator.userAgent,
          navigator.maxTouchPoints ?? 0,
        ),
      )
      clearRestartTimer()
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null
        if (recognitionRef.current !== recognition) return
        if (!sessionActiveRef.current || !shouldListenRef.current) return
        if (runningRef.current) return
        try {
          recognition.start()
        } catch {
          /* InvalidStateError: already started */
        }
      }, delay)
    }
  }, [clearRestartTimer, releaseMicHold])

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor || !shouldListenRef.current || !sessionActiveRef.current) return

    holdMic()

    let recognition = recognitionRef.current
    if (!recognition) {
      recognition = new Ctor()
      bindRecognizer(recognition)
      recognitionRef.current = recognition
    }

    if (runningRef.current) return
    try {
      recognition.start()
    } catch {
      /* already started */
    }
  }, [bindRecognizer, holdMic])

  const startListening = useCallback(
    (rules: KeywordRule[], dogName: string, ownerName: string) => {
      rulesRef.current = [...rules].sort((a, b) => b.priority - a.priority)
      dogNameRef.current = dogName
      ownerNameRef.current = ownerName
      shouldListenRef.current = true
      const already = sessionActiveRef.current && recognitionRef.current
      sessionActiveRef.current = true
      if (already) return
      startRecognition()
    },
    [startRecognition],
  )

  const stopListening = useCallback((options?: { clearPending?: boolean }) => {
    shouldListenRef.current = false
    sessionActiveRef.current = false
    canProcessRef.current = false
    runningRef.current = false
    clearRestartTimer()
    const recognition = recognitionRef.current
    recognitionRef.current = null
    try {
      recognition?.stop()
    } catch {
      /* already stopped */
    }
    releaseMicHold()
    setIsListening(false)
    if (options?.clearPending !== false) {
      pendingRef.current = null
    }
  }, [clearRestartTimer, releaseMicHold])

  const triggerPhrase = useCallback(
    (phrase: string) => {
      processTranscript(phrase, { isFinal: true })
    },
    [processTranscript],
  )

  useEffect(() => {
    return () => {
      shouldListenRef.current = false
      sessionActiveRef.current = false
      clearRestartTimer()
      try {
        recognitionRef.current?.stop()
      } catch {
        /* unmount */
      }
      recognitionRef.current = null
      releaseMicHold()
    }
  }, [clearRestartTimer, releaseMicHold])

  return {
    isListening,
    lastTranscript,
    lastMatch,
    matchThreshold: MATCH_CONFIDENCE_THRESHOLD,
    speechSupported,
    speechError,
    startListening,
    stopListening,
    setCanProcessMatches,
    triggerPhrase,
  }
}
