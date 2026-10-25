import { languages } from './data/places'
import type { Language, Place } from './types'

export const speechAvailable = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

export function getNarrationText(place: Place, language: Language) {
  const copy = place.copy[language] ?? place.copy.vi
  if (language !== 'vi') return copy.narration

  return [
    copy.title,
    copy.subtitle,
    copy.narration,
    ...place.detailSections.flatMap((section) => [section.heading, section.body]),
  ].join('. ')
}

export interface SpeechPlaybackCallbacks {
  onBoundary: (characterIndex: number) => void
  onEnd: () => void
  onError: () => void
}

export function speakFrom(
  text: string,
  language: Language,
  rate: number,
  startCharacter: number,
  callbacks: SpeechPlaybackCallbacks,
) {
  if (!speechAvailable()) return false
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text.slice(startCharacter))
  utterance.lang = languages.find((item) => item.code === language)?.speech ?? 'vi-VN'
  utterance.rate = rate
  utterance.onboundary = (event) => callbacks.onBoundary(startCharacter + event.charIndex)
  utterance.onend = callbacks.onEnd
  utterance.onerror = callbacks.onError
  const voices = window.speechSynthesis.getVoices()
  const prefix = utterance.lang.toLowerCase().split('-')[0]
  const voice = voices.find((item) => item.lang.toLowerCase() === utterance.lang.toLowerCase())
    ?? voices.find((item) => item.lang.toLowerCase().startsWith(prefix))
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
  return true
}

export function speak(text: string, language: Language, onEnd?: () => void) {
  return speakFrom(text, language, 0.92, 0, {
    onBoundary: () => {},
    onEnd: () => onEnd?.(),
    onError: () => onEnd?.(),
  })
}

export function stopSpeaking() {
  if (speechAvailable()) window.speechSynthesis.cancel()
}
