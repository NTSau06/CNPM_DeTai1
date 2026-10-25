import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import { translate } from '../i18n'
import { speakFrom, speechAvailable, stopSpeaking } from '../speech'
import type { Language } from '../types'
import type { CSSProperties } from 'react'

const playbackRates = [0.75, 1, 1.25, 1.5]
const estimatedCharactersPerSecond = 14

interface AudioPlayerProps {
  text: string
  language: Language
  speechLanguage: Language
  onPlayingChange: (playing: boolean) => void
}

export function AudioPlayer({ text, language, speechLanguage, onPlayingChange }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [characterIndex, setCharacterIndex] = useState(0)
  const [seekDraft, setSeekDraft] = useState<number | null>(null)
  const characterIndexRef = useRef(0)
  const generation = useRef(0)
  const utteranceActive = useRef(false)
  const baseCharacter = useRef(0)
  const segmentStartedAt = useRef(0)
  const rateRef = useRef(rate)
  const playingRef = useRef(playing)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const segmentRefs = useRef<(HTMLParagraphElement | null)[]>([])
  const transcriptSegments = useMemo(() => splitTranscript(text), [text])
  const currentSegmentIndex = transcriptSegments.findIndex((segment) => characterIndex < segment.end)
  const activeSegmentIndex = currentSegmentIndex === -1 ? transcriptSegments.length - 1 : currentSegmentIndex

  const updateCharacterIndex = (value: number) => {
    const next = Math.max(0, Math.min(text.length, value))
    characterIndexRef.current = next
    setCharacterIndex(next)
  }

  const startAt = (offset: number) => {
    const token = ++generation.current
    const start = Math.max(0, Math.min(text.length, offset))
    baseCharacter.current = start
    segmentStartedAt.current = performance.now()
    updateCharacterIndex(start)
    utteranceActive.current = true
    onPlayingChange(true)
    playingRef.current = true
    setPlaying(true)

    const success = speakFrom(text, speechLanguage, rateRef.current, start, {
      onBoundary: (index) => {
        if (generation.current !== token) return
        baseCharacter.current = index
        segmentStartedAt.current = performance.now()
        updateCharacterIndex(index)
      },
      onEnd: () => {
        if (generation.current !== token) return
        utteranceActive.current = false
        updateCharacterIndex(text.length)
        playingRef.current = false
        setPlaying(false)
        onPlayingChange(false)
      },
      onError: () => {
        if (generation.current !== token) return
        utteranceActive.current = false
        playingRef.current = false
        setPlaying(false)
        onPlayingChange(false)
      },
    })

    if (!success) {
      utteranceActive.current = false
      playingRef.current = false
      setPlaying(false)
      onPlayingChange(false)
    }
  }

  const play = () => {
    if (utteranceActive.current && window.speechSynthesis.paused) {
      baseCharacter.current = characterIndexRef.current
      segmentStartedAt.current = performance.now()
      window.speechSynthesis.resume()
      playingRef.current = true
      setPlaying(true)
      onPlayingChange(true)
      return
    }
    startAt(characterIndexRef.current >= text.length ? 0 : characterIndexRef.current)
  }

  const pause = () => {
    if (!playingRef.current) return
    const elapsedSeconds = (performance.now() - segmentStartedAt.current) / 1000
    updateCharacterIndex(baseCharacter.current + elapsedSeconds * estimatedCharactersPerSecond * rateRef.current)
    window.speechSynthesis.pause()
    playingRef.current = false
    setPlaying(false)
    onPlayingChange(false)
  }

  const stop = () => {
    generation.current += 1
    stopSpeaking()
    utteranceActive.current = false
    playingRef.current = false
    updateCharacterIndex(0)
    setPlaying(false)
    onPlayingChange(false)
  }

  const seekTo = (percentage: number) => {
    const target = Math.round(text.length * percentage / 100)
    let offset = Math.max(0, Math.min(text.length, target))
    if (percentage < 100) {
      while (offset > 0 && !/\s/.test(text[offset - 1])) offset -= 1
    }
    const resumeAfterSeek = playingRef.current
    generation.current += 1
    stopSpeaking()
    utteranceActive.current = false
    playingRef.current = false
    setPlaying(false)
    onPlayingChange(false)
    setSeekDraft(null)
    updateCharacterIndex(offset)
    if (resumeAfterSeek && offset < text.length) startAt(offset)
  }

  const changeRate = (nextRate: number) => {
    rateRef.current = nextRate
    setRate(nextRate)
    if (!utteranceActive.current) return

    const currentIndex = characterIndexRef.current
    const resumeAfterChange = playingRef.current
    generation.current += 1
    stopSpeaking()
    utteranceActive.current = false
    playingRef.current = false
    setPlaying(false)
    onPlayingChange(false)
    startAt(currentIndex)
    if (!resumeAfterChange) {
      window.speechSynthesis.pause()
      playingRef.current = false
      setPlaying(false)
      onPlayingChange(false)
    }
  }

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      const elapsedSeconds = (performance.now() - segmentStartedAt.current) / 1000
      updateCharacterIndex(baseCharacter.current + elapsedSeconds * estimatedCharactersPerSecond * rateRef.current)
    }, 120)
    return () => window.clearInterval(timer)
  }, [playing])

  useEffect(() => {
    if (!playing) return
    const activeSegment = segmentRefs.current[activeSegmentIndex]
    if (!activeSegment) return
    const container = transcriptRef.current
    if (!container) return
    const segmentTop = activeSegment.offsetTop - container.offsetTop
    const segmentBottom = segmentTop + activeSegment.offsetHeight
    if (segmentTop < container.scrollTop || segmentBottom > container.scrollTop + container.clientHeight) {
      container.scrollTo({ top: segmentTop - container.clientHeight / 2, behavior: 'smooth' })
    }
  }, [activeSegmentIndex, playing])

  useEffect(() => () => {
    generation.current += 1
    utteranceActive.current = false
    stopSpeaking()
    onPlayingChange(false)
  }, [onPlayingChange])

  const progress = seekDraft ?? (text.length ? characterIndex / text.length * 100 : 0)
  const totalSeconds = text.length / estimatedCharactersPerSecond / rate
  const currentSeconds = characterIndex / estimatedCharactersPerSecond / rate

  return (
    <div className="audio-player" aria-label={translate(language, 'play')}>
      <div className="audio-player-controls">
        <button
          type="button"
          className="audio-play-button"
          onClick={playing ? pause : play}
          disabled={!speechAvailable()}
          aria-label={translate(language, playing ? 'pause' : 'play')}
        >
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <button type="button" className="audio-stop-button" onClick={stop} disabled={!playing && characterIndex === 0} aria-label={translate(language, 'stop')}>
          <Square size={13} fill="currentColor" />
        </button>
        <span className="audio-time">{formatTime(currentSeconds)} / ~{formatTime(totalSeconds)}</span>
        <label className="audio-speed">
          <span>{translate(language, 'speechSpeed')}</span>
          <select aria-label={translate(language, 'speechSpeed')} value={rate} onChange={(event) => changeRate(Number(event.target.value))}>
            {playbackRates.map((value) => <option key={value} value={value}>{value}x</option>)}
          </select>
        </label>
      </div>
      <input
        className="audio-progress"
        type="range"
        min="0"
        max="100"
        step="0.1"
        value={progress}
        aria-label={translate(language, 'play')}
        aria-valuetext={`${Math.round(progress)}%`}
        style={{ '--audio-progress': `${progress}%` } as CSSProperties}
        onChange={(event) => setSeekDraft(Number(event.target.value))}
        onPointerUp={() => { if (seekDraft !== null) seekTo(seekDraft) }}
        onKeyUp={() => { if (seekDraft !== null) seekTo(seekDraft) }}
        onBlur={() => { if (seekDraft !== null) seekTo(seekDraft) }}
      />
      <div className="audio-transcript" ref={transcriptRef} aria-label={translate(language, 'liveTranscript')}>
        {transcriptSegments.map((segment, index) => (
          <p
            className={`audio-transcript-line${index === activeSegmentIndex ? ' active' : ''}`}
            key={`${segment.start}-${segment.end}`}
            ref={(element) => { segmentRefs.current[index] = element }}
            aria-current={index === activeSegmentIndex ? 'true' : undefined}
          >
            {segment.text}
          </p>
        ))}
      </div>
      {!speechAvailable() && <p className="inline-warning">{translate(language, 'speechUnsupported')}</p>}
    </div>
  )
}

function splitTranscript(text: string) {
  const segments: { start: number; end: number; text: string }[] = []
  const sentencePattern = /[^.!?。！？]+[.!?。！？]*/g
  for (const match of text.matchAll(sentencePattern)) {
    const raw = match[0]
    const trimmed = raw.trim()
    if (!trimmed || match.index === undefined) continue
    const leadingWhitespace = raw.length - raw.trimStart().length
    const start = match.index + leadingWhitespace
    segments.push({ start, end: start + trimmed.length, text: trimmed })
  }
  return segments
}

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
