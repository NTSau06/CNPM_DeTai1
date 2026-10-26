// Tạo, điều khiển và dừng lời đọc thuyết minh bằng Speech Synthesis.
import { languages } from './data/places'
import type { Language, Place } from './types'

let activeAudio: HTMLAudioElement | null = null

const narrationAudioLanguages: Record<string, readonly Language[]> = {
  'bao-ninh-beach': ['vi'],
  'cau-hien-luong': ['vi'],
  'cua-tung-beach': ['vi'],
  'da-nhay': ['vi'],
  'dia-dao-vinh-moc': ['vi'],
  'dong-hoi': ['vi'],
  'hang-toi-song-chay': ['vi', 'en'],
  'nhat-le-beach': ['vi'],
  'nuoc-mooc': ['vi'],
  'ozo-park': ['vi'],
  'phong-nha-cave': ['vi', 'en'],
  'thanh-co-quang-tri': ['vi'],
  'thien-duong-cave': ['vi', 'en'],
  'tien-son-cave': ['vi'],
}

export const speechAvailable = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

export function getNarrationAudioUrl(placeId: string, language: Language): string | undefined {
  if (!narrationAudioLanguages[placeId]?.includes(language)) return undefined
  return `${import.meta.env.BASE_URL}audio/${placeId}/${language}.mp3`
}

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
