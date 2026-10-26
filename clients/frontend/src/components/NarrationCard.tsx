// Trình bày nội dung thuyết minh và điều khiển hướng dẫn đi bộ tại địa điểm.
import { useEffect, useState } from 'react'
import { Headphones, Plus, Radio } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { languages } from '../data/places'
import { translate } from '../i18n'
import { getOfflinePlacePack } from '../db'
import { getNarrationAudioUrl, getNarrationText, stopSpeaking } from '../speech'
import { useAppStore } from '../store'
import type { Language, Place } from '../types'
import { AudioPlayer } from './AudioPlayer'

interface NarrationCardProps {
  place: Place
  language: Language
  distanceMeters: number | null
  onStartWalk: () => void
  onStopWalk: () => void
}

export function NarrationCard({ place, language, distanceMeters, onStartWalk, onStopWalk }: NarrationCardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [playing, setPlaying] = useState(false)
  const [audioLanguage, setAudioLanguage] = useState(language)
  const [savedNarration, setSavedNarration] = useState<string | null>(null)
  const autoNarration = useAppStore((state) => state.autoNarration)
  const currentUser = useAppStore((state) => state.currentUser)
  const routeIds = useAppStore((state) => state.routeIds)
  const isSavingRoute = useAppStore((state) => state.isSavingRoute)
  const setRoutePlace = useAppStore((state) => state.setRoutePlace)
  const isInRoute = routeIds.includes(place.id)
  const audioCopy = place.copy[audioLanguage] ?? place.copy.vi
  const localNarration = getNarrationText(place, audioLanguage)
  const audioText = savedNarration && savedNarration.length > localNarration.length
    ? savedNarration
    : localNarration
  const estimatedMinutes = Math.max(1, Math.ceil(audioText.length / 14 / 60))

  const changeRoute = () => {
    if (!currentUser) {
      navigate('/login', {
        state: {
          returnTo: `${location.pathname}${location.search}`,
          pendingPlaceId: place.id,
        },
      })
      return
    }
    void setRoutePlace(place.id)
  }

  useEffect(() => {
    let active = true
    setSavedNarration(null)
    void getOfflinePlacePack(place.id, audioLanguage)
      .then((pack) => { if (active) setSavedNarration(pack?.narration ?? null) })
      .catch(() => { if (active) setSavedNarration(null) })
    return () => { active = false }
  }, [place.id, audioLanguage])

  return (
    <section className="narration-card" aria-label={translate(language, 'play')}>
      <div className="narration-head">
        <div className="narration-label"><Headphones size={14} /> AUDIO WALK <span className="duration-dot">·</span> ~{estimatedMinutes} {translate(language, 'minute')}</div>
        <div className="narration-head-actions">
          <label className="audio-language">
            <span>{translate(language, 'audioLanguage')}</span>
            <select
              aria-label={translate(language, 'audioLanguage')}
              value={audioLanguage}
              onChange={(event) => {
                stopSpeaking()
                setPlaying(false)
                setAudioLanguage(event.target.value as Language)
              }}
            >
              {languages.map((item) => <option key={item.code} value={item.code}>{item.flag} {item.label}</option>)}
            </select>
          </label>
          <span className="now-playing"><span className={playing ? 'sound-bars is-playing' : 'sound-bars'}><i /><i /><i /><i /></span>{playing ? 'NOW PLAYING' : 'AUDIO GUIDE'}</span>
        </div>
      </div>
      <p className="narration-copy">{audioCopy.narration}</p>
      {distanceMeters !== null && <div className="distance-note"><span className="distance-line" />{translate(language, 'distance')} <strong>{distanceMeters < 1000 ? `${Math.round(distanceMeters)} m` : `${(distanceMeters / 1000).toFixed(1)} km`}</strong></div>}
      <div className="narration-actions">
        <AudioPlayer
          key={`${place.id}:${audioLanguage}`}
          text={audioText}
          language={language}
          speechLanguage={audioLanguage}
          audioSrc={getNarrationAudioUrl(place.id, audioLanguage)}
          onPlayingChange={setPlaying}
        />
        <button className={`route-button${isInRoute ? ' in-route' : ''}`} onClick={changeRoute} disabled={isSavingRoute}>
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
