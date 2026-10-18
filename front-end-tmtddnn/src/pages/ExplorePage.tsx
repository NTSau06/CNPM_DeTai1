import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownRight, ArrowRight, BookmarkPlus, ChevronRight, Clock3, Compass, LocateFixed, MapPin, Search, Sparkles, Volume2 } from 'lucide-react'
import { distance, point } from '@turf/turf'
import { NavLink } from 'react-router-dom'
import { NarrationCard } from '../components/NarrationCard'
import { categoryKeys, categoryLabels, findPlace, languages, localizedTitle, places as bundledPlaces } from '../data/places'
import { translate } from '../i18n'
import { speak, speechAvailable } from '../speech'
import { useAppStore } from '../store'
import type { Category } from '../types'

const MapView = lazy(() => import('../components/MapView').then((module) => ({ default: module.MapView })))

export function ExplorePage() {
  const language = useAppStore((state) => state.language)
  const places = useAppStore((state) => state.places)
  const selectedPlaceId = useAppStore((state) => state.selectedPlaceId)
  const setSelectedPlace = useAppStore((state) => state.setSelectedPlace)
  const routeIds = useAppStore((state) => state.routeIds)
  const savedTours = useAppStore((state) => state.savedTours)
  const location = useAppStore((state) => state.location)
  const setLocation = useAppStore((state) => state.setLocation)
  const autoNarration = useAppStore((state) => state.autoNarration)
  const setAutoNarration = useAppStore((state) => state.setAutoNarration)
  const saveCurrentTour = useAppStore((state) => state.saveCurrentTour)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [gpsMessage, setGpsMessage] = useState('')
  const spokenPlaces = useRef(new Set<string>())
  const watchId = useRef<number | null>(null)
  const selectedPlace = findPlace(selectedPlaceId) ?? places[0] ?? bundledPlaces[0]
  const selectedLanguage = languages.find((item) => item.code === language)

  const filteredPlaces = useMemo(() => places.filter((place) => {
    const title = localizedTitle(place, language).toLowerCase()
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || title.includes(query) || place.copy.vi.title.toLowerCase().includes(query) || place.copy.en.title.toLowerCase().includes(query)
    return matchesSearch && (category === 'all' || place.category === category)
  }), [places, language, search, category])

  const distanceMeters = location
    ? distance(point(location), point(selectedPlace.coordinates), { units: 'meters' })
    : null

  useEffect(() => {
    if (!autoNarration || !location) return
    const nearby = places.find((place) => distance(point(location), point(place.coordinates), { units: 'meters' }) < 85)
    if (!nearby || spokenPlaces.current.has(nearby.id)) return
    spokenPlaces.current.add(nearby.id)
    setSelectedPlace(nearby.id)
    if (speechAvailable()) speak(nearby.copy[language].narration, language)
  }, [location, autoNarration, places, language, setSelectedPlace])

  useEffect(() => () => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel() }, [])

  useEffect(() => {
    if (!autoNarration && watchId.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [autoNarration])

  useEffect(() => () => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current)
    useAppStore.getState().setAutoNarration(false)
  }, [])

  const startWalk = () => {
    if (!navigator.geolocation) {
      setGpsMessage(translate(language, 'gpsUnsupported'))
      return
    }
    if (watchId.current !== null) return
    setGpsMessage('')
    spokenPlaces.current.clear()
    spokenPlaces.current.add(selectedPlace.id)
    setAutoNarration(true)
    if (speechAvailable()) speak(selectedPlace.copy[language].narration, language)
    watchId.current = navigator.geolocation.watchPosition(
      (position) => setLocation([position.coords.longitude, position.coords.latitude]),
      () => setGpsMessage(translate(language, 'gpsError')),
      { enableHighAccuracy: true, maximumAge: 15000 },
    )
  }

  const stopWalk = () => setAutoNarration(false)

  const routePlaces = routeIds.map((id) => places.find((place) => place.id === id)).filter((place) => place !== undefined)
  const routeDistance = routePlaces.length > 1 ? routePlaces.reduce((total, place, index) => {
    if (index === 0) return total
    const previous = routePlaces[index - 1]
    return total + distance(point(previous.coordinates), point(place.coordinates), { units: 'kilometers' })
  }, 0) : 0

  return (
    <div className="explore-page">
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" />{translate(language, 'greeting')}</div>
          <h1>{translate(language, 'title')}</h1>
          <p>{translate(language, 'introduction')}</p>
        </div>
        <div className="welcome-stamp"><span>17°10′</span><small>QUẢNG TRỊ<br />QUẢNG BÌNH</small><span className="stamp-flower">✳</span></div>
      </section>

      <div className="explore-grid">
        <section className="map-column">
          <div className="map-search-bar">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={translate(language, 'search')} aria-label={translate(language, 'search')} />
            <button className="search-filter" onClick={() => setCategory('all')} aria-label={translate(language, 'all')}><Sparkles size={16} /></button>
          </div>
          <div className="map-category-row">
            <button className={`filter-chip${category === 'all' ? ' selected' : ''}`} onClick={() => setCategory('all')}>{translate(language, 'all')}</button>
            {categoryKeys.map((key) => <button key={key} className={`filter-chip${category === key ? ' selected' : ''}`} onClick={() => setCategory(category === key ? 'all' : key)}>{categoryLabels[language][key]}</button>)}
            <div className="map-view-toggle"><span className="view-active"><MapPin size={13} />{translate(language, 'map')}</span></div>
          </div>
          <Suspense fallback={<div className="map-stage map-loading">{translate(language, 'preparing')}</div>}>
            <MapView places={filteredPlaces} language={language} selectedPlaceId={selectedPlaceId} onSelectPlace={setSelectedPlace} />
          </Suspense>
          {gpsMessage && <p role="alert" className="gps-message">{gpsMessage}</p>}
          <div className="under-map-row">
            <span><span className="map-pin-key" /> {translate(language, 'nearby')} <strong>{filteredPlaces.length.toString().padStart(2, '0')}</strong></span>
            <button className="locate-link" onClick={startWalk}><LocateFixed size={14} /> {translate(language, 'locate')}</button>
          </div>
        </section>

        <aside className="places-column">
          <div className="places-head">
            <div><div className="eyebrow small"><span className="eyebrow-line" /> QUANG TRI · QUANG BINH</div><h2>{translate(language, 'nearby')}</h2></div>
            <span className="count-badge">{filteredPlaces.length}</span>
          </div>
          <div className="place-list">
            {filteredPlaces.map((place, index) => {
              const active = selectedPlace.id === place.id
              return (
                <button key={place.id} className={`place-row${active ? ' active' : ''}`} onClick={() => setSelectedPlace(place.id)}>
                  <span className={`place-number ${active ? 'active' : ''}`}>{String(index + 1).padStart(2, '0')}</span>
                  <span className="place-row-copy">
                    <strong>{localizedTitle(place, language)}</strong>
                    <small>{place.copy[language].subtitle}</small>
                    <span className="place-meta"><Clock3 size={12} /> {place.duration} {translate(language, 'minute')} <i /> {categoryLabels[language][place.category]}</span>
                  </span>
                  <ChevronRight className="place-chevron" size={16} />
                </button>
              )
            })}
            {filteredPlaces.length === 0 && <div className="empty-search">{translate(language, 'noResults')}</div>}
          </div>
          <NavLink to="/saved" className="all-stops-link">{translate(language, 'savedTitle')} <ArrowRight size={14} /></NavLink>
          <div className="side-quote">
            <span>“</span><p>Đi chậm để nghe miền đất kể chuyện.</p><small>NOTES FROM THE REGION</small>
          </div>
        </aside>
      </div>

      <div className="detail-grid">
        <details className="place-detail-page">
        <summary className="selected-place-panel">
          <div className={`place-illustration illustration-${selectedPlace.image}`}>
            <span className="illustration-flag">A SMALL STORY</span>
            <div className="illustration-number">0{places.findIndex((place) => place.id === selectedPlace.id) + 1}</div>
            <ArrowDownRight className="illustration-arrow" size={24} />
          </div>
          <div className="selected-place-copy">
            <span className="selected-kicker">{categoryLabels[language][selectedPlace.category]} <i /> {selectedPlace.duration} {translate(language, 'minute')}</span>
            <h2>{localizedTitle(selectedPlace, language)}</h2>
            <p>{selectedPlace.copy[language].subtitle}</p>
            <span className="selected-location"><MapPin size={13} /> QUẢNG TRỊ · QUẢNG BÌNH</span>
          </div>
        </summary>
        <article className="place-detail-content">
          <div className="place-detail-heading">
            <span className="eyebrow"><span className="eyebrow-line" /> {categoryLabels[language][selectedPlace.category]} · {selectedPlace.duration} {translate(language, 'minute')}</span>
            <h1>{localizedTitle(selectedPlace, language)}</h1>
            <p>{selectedPlace.copy[language].subtitle}</p>
            <span className="selected-location"><MapPin size={13} /> QUẢNG TRỊ · QUẢNG BÌNH</span>
          </div>
          <section className="place-language-card" lang={language}>
            <h2>{selectedLanguage?.label ?? language}</h2>
            <h3>{selectedPlace.copy[language].title}</h3>
            <p className="place-language-subtitle">{selectedPlace.copy[language].subtitle}</p>
            <p>{selectedPlace.copy[language].narration}</p>
          </section>
        </article>
        </details>
        <NarrationCard place={selectedPlace} language={language} distanceMeters={distanceMeters} onStartWalk={startWalk} onStopWalk={stopWalk} />
      </div>

      {routeIds.length > 0 && (
        <section className="route-summary">
          <div className="route-summary-icon"><BookmarkPlus size={18} /></div>
          <div className="route-summary-copy"><strong>{translate(language, 'route')} <span>·</span> {routeIds.length} {translate(language, 'stopCount')}</strong><small>{routeDistance.toFixed(1)} {translate(language, 'distanceUnit')} <span>·</span> {routePlaces.reduce((total, place) => total + place.duration, 0)} {translate(language, 'minute')}</small></div>
          <button onClick={async () => { if (await saveCurrentTour()) setGpsMessage(translate(language, 'routeSaved')) }} className="save-route-button">{translate(language, 'saveRoute')} <ArrowRight size={15} /></button>
        </section>
      )}
      {gpsMessage === translate(language, 'routeSaved') && <p className="route-saved-message" role="status">{gpsMessage}</p>}

      <button className={`walk-fab${autoNarration ? ' is-active' : ''}`} onClick={autoNarration ? stopWalk : startWalk}>
        {autoNarration ? <Volume2 size={17} /> : <Compass size={17} />}
        {translate(language, autoNarration ? 'autoOn' : 'startWalk')}
      </button>
      {savedTours.length > 0 && <span className="sr-only">{savedTours.length} saved walks</span>}
    </div>
  )
}
