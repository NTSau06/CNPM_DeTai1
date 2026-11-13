// Trang khám phá: tìm/lọc địa điểm, xem bản đồ, GPS, hành trình và thuyết minh.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookmarkPlus, CalendarDays, Camera, ChefHat, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Clock3, Compass, Globe2, Headphones, Heart, Home, Landmark, Leaf, Lightbulb, LoaderCircle, LocateFixed, MapPin, Play, Search, Sparkles, Volume2 } from 'lucide-react'
import { distance, point } from '@turf/turf'
import { NavLink } from 'react-router-dom'
import { getVisitorId, recordVisit } from '../api'
import { NarrationCard } from '../components/NarrationCard'
import { PlaceRatingPanel } from '../components/PlaceRatingPanel'
import { TicketPurchasePanel } from '../components/TicketPurchasePanel'
import { RitualGuidancePanel } from '../components/RitualGuidancePanel'
import { ItineraryPlanner } from '../components/ItineraryPlanner'
import { getOfflinePlacePack } from '../db'
import { getVisitorDetails } from '../data/visitorDetails'
import { categoryKeys, categoryLabels, languages, localizedTitle, places as bundledPlaces } from '../data/places'
import { translate } from '../i18n'
import { ui } from '../uiText'
import { getNarrationAudioUrl, getNarrationText, speakWithAudio, speechAvailable, stopSpeaking } from '../speech'
import { optimizeRouteOrder } from '../routeOptimization'
import { useAppStore } from '../store'
import type { Category } from '../types'
import './explore-home.css'
import './place-detail.css'

const DISCOVER_PREVIEW_COUNT = 6

// Tìm kiếm không phân biệt hoa/thường và dấu tiếng Việt ("dong" khớp "Động").
const normalizeSearch = (value: string) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/\s+/g, ' ')
  .trim()

const scrollToSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const MapView = lazy(() => import('../components/MapView').then((module) => ({ default: module.MapView })))

