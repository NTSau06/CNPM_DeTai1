import { languages } from './data/places'
import type { Language } from './types'

export const speechAvailable = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

export function speak(text: string, language: Language, onEnd?: () => void) {
  if (!speechAvailable()) return false
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = languages.find((item) => item.code === language)?.speech ?? 'vi-VN'
  utterance.rate = 0.92
  utterance.onend = () => onEnd?.()
  utterance.onerror = () => onEnd?.()
  const voices = window.speechSynthesis.getVoices()
  const prefix = utterance.lang.toLowerCase().split('-')[0]
  const voice = voices.find((item) => item.lang.toLowerCase() === utterance.lang.toLowerCase())
    ?? voices.find((item) => item.lang.toLowerCase().startsWith(prefix))
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
  return true
}

export function stopSpeaking() {
  if (speechAvailable()) window.speechSynthesis.cancel()
}
