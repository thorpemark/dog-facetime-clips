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
  SPEECH_IOS_START_COOLDOWN_MS,
  attachMicAnalyser,
  isIOSUserAgent,
  isVoiceActivity,
  rmsFromTimeDomain,
  speechRestartDelayMs,
  speechRestartMinIntervalMs,
  speechRestartStrategy,
  stopMediaStream,
  type SpeechEndReason,
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
 * iOS Safari/Chrome beep on every SpeechRecognition.start() — do not
 * abort/rebuild, and do not restart on benign no-speech.
 */
export type KeywordMatchDetail = {
  transcript: string
  match: TranscriptMatch
}

export function useKeywordSpotter(
  onMatch: (ruleId: string, detail: KeywordMatchDetail) => void,
) {
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
  const vadTimerRef = useRef<number | null>(null)
  const lastStartAtRef = useRef(0)
  const endReasonRef = useRef<SpeechEndReason>('other')
  const micStreamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const vadBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
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
      // Debug "Heard" is always the latest raw phrase. The call HUD must
      // NOT use this — a speak-early / cooldown queue can land a newer
      // final here while the previous clip is still playing.
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
        onMatchRef.current(match.bucketId, { transcript: trimmed, match })
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

  const stopVadWatch = useCallback(() => {
    if (vadTimerRef.current) {
      window.clearTimeout(vadTimerRef.current)
      vadTimerRef.current = null
    }
  }, [])

  const releaseMicHold = useCallback(() => {
    stopVadWatch()
    micHoldCleanupRef.current?.()
    micHoldCleanupRef.current = null
    analyserRef.current = null
    vadBufferRef.current = null
    stopMediaStream(micStreamRef.current)
    micStreamRef.current = null
    const ctx = audioContextRef.current
    audioContextRef.current = null
    if (ctx && ctx.state !== 'closed') {
      void ctx.close().catch(() => {})
    }
  }, [stopVadWatch])

  const iosDevice = useCallback(
    () => isIOSUserAgent(navigator.userAgent, navigator.maxTouchPoints ?? 0),
    [],
  )

  const tryStartRecognizer = useCallback((recognition: SpeechRecognition) => {
    if (!sessionActiveRef.current || !shouldListenRef.current) return
    if (runningRef.current) return
    if (iosDevice()) {
      const wait = speechRestartDelayMs(
        lastStartAtRef.current,
        Date.now(),
        SPEECH_IOS_START_COOLDOWN_MS,
      )
      if (wait > 0) {
        clearRestartTimer()
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null
          tryStartRecognizer(recognition)
        }, wait)
        return
      }
    }
    try {
      recognition.start()
    } catch {
      /* InvalidStateError: already started */
    }
  }, [clearRestartTimer, iosDevice])

  const startVadWatch = useCallback((recognition: SpeechRecognition) => {
    stopVadWatch()
    const tick = () => {
      vadTimerRef.current = null
      if (!sessionActiveRef.current || !shouldListenRef.current) return
      if (runningRef.current) return
      const analyser = analyserRef.current
      if (analyser) {
        const size = analyser.fftSize
        if (!vadBufferRef.current || vadBufferRef.current.length !== size) {
          vadBufferRef.current = new Uint8Array(new ArrayBuffer(size))
        }
        analyser.getByteTimeDomainData(vadBufferRef.current)
        if (isVoiceActivity(rmsFromTimeDomain(vadBufferRef.current))) {
          tryStartRecognizer(recognition)
          return
        }
      }
      vadTimerRef.current = window.setTimeout(tick, 100)
    }
    vadTimerRef.current = window.setTimeout(tick, 100)
  }, [stopVadWatch, tryStartRecognizer])

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
        const { analyser, cleanup } = attachMicAnalyser(stream, ctx)
        analyserRef.current = analyser
        micHoldCleanupRef.current = cleanup
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
      endReasonRef.current = 'other'
      stopVadWatch()
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
      if (isFinal) endReasonRef.current = 'result'
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
      if (event.error === 'no-speech') {
        endReasonRef.current = 'no-speech'
        return
      }
      if (event.error === 'aborted') {
        endReasonRef.current = 'aborted'
        return
      }
      setSpeechError(event.error)
    }

    recognition.onend = () => {
      runningRef.current = false
      if (recognitionRef.current !== recognition) return
      if (!sessionActiveRef.current || !shouldListenRef.current) {
        setIsListening(false)
        return
      }
      // Keep the Listening cue — the mic hold is still live.
      const isIOS = iosDevice()
      const strategy = speechRestartStrategy({
        isIOS,
        reason: endReasonRef.current,
        sessionActive: true,
        running: false,
      })
      endReasonRef.current = 'other'
      if (strategy === 'never') return
      if (strategy === 'vad') {
        startVadWatch(recognition)
        return
      }
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
        tryStartRecognizer(recognition)
      }, delay)
    }
  }, [
    clearRestartTimer,
    iosDevice,
    releaseMicHold,
    startVadWatch,
    stopVadWatch,
    tryStartRecognizer,
  ])

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
    tryStartRecognizer(recognition)
  }, [bindRecognizer, holdMic, tryStartRecognizer])

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
    stopVadWatch()
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
  }, [clearRestartTimer, releaseMicHold, stopVadWatch])

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
      stopVadWatch()
      try {
        recognitionRef.current?.stop()
      } catch {
        /* unmount */
      }
      recognitionRef.current = null
      releaseMicHold()
    }
  }, [clearRestartTimer, releaseMicHold, stopVadWatch])

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
