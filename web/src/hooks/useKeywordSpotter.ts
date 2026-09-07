import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeywordRule } from '../types'
import { catalogForDogName } from '../utils/clipStudioCatalog'
import {
  MATCH_CONFIDENCE_THRESHOLD,
  matchTranscript,
  type TranscriptMatch,
} from '../utils/matchTranscript'

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
  const matchCooldownMs = 2000
  onMatchRef.current = onMatch

  useEffect(() => {
    setSpeechSupported(getSpeechRecognition() !== null)
  }, [])

  const processTranscript = useCallback((transcript: string) => {
    setLastTranscript(transcript)
    const now = Date.now()
    if (now - lastMatchTimeRef.current < matchCooldownMs) return

    const match = matchTranscript(transcript, {
      dogName: dogNameRef.current,
      ownerName: ownerNameRef.current,
      catalog: catalogForDogName(dogNameRef.current),
    })
    if (match) {
      const known = rulesRef.current.some((rule) => rule.id === match.bucketId)
      if (!known && rulesRef.current.length > 0) return
      lastMatchTimeRef.current = now
      setLastMatch(match)
      onMatchRef.current(match.bucketId)
    }
  }, [])

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor || !shouldListenRef.current) return

    recognitionRef.current?.abort()

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      processTranscript(transcript.trim())
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
      if (shouldListenRef.current) {
        window.setTimeout(() => startRecognition(), 300)
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsListening(true)
      setSpeechError(null)
    } catch {
      setSpeechError('Could not start speech recognition')
      setIsListening(false)
    }
  }, [processTranscript])

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

  const stopListening = useCallback(() => {
    shouldListenRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
  }, [])

  const triggerPhrase = useCallback(
    (phrase: string) => {
      processTranscript(phrase)
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
    triggerPhrase,
  }
}
