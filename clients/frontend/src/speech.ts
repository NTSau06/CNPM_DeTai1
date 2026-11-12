// Tạo, điều khiển và dừng lời đọc thuyết minh bằng Speech Synthesis.
import { languages } from './data/places'
import type { Language, Place } from './types'
import bundledScripts from './data/narrationScripts.json'
import bundledAudio from './data/narrationAudio.json'

let activeAudio: HTMLAudioElement | null = null

const narrationScripts: Record<string, Partial<Record<Language, { originalNarration: string; text: string }>>> = bundledScripts
const narrationAudio: Record<string, Partial<Record<Language, { durationSeconds: number; audioSha256: string }>>> = bundledAudio

function getBundledScript(place: { id: string; copy: Partial<Place['copy']> }, language: Language) {
  const entry = narrationScripts[place.id]?.[language]
  const text = place.copy[language]?.narration
  // An admin-edited narration must keep its own content and audio selection.
  return entry && (text === entry.originalNarration || text === entry.text) ? entry : undefined
}

export function getNarrationDurationSeconds(place: Place, language: Language): number | undefined {
  if (place.copy[language]?.audioUrl != null || !getBundledScript(place, language)) return undefined
  return narrationAudio[place.id]?.[language]?.durationSeconds
}

export const speechAvailable = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

export function getNarrationAudioUrl(place: { id: string; copy: Partial<Place['copy']> }, language: Language): string | undefined {
  const customUrl = place.copy[language]?.audioUrl
  if (customUrl != null) return customUrl || undefined
  const placeId = place.id
  const metadata = narrationAudio[placeId]?.[language]
  if (!metadata || !getBundledScript(place, language)) return undefined
  return `${import.meta.env.BASE_URL}audio/${placeId}/${language}.mp3?v=${metadata.audioSha256.slice(0, 12)}`
}

export function getNarrationAudioLanguage(place: Place, preferredLanguage: Language): Language {
  return place.copy[preferredLanguage] ? preferredLanguage : 'vi'
}

export function getNarrationText(place: Place, language: Language) {
  const copy = place.copy[language] ?? place.copy.vi
  return getBundledScript(place, language)?.text ?? copy.narration
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
  stopAudioPlayback()
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

export function speakWithAudio(text: string, language: Language, audioUrl?: string) {
  if (!audioUrl) return speak(text, language)
  if (typeof Audio === 'undefined') return speak(text, language)
  stopSpeaking()
  const audio = new Audio(audioUrl)
  activeAudio = audio
  const fallbackToSpeech = () => {
    if (activeAudio !== audio) return
    activeAudio = null
    audio.onerror = null
    audio.onended = null
    audio.pause()
    speak(text, language)
  }
  audio.onended = () => {
    if (activeAudio === audio) activeAudio = null
  }
  audio.onerror = fallbackToSpeech
  void audio.play().catch(fallbackToSpeech)
  return true
}

function stopAudioPlayback() {
  if (!activeAudio) return
  activeAudio.onerror = null
  activeAudio.onended = null
  activeAudio.pause()
  activeAudio.currentTime = 0
  activeAudio = null
}

export function stopSpeaking() {
  stopAudioPlayback()
  if (speechAvailable()) window.speechSynthesis.cancel()
}
