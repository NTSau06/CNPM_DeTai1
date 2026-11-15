// Phát lời thuyết minh qua giọng đọc trình duyệt, hỗ trợ tua và đổi tốc độ.
import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import { ui } from '../uiText'
import { languages } from '../data/places'
import { translate } from '../i18n'
import { beginPlayback, claimAudioPlayback, isPlaybackCurrent, prepareSpeech, speakFrom, speechAvailable, stopSpeaking } from '../speech'
import type { Language } from '../types'
import type { CSSProperties } from 'react'

const playbackRates = [0.75, 1, 1.25, 1.5]

interface AudioPlayerProps {
  text: string
  vietnameseText: string
  language: Language
  speechLanguage: Language
  audioSrc?: string
  estimatedDurationSeconds?: number
  onPlayingChange: (playing: boolean) => void
}

export function AudioPlayer({ text: originalText, vietnameseText, language, speechLanguage, audioSrc, estimatedDurationSeconds, onPlayingChange }: AudioPlayerProps) {
  const [preparedSpeech, setPreparedSpeech] = useState<{ text: string; language: Language; fallback: boolean } | null>(null)
  const [voiceMessage, setVoiceMessage] = useState('')
  const text = preparedSpeech?.text ?? originalText
  const resolvedSpeech = useRef<{ text: string; language: Language; fallback: boolean } | null>(null)
  const estimatedCharactersPerSecond = estimatedDurationSeconds ? text.length / estimatedDurationSeconds : 14
  const [mediaDuration, setMediaDuration] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [characterIndex, setCharacterIndex] = useState(0)
  const [seekDraft, setSeekDraft] = useState<number | null>(null)
  const [audioFileFailed, setAudioFileFailed] = useState(false)
  const characterIndexRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const generation = useRef(0)
  const playbackToken = useRef<number | null>(null)
  const audioFailed = useRef(false)
  const utteranceActive = useRef(false)
  const baseCharacter = useRef(0)
  const segmentStartedAt = useRef(0)
  const rateRef = useRef(rate)
  const playingRef = useRef(playing)
  const useAudioFile = Boolean(audioSrc && !audioFileFailed)

  const updateCharacterIndex = (value: number) => {
    const next = Math.max(0, Math.min(resolvedSpeech.current?.text.length ?? text.length, value))
    characterIndexRef.current = next
    setCharacterIndex(next)
  }

  const onPlaybackStopped = () => {
    utteranceActive.current = false
    playingRef.current = false
    setPlaying(false)
    onPlayingChange(false)
  }

  const startAt = async (offset: number) => {
    const token = ++generation.current
    const playback = beginPlayback(onPlaybackStopped)
    playbackToken.current = playback
    const prepared = resolvedSpeech.current ?? await prepareSpeech(speechLanguage, originalText, vietnameseText)
    if (generation.current !== token || !isPlaybackCurrent(playback)) return
    if (!prepared) { setVoiceMessage(ui(language, 'voiceMissing')); return }
    if (!resolvedSpeech.current) {
      resolvedSpeech.current = prepared
      setPreparedSpeech(prepared)
      setVoiceMessage(prepared.fallback ? ui(language, 'voiceFallback', { name: languages.find((item) => item.code === speechLanguage)?.label ?? speechLanguage }) : '')
      if (prepared.fallback) offset = 0
    }
    const text = prepared.text
    const start = Math.max(0, Math.min(text.length, offset))
    baseCharacter.current = start
    segmentStartedAt.current = performance.now()
    updateCharacterIndex(start)
    utteranceActive.current = true
    onPlayingChange(true)
    playingRef.current = true
    setPlaying(true)

    const success = speakFrom(text, prepared.language, rateRef.current, start, {
      onBoundary: (index) => {
        if (generation.current !== token || !isPlaybackCurrent(playback)) return
        baseCharacter.current = index
        segmentStartedAt.current = performance.now()
        updateCharacterIndex(index)
      },
      onEnd: () => {
        if (generation.current !== token || !isPlaybackCurrent(playback)) return
        utteranceActive.current = false
        updateCharacterIndex(text.length)
        playingRef.current = false
        setPlaying(false)
        onPlayingChange(false)
      },
      onError: () => {
        if (generation.current !== token || !isPlaybackCurrent(playback)) return
        setVoiceMessage(ui(language, 'voiceMissing'))
        utteranceActive.current = false
        playingRef.current = false
        setPlaying(false)
        onPlayingChange(false)
      },
    })

    if (!success) {
      setVoiceMessage(ui(language, 'voiceMissing'))
      utteranceActive.current = false
      playingRef.current = false
      setPlaying(false)
      onPlayingChange(false)
    }
  }

  const playAudioFile = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audioFailed.current) { void startAt(characterIndexRef.current); return }
    const token = ++generation.current
    const position = audio.ended ? 0 : audio.currentTime
    const playback = claimAudioPlayback(audio, onPlaybackStopped)
    playbackToken.current = playback
    audio.currentTime = position
    audio.playbackRate = rateRef.current
    playingRef.current = true
    setPlaying(true)
    onPlayingChange(true)
    void audio.play().catch(() => {
      if (generation.current !== token || !isPlaybackCurrent(playback) || audioFailed.current) return
      audioFailed.current = true
      setAudioFileFailed(true)
      void startAt(characterIndexRef.current)
    })
  }

  const play = () => {
    if (useAudioFile) {
      playAudioFile()
      return
    }
    if (utteranceActive.current && isPlaybackCurrent(playbackToken.current) && window.speechSynthesis.paused) {
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
    if (!isPlaybackCurrent(playbackToken.current)) {
      playingRef.current = false
      setPlaying(false)
      onPlayingChange(false)
      return
    }
    if (useAudioFile) {
      generation.current += 1
      audioRef.current?.pause()
      playingRef.current = false
      setPlaying(false)
      onPlayingChange(false)
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
    if (isPlaybackCurrent(playbackToken.current)) stopSpeaking()
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
    if (isPlaybackCurrent(playbackToken.current)) stopSpeaking()
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
    if (isPlaybackCurrent(playbackToken.current)) stopSpeaking()
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
    if (!audioSrc || audioFailed.current) return
    audioFailed.current = true
    setAudioFileFailed(true)
    if (playingRef.current && isPlaybackCurrent(playbackToken.current)) void startAt(characterIndexRef.current)
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
    if (isPlaybackCurrent(playbackToken.current)) stopSpeaking()
    audioRef.current?.pause()
    onPlayingChange(false)
  }, [onPlayingChange])

  const audio = audioRef.current
  const progress = seekDraft ?? (useAudioFile && audio && audio.duration > 0
    ? audio.currentTime / audio.duration * 100
    : text.length ? characterIndex / text.length * 100 : 0)
  const totalSeconds = useAudioFile
    ? mediaDuration ?? estimatedDurationSeconds ?? text.length / estimatedCharactersPerSecond
    : text.length / estimatedCharactersPerSecond
  const currentSeconds = useAudioFile && audio
    ? audio.currentTime
    : characterIndex / estimatedCharactersPerSecond

  return (
    <div className="audio-player" aria-label={translate(language, 'play')}>
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onLoadedMetadata={() => {
            const duration = audioRef.current?.duration
            if (duration && Number.isFinite(duration)) setMediaDuration(duration)
          }}
          onPlay={() => {
            if (audioFailed.current || !isPlaybackCurrent(playbackToken.current)) { audioRef.current?.pause(); return }
            playingRef.current = true
            setPlaying(true)
            onPlayingChange(true)
          }}
          onPause={() => {
            if (audioFailed.current) return
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
        <span className="audio-time">{formatTime(currentSeconds)} / {useAudioFile && mediaDuration ? '' : '~'}{formatTime(totalSeconds)}</span>
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
      {voiceMessage && <p className="inline-warning" role="status">{voiceMessage}</p>}
      {!useAudioFile && !speechAvailable() && <p className="inline-warning">{translate(language, 'speechUnsupported')}</p>}
    </div>
  )
}

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
