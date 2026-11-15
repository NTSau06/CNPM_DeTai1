// Tạo, điều khiển và dừng lời đọc thuyết minh bằng Speech Synthesis.
import { languages } from './data/places'
import type { Language, Place } from './types'
import bundledScripts from './data/narrationScripts.json'
import bundledAudio from './data/narrationAudio.json'

let playbackGeneration = 0
let activeAudio: HTMLAudioElement | null = null
let cancelPendingAudio: (() => void) | null = null
let onPlaybackStopped: (() => void) | undefined

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
  const voice = pickVoice(voices, utterance.lang)
  if (!voice) return false
  utterance.voice = voice
  if (window.speechSynthesis.paused) window.speechSynthesis.resume()
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
  cancelPendingAudio?.()
  cancelPendingAudio = null
  if (!activeAudio) return
  activeAudio.onerror = null
  activeAudio.onended = null
  activeAudio.onplaying = null
  activeAudio.pause()
  activeAudio.currentTime = 0
  activeAudio = null
}

export function stopSpeaking() {
  playbackGeneration += 1
  const onStop = onPlaybackStopped
  onPlaybackStopped = undefined
  onStop?.()
  stopAudioPlayback()
  if (speechAvailable()) window.speechSynthesis.cancel()
}

export function beginPlayback(onStop?: () => void) {
  stopSpeaking()
  onPlaybackStopped = onStop
  return playbackGeneration
}

export function isPlaybackCurrent(generation: number | null) {
  return generation !== null && generation === playbackGeneration
}

export function claimAudioPlayback(audio: HTMLAudioElement, onStop?: () => void) {
  const generation = beginPlayback(onStop)
  activeAudio = audio
  return generation
}

export function pickVoice<T extends { lang: string }>(voices: T[], speechLang: string): T | undefined {
  const normalized = speechLang.toLowerCase().replace(/_/g, '-')
  const prefix = normalized.split('-')[0]
  return voices.find((voice) => voice.lang.toLowerCase().replace(/_/g, '-') === normalized)
    ?? voices.find((voice) => voice.lang.toLowerCase().replace(/_/g, '-').split('-')[0] === prefix)
}

export async function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  if (!speechAvailable()) return []
  const synth = window.speechSynthesis
  if (synth.getVoices().length) return synth.getVoices()
  return new Promise((resolve) => {
    const finish = () => {
      if (!synth.getVoices().length) return
      cleanup()
      resolve(synth.getVoices())
    }
    const cleanup = () => { clearTimeout(timer); synth.removeEventListener('voiceschanged', finish) }
    const timer = setTimeout(() => { cleanup(); resolve(synth.getVoices()) }, 1000)
    synth.addEventListener('voiceschanged', finish)
    finish()
  })
}

export type NarrationResult = { ok: true; usedLanguage: Language; fallback: boolean }
  | { ok: false; reason: 'unsupported' | 'no-voice' }

export async function prepareSpeech(language: Language, text: string, vietnameseText: string) {
  const voices = await ensureVoicesLoaded()
  if (pickVoice(voices, languages.find((item) => item.code === language)?.speech ?? language)) {
    return { text, language, fallback: false }
  }
  if (pickVoice(voices, 'vi-VN')) return { text: vietnameseText, language: 'vi' as Language, fallback: language !== 'vi' }
  return undefined
}

export async function playNarration(place: Place, language: Language, onResult?: (result: NarrationResult) => void): Promise<NarrationResult> {
  const generation = beginPlayback()
  const report = (result: NarrationResult) => {
    if (isPlaybackCurrent(generation)) onResult?.(result)
    return result
  }
  const fallbackToSpeech = async (): Promise<NarrationResult> => {
    if (!isPlaybackCurrent(generation) || !speechAvailable()) return report({ ok: false, reason: 'unsupported' })
    const prepared = await prepareSpeech(language, getNarrationText(place, language), getNarrationText(place, 'vi'))
    if (!isPlaybackCurrent(generation)) return { ok: false, reason: 'unsupported' }
    if (!prepared) return report({ ok: false, reason: 'no-voice' })
    const ok = speakFrom(prepared.text, prepared.language, 0.92, 0, {
      onBoundary: () => {},
      onEnd: () => {},
      onError: () => { report({ ok: false, reason: 'no-voice' }) },
    })
    return report(ok ? { ok: true, usedLanguage: prepared.language, fallback: prepared.fallback } : { ok: false, reason: 'no-voice' })
  }
  const audioUrl = getNarrationAudioUrl(place, language)
  if (audioUrl && typeof Audio !== 'undefined') {
    const audio = new Audio(audioUrl)
    activeAudio = audio
    const started = await new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (started: boolean) => {
        if (settled) return
        settled = true
        cancelPendingAudio = null
        audio.onerror = null
        audio.onplaying = null
        resolve(started)
      }
      // Dừng trước khi MP3 sẵn sàng cũng phải kết thúc lần chờ.
      cancelPendingAudio = () => finish(false)
      audio.onerror = () => finish(false)
      audio.onplaying = () => finish(true)
      void audio.play().catch(() => finish(false))
    })
    if (generation !== playbackGeneration) return { ok: false, reason: 'unsupported' }
    if (started) {
      audio.onerror = () => {
        if (!isPlaybackCurrent(generation) || activeAudio !== audio) return
        stopAudioPlayback()
        void fallbackToSpeech()
      }
      audio.onended = () => { if (activeAudio === audio) activeAudio = null }
      return report({ ok: true, usedLanguage: language, fallback: false })
    }
    stopAudioPlayback()
  }
  return fallbackToSpeech()
}