export function ExplorePage() {
  const language = useAppStore((state) => state.language)
  const places = useAppStore((state) => state.places)
  const selectedPlaceId = useAppStore((state) => state.selectedPlaceId)
  const setSelectedPlace = useAppStore((state) => state.setSelectedPlace)
  const routeIds = useAppStore((state) => state.routeIds)
  const setRouteOrder = useAppStore((state) => state.setRouteOrder)
  const isSavingRoute = useAppStore((state) => state.isSavingRoute)
  const savedTours = useAppStore((state) => state.savedTours)
  const location = useAppStore((state) => state.location)
  const online = useAppStore((state) => state.online)
  const setLocation = useAppStore((state) => state.setLocation)
  const autoNarration = useAppStore((state) => state.autoNarration)
  const setAutoNarration = useAppStore((state) => state.setAutoNarration)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [placesExpanded, setPlacesExpanded] = useState(false)
  const [mapFocusRequest, setMapFocusRequest] = useState(0)
  const [gpsMessage, setGpsMessage] = useState('')
  const [offlineImageUrl, setOfflineImageUrl] = useState<string | null>(null)
  const [optimizingRoute, setOptimizingRoute] = useState(false)
  const [routeOptimizationResult, setRouteOptimizationResult] = useState<{
    routeKey: string
    status: 'optimized' | 'error' | 'offline'
  } | null>(null)
  const spokenPlaces = useRef(new Set<string>())
  const submittedVisits = useRef(new Set<string>())
  const watchId = useRef<number | null>(null)
  const placeDetailsRef = useRef<HTMLDetailsElement>(null)
  const selectedPlace = places.find((place) => place.id === selectedPlaceId) ?? places[0] ?? bundledPlaces[0]
  const visitorDetails = getVisitorDetails(selectedPlace.id, language)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setOfflineImageUrl(null)
    void getOfflinePlacePack(selectedPlace.id, language)
      .then((pack) => {
        if (!active || !pack) return
        objectUrl = URL.createObjectURL(pack.image)
        setOfflineImageUrl(objectUrl)
      })
      .catch(() => {
        if (active) setOfflineImageUrl(null)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selectedPlace.id, language])

  const filteredPlaces = useMemo(() => {
    const query = normalizeSearch(search)
    return places.filter((place) => {
      const haystack = normalizeSearch([
        localizedTitle(place, language),
        place.copy.vi.title,
        place.copy.en.title,
        place.copy[language].subtitle,
        place.copy.vi.subtitle,
        categoryLabels[language][place.category],
      ].join(' '))
      const matchesSearch = !query || query.split(' ').every((word) => haystack.includes(word))
      return matchesSearch && (category === 'all' || place.category === category)
    })
  }, [places, language, search, category])
  const featuredPlaces = useMemo(() => {
    const featuredIds = ['bao-ninh-beach', 'cua-tung-beach', 'da-nhay']
    const preferred = featuredIds
      .map((id) => filteredPlaces.find((place) => place.id === id))
      .filter((place) => place !== undefined)
    return [...preferred, ...filteredPlaces.filter((place) => !featuredIds.includes(place.id))]
  }, [filteredPlaces])
  const discoverPlaces = placesExpanded ? filteredPlaces : featuredPlaces.slice(0, DISCOVER_PREVIEW_COUNT)
  const categoryCounts = useMemo(() => {
    const counts = { landmark: 0, food: 0, craft: 0, rest: 0 } as Record<Category, number>
    for (const place of places) counts[place.category] += 1
    return counts
  }, [places])

  const distanceMeters = location
    ? distance(point(location), point(selectedPlace.coordinates), { units: 'meters' })
    : null

  useEffect(() => {
    if (!autoNarration || !location) return
    const nearby = places.find((place) => distance(point(location), point(place.coordinates), { units: 'meters' }) < 85)
    if (!nearby || spokenPlaces.current.has(nearby.id)) return
    spokenPlaces.current.add(nearby.id)
    setSelectedPlace(nearby.id)
    if (speechAvailable()) speakWithAudio(getNarrationText(nearby, language), language, getNarrationAudioUrl(nearby, language))
  }, [location, autoNarration, places, language, setSelectedPlace])

  useEffect(() => () => stopSpeaking(), [])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && placeDetailsRef.current?.open) placeDetailsRef.current.open = false
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

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
    if (!window.confirm(ui(language, 'gpsConsent'))) return
    if (!navigator.geolocation) {
      setGpsMessage(translate(language, 'gpsUnsupported'))
      return
    }
    if (watchId.current !== null) return
    setGpsMessage('')
    spokenPlaces.current.clear()
    spokenPlaces.current.add(selectedPlace.id)
    setAutoNarration(true)
    if (speechAvailable()) speakWithAudio(getNarrationText(selectedPlace, language), language, getNarrationAudioUrl(selectedPlace, language))
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const coordinates: [number, number] = [position.coords.longitude, position.coords.latitude]
        setLocation(coordinates)
        const day = new Date().toISOString().slice(0, 10)
        for (const place of places) {
          if (distance(point(coordinates), point(place.coordinates), { units: 'meters' }) > 85) continue
          const visitKey = `${place.id}:${day}`
          if (submittedVisits.current.has(visitKey)) continue
          try {
            if (localStorage.getItem(`quang-tri:visit:${visitKey}`)) continue
          } catch {
            setGpsMessage(ui(language, 'visitStateError'))
            continue
          }
          submittedVisits.current.add(visitKey)
          void getVisitorId()
            .then((visitorId) => recordVisit(place.id, visitorId, coordinates))
            .then((recorded) => {
              localStorage.setItem(`quang-tri:visit:${visitKey}`, '1')
              if (recorded) {
                window.dispatchEvent(new CustomEvent('place-visit-recorded', { detail: { placeId: place.id } }))
              }
            })
            .catch(() => {
              submittedVisits.current.delete(visitKey)
              setGpsMessage(ui(language, 'visitRecordError'))
            })
        }
      },
      () => setGpsMessage(translate(language, 'gpsError')),
      { enableHighAccuracy: true, maximumAge: 15000 },
    )
  }

  const stopWalk = () => {
    stopSpeaking()
    setAutoNarration(false)
  }

  const showPlaceDetails = () => {
    const details = placeDetailsRef.current
    if (!details) return
    details.open = true
    details.scrollTop = 0
  }

  const selectFeaturedPlace = (placeId: string) => {
    setSelectedPlace(placeId)
    setMapFocusRequest((request) => request + 1)
    scrollToSection('explore-map')
  }

  const focusPlaceOnMap = (placeId: string) => {
    setSelectedPlace(placeId)
    setMapFocusRequest((request) => request + 1)
  }

  const openPlace = (placeId: string) => {
    setSelectedPlace(placeId)
    showPlaceDetails()
  }

  const closePlaceDetails = () => {
    if (placeDetailsRef.current) placeDetailsRef.current.open = false
  }

  const scrollToPlaceAudio = () => {
    document.getElementById('place-detail-audio')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const viewSelectedPlaceOnMap = () => {
    closePlaceDetails()
    selectFeaturedPlace(selectedPlace.id)
  }

  // Gợi ý: ưu tiên điểm cùng loại hình, sau đó tới các điểm khác.
  const relatedPlaces = places
    .filter((place) => place.id !== selectedPlace.id)
    .sort((first, second) => Number(second.category === selectedPlace.category) - Number(first.category === selectedPlace.category))
    .slice(0, 4)

  const routePlaces = routeIds.map((id) => places.find((place) => place.id === id)).filter((place) => place !== undefined)
  const routeDistance = routePlaces.length > 1 ? routePlaces.reduce((total, place, index) => {
    if (index === 0) return total
    const previous = routePlaces[index - 1]
    return total + distance(point(previous.coordinates), point(place.coordinates), { units: 'kilometers' })
  }, 0) : 0
  const routeKey = routeIds.join('|')
  const visibleOptimizationResult = routeOptimizationResult?.routeKey === routeKey
    ? routeOptimizationResult.status
    : null

  const optimizeRoute = async () => {
    if (routePlaces.length < 2 || optimizingRoute || isSavingRoute) return
    if (!online) {
      setRouteOptimizationResult({ routeKey, status: 'offline' })
      return
    }

    setOptimizingRoute(true)
    setRouteOptimizationResult(null)
    const originalRouteKey = routeKey
    try {
      const hasCurrentLocation = location !== null
      const origin = location ?? routePlaces[0].coordinates
      const stops = hasCurrentLocation ? routePlaces : routePlaces.slice(1)
      const optimizedStops = await optimizeRouteOrder(origin, stops, new AbortController().signal)
      const optimizedIds = hasCurrentLocation
        ? optimizedStops
        : [routePlaces[0].id, ...optimizedStops]
      const saved = await setRouteOrder(optimizedIds)
      if (!saved) {
        setRouteOptimizationResult({ routeKey: originalRouteKey, status: 'error' })
        return
      }
      setRouteOptimizationResult({ routeKey: optimizedIds.join('|'), status: 'optimized' })
    } catch {
      setRouteOptimizationResult({ routeKey: originalRouteKey, status: 'error' })
    } finally {
      setOptimizingRoute(false)
    }
  }

  return (
    <div className="explore-page">
      <section className="explore-hero" id="explore-home">
        <div className="explore-hero-inner">
          <div className="hero-copy">
            <span className="hero-kicker"><Compass size={15} />{ui(language, 'heroKicker')}</span>
            <span className="hero-script">{ui(language, 'heroScript')}</span>
            <h1>{language === 'vi' ? 'Quảng Trị' : translate(language, 'title')}</h1>
            <p>{language === 'vi' ? 'Qua thuyết minh tự động – bằng ngôn ngữ của bạn' : translate(language, 'introduction')}</p>
            <div className="hero-highlights">
              <button type="button" onClick={() => scrollToSection('explore-info')}><Headphones size={17} />{ui(language, 'heroAudio1')}<br />{ui(language, 'heroAudio2')}</button>
              <button type="button" onClick={() => scrollToSection('explore-map')}><MapPin size={17} />{ui(language, 'heroMap1')}<br />{ui(language, 'heroMap2')}</button>
              <button type="button" onClick={() => { setCategory('landmark'); setPlacesExpanded(true); scrollToSection('explore-featured') }}><Landmark size={17} />{ui(language, 'heroLandmarks1')}<br />{ui(language, 'heroLandmarks2')}</button>
            </div>
            <div className="hero-actions">
            <button type="button" className="hero-cta" onClick={() => scrollToSection('explore-map')}>
              <Play size={14} fill="currentColor" />{ui(language, 'startExploring')}<ArrowRight size={15} />
            </button>
            <a className="hero-secondary" href="#explore-featured">{ui(language, 'viewDestinations')}<ChevronRight size={16} /></a>
            </div>
          </div>
          <p className="hero-quote">{ui(language, 'heroQuote1')}<br />{ui(language, 'heroQuote2')}</p>
        </div>
      </section>

      <div className="explore-content">
        <form className="home-search" role="search" onSubmit={(event) => {
          event.preventDefault()
          setPlacesExpanded(true)
          scrollToSection('explore-featured')
        }}>
          <span className="home-search-icon"><MapPin size={23} /></span>
          <label htmlFor="home-destination-search">
            <span>{ui(language, 'searchPrompt')}</span>
            <input id="home-destination-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={translate(language, 'search')} />
          </label>
          <button type="submit"><Search size={18} /><span>{ui(language, 'findDestinations')}</span></button>
        </form>
        <section className="home-section discover-section" id="explore-featured" aria-labelledby="discover-title">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker"><span className="kicker-index">01</span>{ui(language, 'navExplore').toLocaleUpperCase(language)}</span>
              <h2 id="discover-title">{ui(language, 'discoverTitle')}</h2>
            </div>
            <p>{ui(language, 'discoverText')}</p>
          </div>
          <div className="discover-tabs" role="group" aria-label={ui(language, 'filterByType')}>
            <button type="button" aria-pressed={category === 'all'} className={`discover-tab${category === 'all' ? ' selected' : ''}`} onClick={() => setCategory('all')}>
              {translate(language, 'all')}<span>{places.length}</span>
            </button>
            {categoryKeys.map((key) => (
              <button key={key} type="button" aria-pressed={category === key} className={`discover-tab${category === key ? ' selected' : ''}`} onClick={() => setCategory(category === key ? 'all' : key)}>
                {categoryLabels[language][key]}<span>{categoryCounts[key]}</span>
              </button>
            ))}
          </div>
          {discoverPlaces.length > 0 ? (
            <div className="discover-grid">
              {discoverPlaces.map((place, index) => (
                <article key={place.id} className={`dest-card${selectedPlace.id === place.id ? ' active' : ''}`}>
                  <button type="button" className={`dest-card-media illustration-${place.image}`} onClick={() => openPlace(place.id)} aria-label={`${ui(language, 'viewDetails')}: ${localizedTitle(place, language)}`}>
                    <span className="dest-card-badge">{categoryLabels[language][place.category]}</span>
                    <span className="dest-card-index">{String(index + 1).padStart(2, '0')}</span>
                  </button>
                  <div className="dest-card-body">
                    <h3>{localizedTitle(place, language)}</h3>
                    <p>{place.copy[language].subtitle}</p>
                    <span className="dest-card-meta"><Clock3 size={13} /> {place.duration} {translate(language, 'minute')}<i /><Headphones size={13} /> {ui(language, 'hasAudioGuide')}</span>
                    <div className="dest-card-actions">
                      <button type="button" className="dest-card-primary" onClick={() => openPlace(place.id)}><Play size={12} fill="currentColor" />{ui(language, 'listen')}</button>
                      <button type="button" className="dest-card-secondary" onClick={() => selectFeaturedPlace(place.id)}><MapPin size={14} />{ui(language, 'onTheMap')}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-search discover-empty">{translate(language, 'noResults')}</div>
          )}
          {filteredPlaces.length > DISCOVER_PREVIEW_COUNT && (
            <button type="button" className="discover-more" aria-expanded={placesExpanded} onClick={() => setPlacesExpanded((expanded) => !expanded)}>
              {placesExpanded
                ? ui(language, 'showLess')
                : ui(language, 'viewAll', { n: filteredPlaces.length })}
              <ChevronDown className={`places-disclosure${placesExpanded ? ' expanded' : ''}`} size={16} />
            </button>
          )}
        </section>

        <section className="home-section map-section" id="explore-map" aria-labelledby="map-title">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker"><span className="kicker-index">02</span>{ui(language, 'navMap').toLocaleUpperCase(language)}</span>
              <h2 id="map-title">{ui(language, 'mapTitle')}</h2>
            </div>
            <p>{ui(language, 'mapText')}</p>
          </div>
          <div className="explore-grid">
            <div className="map-column">
              <div className="map-search-bar">
                <Search size={17} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={translate(language, 'search')} aria-label={translate(language, 'search')} />
                <button className="search-filter" onClick={() => { setSearch(''); setCategory('all') }} aria-label={translate(language, 'all')}><Sparkles size={16} /></button>
              </div>
              <div className="map-category-row">
                <button aria-pressed={category === 'all'} className={`filter-chip${category === 'all' ? ' selected' : ''}`} onClick={() => setCategory('all')}>{translate(language, 'all')}</button>
                {categoryKeys.map((key) => <button key={key} aria-pressed={category === key} className={`filter-chip${category === key ? ' selected' : ''}`} onClick={() => setCategory(category === key ? 'all' : key)}>{categoryLabels[language][key]}</button>)}
              </div>
              <Suspense fallback={<div className="map-stage map-loading" aria-label={translate(language, 'loading')}><span className="skeleton map-skeleton" /></div>}>
                <MapView
                  places={filteredPlaces}
                  language={language}
                  selectedPlaceId={selectedPlaceId}
                  focusRequest={mapFocusRequest}
                  onSelectPlace={setSelectedPlace}
                  onShowPlaceDetails={showPlaceDetails}
                />
              </Suspense>
              {gpsMessage && <p role="alert" className="gps-message">{gpsMessage}</p>}
              <div className="under-map-row">
                <span><span className="map-pin-key" /> {translate(language, 'nearby')} <strong>{filteredPlaces.length.toString().padStart(2, '0')}</strong></span>
                <button className="locate-link" onClick={startWalk}><LocateFixed size={14} /> {translate(language, 'locate')}</button>
              </div>
            </div>

            <aside className="places-column map-places" aria-labelledby="map-places-title">
              <div className="places-head">
                <div><div className="eyebrow small"><span className="eyebrow-line" /> {ui(language, 'regionName').toLocaleUpperCase(language)}</div><h2 id="map-places-title"><span className="featured-heading-icon"><MapPin size={15} /></span>{ui(language, 'stopsOnMap')}</h2></div>
                <span className="count-badge">{filteredPlaces.length}</span>
              </div>
              <div className="place-list map-place-list">
                {filteredPlaces.map((place, index) => {
                  const active = selectedPlace.id === place.id
                  return (
                    <button key={place.id} type="button" className={`place-row${active ? ' active' : ''}`} aria-current={active ? 'true' : undefined} onClick={() => focusPlaceOnMap(place.id)}>
                      <span className={`featured-place-thumb illustration-${place.image}`} aria-hidden="true" />
                      <span className="place-row-copy">
                        <span className="featured-place-number">{String(index + 1).padStart(2, '0')}</span>
                        <strong>{localizedTitle(place, language)}</strong>
                        <span className="place-meta"><Clock3 size={12} /> {place.duration} {translate(language, 'minute')} <i /> {categoryLabels[language][place.category]}</span>
                      </span>
                    </button>
                  )
                })}
                {filteredPlaces.length === 0 && <div className="empty-search">{translate(language, 'noResults')}</div>}
              </div>
              <button type="button" className="featured-see-all" onClick={showPlaceDetails}>
                {ui(language, 'openSelectedStop')}<ArrowRight size={14} />
              </button>
              <NavLink to="/saved" className="all-stops-link">{translate(language, 'savedTitle')} <ArrowRight size={14} /></NavLink>
            </aside>
          </div>
          {routeIds.length > 0 && (
            <section className="route-summary">
              <div className="route-summary-icon"><BookmarkPlus size={18} /></div>
              <div className="route-summary-copy"><strong>{translate(language, 'route')} <span>·</span> {routeIds.length} {translate(language, 'stopCount')}</strong><small>{routeDistance.toFixed(1)} {translate(language, 'distanceUnit')} <span>·</span> {routePlaces.reduce((total, place) => total + place.duration, 0)} {translate(language, 'minute')}</small></div>
              {routeIds.length > 1 && (
                <button
                  type="button"
                  className="optimize-route-button"
                  onClick={() => void optimizeRoute()}
                  disabled={optimizingRoute || isSavingRoute}
                  aria-busy={optimizingRoute}
                >
                  {optimizingRoute
                    ? <LoaderCircle className="loading-spinner" size={14} />
                    : <Sparkles size={14} />}
                  {translate(language, optimizingRoute ? 'optimizingRoute' : 'optimizeRoute')}
                </button>
              )}
              <NavLink to="/saved" className="save-route-button">{ui(language, 'autoSaved')} <BookmarkPlus size={15} /></NavLink>
              {visibleOptimizationResult && (
                <p
                  className={`route-optimization-status${visibleOptimizationResult === 'error' ? ' is-error' : ''}`}
                  role={visibleOptimizationResult === 'error' ? 'alert' : 'status'}
                >
                  {translate(language, visibleOptimizationResult === 'optimized'
                    ? 'routeOptimized'
                    : visibleOptimizationResult === 'offline'
                      ? 'routeOffline'
                      : 'routeOptimizationError')}
                </p>
              )}
            </section>
          )}
        </section>

        <section className="home-section about-section" id="explore-info" aria-labelledby="about-title">
          <div className="about-intro">
            <div className="about-copy">
              <span className="home-section-kicker"><span className="kicker-index">03</span>{ui(language, 'navAbout').toLocaleUpperCase(language)}</span>
              <h2 id="about-title">{ui(language, 'aboutTitle')}</h2>
              <p>{ui(language, 'aboutText1')}</p>
              <p>{ui(language, 'aboutText2')}</p>
              <div className="about-actions">
                <button type="button" className="hero-cta" onClick={() => scrollToSection('explore-map')}><Play size={14} fill="currentColor" />{ui(language, 'startExploring')}<ArrowRight size={15} /></button>
                <NavLink to="/saved" className="about-link">{translate(language, 'savedTitle')}<ChevronRight size={16} /></NavLink>
              </div>
            </div>
            <div className="about-visual" aria-hidden="true">
              <span className="about-photo about-photo-main illustration-assembly" />
              <span className="about-photo about-photo-side illustration-bridge" />
              <span className="about-photo about-photo-small illustration-cua-tung-beach" />
            </div>
          </div>

          <dl className="about-stats">
            <div><dt>{ui(language, 'statDestinations')}</dt><dd>{places.length}</dd></div>
            <div><dt>{ui(language, 'statLanguages')}</dt><dd>{languages.length}</dd></div>
            <div><dt>{ui(language, 'statTypes')}</dt><dd>{categoryKeys.length}</dd></div>
            <div><dt>{ui(language, 'statOffline')}</dt><dd>24/7</dd></div>
          </dl>

          <div className="about-steps">
            <h3>{ui(language, 'stepsTitle')}</h3>
            <ol>
              <li><span className="about-step-icon"><MapPin size={20} /></span><strong>{ui(language, 'step1Title')}</strong><small>{ui(language, 'step1Text')}</small></li>
              <li><span className="about-step-icon"><Headphones size={20} /></span><strong>{ui(language, 'step2Title')}</strong><small>{ui(language, 'step2Text')}</small></li>
              <li><span className="about-step-icon"><LocateFixed size={20} /></span><strong>{ui(language, 'step3Title')}</strong><small>{ui(language, 'step3Text')}</small></li>
            </ol>
          </div>

          <div className="home-benefits about-benefits">
            <div><Leaf size={24} /><span><strong>{ui(language, 'benefitModern')}</strong><small>{ui(language, 'benefitModernSub')}</small></span></div>
            <div><Globe2 size={24} /><span><strong>{ui(language, 'benefitLanguages')}</strong><small>{languages.map((item) => item.native).join(' · ')}</small></span></div>
            <div><Landmark size={24} /><span><strong>{ui(language, 'benefitEasy')}</strong><small>{ui(language, 'benefitEasySub')}</small></span></div>
            <div><Heart size={24} /><span><strong>{ui(language, 'benefitHeritage')}</strong><small>{ui(language, 'benefitHeritageSub')}</small></span></div>
          </div>
        </section>
      </div>

      <details className="place-detail-page pd-page" ref={placeDetailsRef}>
        <summary className="pd-backbar">
          <span className="pd-backbar-button"><ChevronLeft size={16} />{ui(language, 'backToExplore')}</span>
          <span className="pd-backbar-hint">Esc</span>
        </summary>
        <article className="place-detail-content" lang={language}>
          <header
            className="pd-hero"
            style={{ backgroundImage: `linear-gradient(90deg, #062f25f0 0%, #0b4a39c4 38%, #0d3a2f52 72%, #0d2e2633 100%), url("${offlineImageUrl ?? selectedPlace.detailImage.src}")` }}
          >
            <nav className="pd-breadcrumbs" aria-label={ui(language, 'breadcrumb')}>
              <button type="button" onClick={closePlaceDetails}><Home size={13} />{ui(language, 'navHome')}</button>
              <ChevronRight size={12} />
              <button type="button" onClick={() => { closePlaceDetails(); scrollToSection('explore-featured') }}>{ui(language, 'navExplore')}</button>
              <ChevronRight size={12} />
              <span aria-current="page">{localizedTitle(selectedPlace, language)}</span>
            </nav>
            <div className="pd-hero-copy">
              <span className="pd-hero-category"><Sparkles size={13} />{categoryLabels[language][selectedPlace.category]}</span>
              <h1>{localizedTitle(selectedPlace, language)}</h1>
              <p>{selectedPlace.copy[language].subtitle}</p>
              <ul className="pd-hero-meta">
                <li><Clock3 size={14} />{selectedPlace.duration} {translate(language, 'minute')}</li>
                <li><Headphones size={14} />{ui(language, 'narrationLanguagesCount', { n: languages.length })}</li>
                <li><MapPin size={14} />{ui(language, 'regionName')}</li>
              </ul>
              <div className="pd-hero-actions">
                <button type="button" className="pd-btn pd-btn-primary" onClick={scrollToPlaceAudio}><Play size={13} fill="currentColor" />{ui(language, 'listenNow')}</button>
                <button type="button" className="pd-btn pd-btn-ghost" onClick={viewSelectedPlaceOnMap}><MapPin size={15} />{ui(language, 'viewOnMap')}</button>
              </div>
            </div>
            <span className="pd-hero-index" aria-hidden="true">
              {String(places.findIndex((place) => place.id === selectedPlace.id) + 1).padStart(2, '0')}<small>/ {String(places.length).padStart(2, '0')}</small>
            </span>
          </header>

          <div className="place-detail-layout pd-layout">
            <div className="pd-main">
              {visitorDetails && (
                <dl className="pd-facts" lang={visitorDetails.language}>
                  <div><dt><MapPin size={15} />{ui(language, 'factLocation')}</dt><dd>{visitorDetails.location}</dd></div>
                  <div><dt><CalendarDays size={15} />{ui(language, 'factBestTime')}</dt><dd>{visitorDetails.bestTime}</dd></div>
                  <div><dt><Clock3 size={15} />{ui(language, 'factDuration')}</dt><dd>{ui(language, 'minutes', { n: selectedPlace.duration })}</dd></div>
                  <div><dt><Sparkles size={15} />{ui(language, 'factType')}</dt><dd>{categoryLabels[language][selectedPlace.category]}</dd></div>
                </dl>
              )}

              <section className="pd-card pd-intro" lang={visitorDetails?.language ?? language}>
                <span className="pd-kicker">{ui(language, 'overview')}</span>
                <h2>{ui(language, 'aboutPlace', { name: localizedTitle(selectedPlace, language) })}</h2>
                <p className="pd-lead">{visitorDetails?.introduction ?? selectedPlace.copy[language].narration}</p>
                {selectedPlace.detailImage.src && (
                  <figure className="pd-figure">
                    <img src={offlineImageUrl ?? selectedPlace.detailImage.src} alt={language === 'vi' ? selectedPlace.detailImage.alt : localizedTitle(selectedPlace, language)} loading="lazy" />
                    <figcaption><Camera size={13} />{language === 'vi' ? selectedPlace.detailImage.caption || selectedPlace.detailImage.alt : localizedTitle(selectedPlace, language)}</figcaption>
                  </figure>
                )}
                {visitorDetails?.highlight && (
                  <aside className="pd-highlight">
                    <span className="pd-highlight-icon"><Lightbulb size={18} /></span>
                    <div><strong>{ui(language, 'highlight')}</strong><p>{visitorDetails.highlight}</p></div>
                  </aside>
                )}
              </section>

              {visitorDetails ? (
                <>
                  <section className="pd-card" lang={visitorDetails.language}>
                    <span className="pd-kicker">{ui(language, 'experience')}</span>
                    <h2>{ui(language, 'activities')}</h2>
                    <ul className="pd-checklist">
                      {visitorDetails.activities.map((activity) => <li key={activity}><CircleCheck size={17} />{activity}</li>)}
                    </ul>
                  </section>
                  {(visitorDetails.food || visitorDetails.historicalValue) && (
                    <div className="pd-pair" lang={visitorDetails.language}>
                      {visitorDetails.historicalValue && (
                        <section className="pd-card pd-mini">
                          <span className="pd-mini-icon"><Landmark size={18} /></span>
                          <h3>{ui(language, 'historicalValue')}</h3>
                          <p>{visitorDetails.historicalValue}</p>
                        </section>
                      )}
                      {visitorDetails.food && (
                        <section className="pd-card pd-mini">
                          <span className="pd-mini-icon"><ChefHat size={18} /></span>
                          <h3>{ui(language, 'foodToTry')}</h3>
                          <p>{visitorDetails.food}</p>
                        </section>
                      )}
                    </div>
                  )}
                </>
              ) : selectedPlace.detailSections.length > 0 && (
                <section className="pd-card">
                  {selectedPlace.detailSections.map((section, index) => (
                    <div className="pd-text-block" key={`${selectedPlace.id}-${index}`}>
                      <h3>{section.heading}</h3><p>{section.body}</p>
                    </div>
                  ))}
                </section>
              )}
            </div>

            <aside className="place-detail-sidebar pd-side">
              <section className="place-detail-side-card pd-audio" id="place-detail-audio">
                <h2><span className="place-detail-side-icon"><Headphones size={12} /></span>{ui(language, 'audioGuide')}</h2>
                <NarrationCard place={selectedPlace} language={language} distanceMeters={distanceMeters} onStartWalk={startWalk} onStopWalk={stopWalk} />
              </section>
              <TicketPurchasePanel placeId={selectedPlace.id} />
              <PlaceRatingPanel placeId={selectedPlace.id} />
              <RitualGuidancePanel place={selectedPlace} language={language} />
            </aside>
          </div>

          {relatedPlaces.length > 0 && (
            <section className="pd-related" aria-labelledby="pd-related-title">
              <div className="pd-related-head">
                <span className="pd-kicker">{ui(language, 'youMayLike')}</span>
                <h2 id="pd-related-title">{ui(language, 'morePlaces')}</h2>
              </div>
              <div className="pd-related-grid">
                {relatedPlaces.map((place) => (
                  <button key={place.id} type="button" className="pd-related-card" onClick={() => openPlace(place.id)}>
                    <span className={`pd-related-media illustration-${place.image}`} aria-hidden="true" />
                    <span className="pd-related-body">
                      <small>{categoryLabels[language][place.category]} · {place.duration} {translate(language, 'minute')}</small>
                      <strong>{localizedTitle(place, language)}</strong>
                      <span className="pd-related-link">{ui(language, 'viewDetails')} <ArrowRight size={13} /></span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="place-detail-itinerary">
            <ItineraryPlanner places={places} />
          </section>
        </article>
      </details>

      <button className={`walk-fab${autoNarration ? ' is-active' : ''}`} onClick={autoNarration ? stopWalk : startWalk}>
        {autoNarration ? <Volume2 size={17} /> : <Compass size={17} />}
        {translate(language, autoNarration ? 'autoOn' : 'startWalk')}
      </button>
      {savedTours.length > 0 && <span className="sr-only">{savedTours.length} saved walks</span>}
    </div>
  )
}
