// Phát lời thuyết minh qua giọng đọc trình duyệt, hỗ trợ tua và đổi tốc độ.
import { useEffect, useRef, useState } from 'react'
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
  audioSrc?: string
  onPlayingChange: (playing: boolean) => void
}

export function AudioPlayer({ text, language, speechLanguage, audioSrc, onPlayingChange }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [characterIndex, setCharacterIndex] = useState(0)
  const [seekDraft, setSeekDraft] = useState<number | null>(null)
  const [audioFileFailed, setAudioFileFailed] = useState(false)
  const characterIndexRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const generation = useRef(0)
  const utteranceActive = useRef(false)
  const baseCharacter = useRef(0)
  const segmentStartedAt = useRef(0)
  const rateRef = useRef(rate)
  const playingRef = useRef(playing)
  const useAudioFile = Boolean(audioSrc && !audioFileFailed)

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

  const playAudioFile = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.ended) audio.currentTime = 0
    audio.playbackRate = rateRef.current
    void audio.play().catch(() => {
      setAudioFileFailed(true)
      startAt(characterIndexRef.current)
    })
  }

  const play = () => {
    if (useAudioFile) {
      playAudioFile()
      return
    }
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
    if (useAudioFile) {
      audioRef.current?.pause()
      return
    }
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
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    utteranceActive.current = false
    playingRef.current = false
    updateCharacterIndex(0)
    setPlaying(false)
    onPlayingChange(false)
  }

  const seekTo = (percentage: number) => {
    if (useAudioFile) {
      const audio = audioRef.current
      if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return
      const resumeAfterSeek = playingRef.current
      audio.currentTime = audio.duration * percentage / 100
      setSeekDraft(null)
      updateCharacterIndex(Math.round(text.length * percentage / 100))
      if (resumeAfterSeek) playAudioFile()
      return
    }
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
    if (useAudioFile) {
      if (audioRef.current) audioRef.current.playbackRate = nextRate
      return
    }
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
    if (useAudioFile) return
    const timer = window.setInterval(() => {
      const elapsedSeconds = (performance.now() - segmentStartedAt.current) / 1000
      updateCharacterIndex(baseCharacter.current + elapsedSeconds * estimatedCharactersPerSecond * rateRef.current)
    }, 120)
    return () => window.clearInterval(timer)
  }, [playing, useAudioFile])

  const updateAudioProgress = () => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return
    updateCharacterIndex(Math.round(text.length * audio.currentTime / audio.duration))
  }

  const handleAudioError = () => {
    if (!audioSrc || audioFileFailed) return
    setAudioFileFailed(true)
    if (playingRef.current) startAt(characterIndexRef.current)
  }

  const handleAudioEnded = () => {
    updateCharacterIndex(text.length)
    playingRef.current = false
    setPlaying(false)
    onPlayingChange(false)
  }

  useEffect(() => () => {
    generation.current += 1
    utteranceActive.current = false
    stopSpeaking()
    onPlayingChange(false)
  }, [onPlayingChange])

  const audio = audioRef.current
  const progress = seekDraft ?? (useAudioFile && audio && audio.duration > 0
    ? audio.currentTime / audio.duration * 100
    : text.length ? characterIndex / text.length * 100 : 0)
  const totalSeconds = useAudioFile && audio && Number.isFinite(audio.duration)
    ? audio.duration
    : text.length / estimatedCharactersPerSecond / rate
  const currentSeconds = useAudioFile && audio
    ? audio.currentTime
    : characterIndex / estimatedCharactersPerSecond / rate

  return (
    <div className="audio-player" aria-label={translate(language, 'play')}>
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onPlay={() => {
            playingRef.current = true
            setPlaying(true)
            onPlayingChange(true)
          }}
          onPause={() => {
            playingRef.current = false
            setPlaying(false)
            onPlayingChange(false)
          }}
          onTimeUpdate={updateAudioProgress}
          onEnded={handleAudioEnded}
          onError={handleAudioError}
        />
      )}
      <div className="audio-player-controls">
        <button
          type="button"
          className="audio-play-button"
          onClick={playing ? pause : play}
          disabled={!useAudioFile && !speechAvailable()}
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
      {!speechAvailable() && <p className="inline-warning">{translate(language, 'speechUnsupported')}</p>}
    </div>
  )
}

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
