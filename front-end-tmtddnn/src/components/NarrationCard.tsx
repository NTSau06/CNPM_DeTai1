import { useEffect, useState } from 'react'
import { Headphones, Pause, Play, Plus, Radio, Square } from 'lucide-react'
import { translate } from '../i18n'
import { speak, speechAvailable, stopSpeaking } from '../speech'
import { useAppStore } from '../store'
import type { Language, Place } from '../types'

interface NarrationCardProps {
  place: Place
  language: Language
  distanceMeters: number | null
  onStartWalk: () => void
  onStopWalk: () => void
}

export function NarrationCard({ place, language, distanceMeters, onStartWalk, onStopWalk }: NarrationCardProps) {
  const [playing, setPlaying] = useState(false)
  const autoNarration = useAppStore((state) => state.autoNarration)
  const routeIds = useAppStore((state) => state.routeIds)
  const toggleRoutePlace = useAppStore((state) => state.toggleRoutePlace)
  const copy = place.copy[language] ?? place.copy.vi

  useEffect(() => () => stopSpeaking(), [])

  const play = () => {
    const success = speak(copy.narration, language, () => setPlaying(false))
    if (success) {
      setPlaying(true)
    }
  }
  const isInRoute = routeIds.includes(place.id)

  return (
    <section className="narration-card" aria-label={translate(language, 'play')}>
      <div className="narration-head">
        <div className="narration-label"><Headphones size={14} /> AUDIO WALK <span className="duration-dot">·</span> {place.duration} {translate(language, 'minute')}</div>
        <span className="now-playing"><span className={playing ? 'sound-bars is-playing' : 'sound-bars'}><i /><i /><i /><i /></span>{playing ? 'NOW PLAYING' : 'AUDIO GUIDE'}</span>
      </div>
      <p className="narration-copy">{copy.narration}</p>
      {!speechAvailable() && <p className="inline-warning">{translate(language, 'speechUnsupported')}</p>}
      {distanceMeters !== null && <div className="distance-note"><span className="distance-line" />{translate(language, 'distance')} <strong>{distanceMeters < 1000 ? `${Math.round(distanceMeters)} m` : `${(distanceMeters / 1000).toFixed(1)} km`}</strong></div>}
      <div className="narration-actions">
        <button className="play-button" onClick={playing ? () => { window.speechSynthesis.pause(); setPlaying(false) } : play} disabled={!speechAvailable()}>
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          {playing ? translate(language, 'pause') : translate(language, 'play')}
        </button>
        {playing && <button className="icon-button" onClick={() => { stopSpeaking(); setPlaying(false) }} aria-label={translate(language, 'stop')}><Square size={15} fill="currentColor" /></button>}
        <button className={`route-button${isInRoute ? ' in-route' : ''}`} onClick={() => toggleRoutePlace(place.id)}>
          {isInRoute ? <Radio size={15} /> : <Plus size={16} />}
          {translate(language, isInRoute ? 'removeRoute' : 'addRoute')}
        </button>
      </div>
      {autoNarration && <span className="auto-status"><span className="pulse-dot" /> {translate(language, 'autoOn')}</span>}
      <button
        className="narration-auto-toggle"
        onClick={() => {
          if (autoNarration) {
            stopSpeaking()
            setPlaying(false)
            onStopWalk()
          } else {
            onStartWalk()
          }
        }}
      >
        {translate(language, autoNarration ? 'stopWalk' : 'autoOff')}
      </button>
    </section>
  )
}
