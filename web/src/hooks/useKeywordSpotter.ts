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

export function useKeywordSpotter(onMatch: (ruleId: string) => void) {
  const [isListening, setIsListening] = useState(false)
  const [lastTranscript, setLastTranscript] = useState('')
  const [lastMatch, setLastMatch] = useState<TranscriptMatch | null>(null)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const shouldListenRef = useRef(false)
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

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor || !shouldListenRef.current) return
    if (recognitionRef.current) return

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
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
        setIsListening(false)
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setSpeechError(event.error)
      }
    }

    recognition.onend = () => {
      recognitionRef.current = null
      if (shouldListenRef.current) {
        window.setTimeout(() => startRecognition(), 300)
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setSpeechError('Could not start speech recognition')
      setIsListening(false)
    }
  }, [])

  const startListening = useCallback(
    (rules: KeywordRule[], dogName: string, ownerName: string) => {
      rulesRef.current = [...rules].sort((a, b) => b.priority - a.priority)
      dogNameRef.current = dogName
      ownerNameRef.current = ownerName
      shouldListenRef.current = true
      startRecognition()
    },
    [startRecognition],
  )

  const stopListening = useCallback((options?: { clearPending?: boolean }) => {
    shouldListenRef.current = false
    canProcessRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
    if (options?.clearPending !== false) {
      pendingRef.current = null
    }
  }, [])

  const triggerPhrase = useCallback(
    (phrase: string) => {
      processTranscript(phrase, { isFinal: true })
    },
    [processTranscript],
  )

  useEffect(() => {
    return () => {
      shouldListenRef.current = false
      recognitionRef.current?.abort()
    }
  }, [])

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
