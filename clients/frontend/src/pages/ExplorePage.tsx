// Trang khám phá: tìm/lọc địa điểm, xem bản đồ, GPS, hành trình và thuyết minh.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookmarkPlus, Camera, ChevronDown, ChevronLeft, ChevronRight, Clock3, Compass, Globe2, Headphones, Heart, Home, Landmark, Leaf, LocateFixed, LoaderCircle, MapPin, Play, Search, Sparkles, Volume2 } from 'lucide-react'
import { distance, point } from '@turf/turf'
import { NavLink } from 'react-router-dom'
import { getVisitorId, recordVisit } from '../api'
import { NarrationCard } from '../components/NarrationCard'
import { PlaceRatingPanel } from '../components/PlaceRatingPanel'
import { TicketPurchasePanel } from '../components/TicketPurchasePanel'
import { RitualGuidancePanel } from '../components/RitualGuidancePanel'
import { ItineraryPlanner } from '../components/ItineraryPlanner'
import { getOfflinePlacePack } from '../db'
import { placeVisitorDetails } from '../data/placeDetails'
import { categoryKeys, categoryLabels, languages, localizedTitle, places as bundledPlaces } from '../data/places'
import { translate } from '../i18n'
import { getNarrationAudioUrl, getNarrationText, speakWithAudio, speechAvailable, stopSpeaking } from '../speech'
import { optimizeRouteOrder } from '../routeOptimization'
import { useAppStore } from '../store'
import type { Category } from '../types'
import './explore-home.css'

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
  const visitorDetails = placeVisitorDetails[selectedPlace.id]
  const selectedLanguage = languages.find((item) => item.code === language)
  const vi = language === 'vi'

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
    if (speechAvailable()) speakWithAudio(getNarrationText(nearby, language), language, getNarrationAudioUrl(nearby.id, language))
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
    if (!window.confirm('Khi bật hướng dẫn GPS, ứng dụng sẽ gửi vị trí gần điểm dừng để ghi nhận tối đa một lượt ghé ẩn danh cho mỗi thiết bị/điểm/ngày. Tiếp tục?')) return
    if (!navigator.geolocation) {
      setGpsMessage(translate(language, 'gpsUnsupported'))
      return
    }
    if (watchId.current !== null) return
    setGpsMessage('')
    spokenPlaces.current.clear()
    spokenPlaces.current.add(selectedPlace.id)
    setAutoNarration(true)
    if (speechAvailable()) speakWithAudio(getNarrationText(selectedPlace, language), language, getNarrationAudioUrl(selectedPlace.id, language))
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
            setGpsMessage('Không thể đọc trạng thái lượt ghé trên thiết bị.')
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
              setGpsMessage('Không ghi nhận được lượt ghé. Kiểm tra kết nối rồi thử lại gần địa điểm.')
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
            <span className="hero-kicker"><Compass size={15} />{language === 'vi' ? 'Mỗi điểm đến, một câu chuyện' : 'Every destination tells a story'}</span>
            <span className="hero-script">{language === 'vi' ? 'Khám phá' : 'Discover'}</span>
            <h1>{language === 'vi' ? 'Quảng Trị' : translate(language, 'title')}</h1>
            <p>{language === 'vi' ? 'Qua thuyết minh tự động – bằng ngôn ngữ của bạn' : translate(language, 'introduction')}</p>
            <div className="hero-highlights">
              <button type="button" onClick={() => scrollToSection('explore-info')}><Headphones size={17} />{vi ? <>Thuyết minh AI<br />đa ngôn ngữ</> : <>Multilingual AI<br />audio guide</>}</button>
              <button type="button" onClick={() => scrollToSection('explore-map')}><MapPin size={17} />{vi ? <>Bản đồ tương tác<br />thông minh</> : <>Interactive<br />travel map</>}</button>
              <button type="button" onClick={() => { setCategory('landmark'); setPlacesExpanded(true); scrollToSection('explore-featured') }}><Landmark size={17} />{vi ? <>Khám phá di tích<br />và danh thắng</> : <>Discover local<br />landmarks</>}</button>
            </div>
            <div className="hero-actions">
            <button type="button" className="hero-cta" onClick={() => scrollToSection('explore-map')}>
              <Play size={14} fill="currentColor" />{language === 'vi' ? 'Bắt đầu khám phá' : 'Start exploring'}<ArrowRight size={15} />
            </button>
            <a className="hero-secondary" href="#explore-featured">{language === 'vi' ? 'Xem điểm đến' : 'View destinations'}<ChevronRight size={16} /></a>
            </div>
          </div>
          <p className="hero-quote">{language === 'vi' ? <>“Quảng Trị – vùng đất của lịch sử<br />và khát vọng hòa bình”</> : <>“Quang Tri – a land of history<br />and the hope for peace”</>}</p>
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
            <span>{language === 'vi' ? 'Bạn muốn khám phá nơi nào?' : 'Where would you like to explore?'}</span>
            <input id="home-destination-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={translate(language, 'search')} />
          </label>
          <button type="submit"><Search size={18} /><span>{language === 'vi' ? 'Tìm điểm đến' : 'Find destinations'}</span></button>
        </form>
        <section className="home-section discover-section" id="explore-featured" aria-labelledby="discover-title">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker"><span className="kicker-index">01</span>{vi ? 'KHÁM PHÁ QUẢNG TRỊ' : 'EXPLORE QUANG TRI'}</span>
              <h2 id="discover-title">{vi ? 'Những điểm đến không thể bỏ lỡ' : 'Destinations you should not miss'}</h2>
            </div>
            <p>{vi ? 'Di tích lịch sử, hang động, biển xanh và ẩm thực địa phương – mỗi nơi đều có bài thuyết minh riêng.' : 'Historic sites, caves, beaches and local food – each stop comes with its own audio story.'}</p>
          </div>
          <div className="discover-tabs" role="group" aria-label={vi ? 'Lọc theo loại điểm đến' : 'Filter by type'}>
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
                  <button type="button" className={`dest-card-media illustration-${place.image}`} onClick={() => openPlace(place.id)} aria-label={`${vi ? 'Xem chi tiết' : 'View details'}: ${localizedTitle(place, language)}`}>
                    <span className="dest-card-badge">{categoryLabels[language][place.category]}</span>
                    <span className="dest-card-index">{String(index + 1).padStart(2, '0')}</span>
                  </button>
                  <div className="dest-card-body">
                    <h3>{localizedTitle(place, language)}</h3>
                    <p>{place.copy[language].subtitle}</p>
                    <span className="dest-card-meta"><Clock3 size={13} /> {place.duration} {translate(language, 'minute')}<i /><Headphones size={13} /> {vi ? 'Có thuyết minh' : 'Audio guide'}</span>
                    <div className="dest-card-actions">
                      <button type="button" className="dest-card-primary" onClick={() => openPlace(place.id)}><Play size={12} fill="currentColor" />{vi ? 'Nghe thuyết minh' : 'Listen'}</button>
                      <button type="button" className="dest-card-secondary" onClick={() => selectFeaturedPlace(place.id)}><MapPin size={14} />{vi ? 'Xem trên bản đồ' : 'On the map'}</button>
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
                ? vi ? 'Thu gọn' : 'Show less'
                : vi ? `Xem tất cả ${filteredPlaces.length} điểm đến` : `View all ${filteredPlaces.length} destinations`}
              <ChevronDown className={`places-disclosure${placesExpanded ? ' expanded' : ''}`} size={16} />
            </button>
          )}
        </section>

        <section className="home-section map-section" id="explore-map" aria-labelledby="map-title">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker"><span className="kicker-index">02</span>{vi ? 'BẢN ĐỒ DU LỊCH' : 'TRAVEL MAP'}</span>
              <h2 id="map-title">{vi ? 'Chạm vào bản đồ, mở ra câu chuyện' : 'Explore the map. Discover a story.'}</h2>
            </div>
            <p>{vi ? 'Chọn một điểm trên bản đồ hoặc trong danh sách, bật GPS để nghe thuyết minh tự động khi bạn đến gần.' : 'Pick a stop on the map or in the list, and turn on GPS to hear narration automatically as you arrive.'}</p>
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
                <div><div className="eyebrow small"><span className="eyebrow-line" /> QUẢNG TRỊ · QUẢNG BÌNH</div><h2 id="map-places-title"><span className="featured-heading-icon"><MapPin size={15} /></span>{vi ? 'Điểm trên bản đồ' : 'Stops on the map'}</h2></div>
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
                {vi ? 'Mở thuyết minh điểm đang chọn' : 'Open selected stop'}<ArrowRight size={14} />
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
              <NavLink to="/saved" className="save-route-button">{language === 'vi' ? 'Đã tự lưu' : 'Saved'} <BookmarkPlus size={15} /></NavLink>
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
              <span className="home-section-kicker"><span className="kicker-index">03</span>{vi ? 'GIỚI THIỆU' : 'ABOUT'}</span>
              <h2 id="about-title">{vi ? 'Quảng Trị – nơi lịch sử kể chuyện bằng chính giọng của bạn' : 'Quang Tri – where history speaks your language'}</h2>
              <p>{vi
                ? 'Từ Thành cổ, cầu Hiền Lương, địa đạo Vịnh Mốc đến biển Cửa Tùng và hệ thống hang động Phong Nha, mảnh đất miền Trung này lưu giữ những câu chuyện về chiến tranh, hòa bình và thiên nhiên hùng vĩ.'
                : 'From the Citadel, Hien Luong Bridge and the Vinh Moc tunnels to Cua Tung beach and the Phong Nha caves, this central region holds stories of war, peace and remarkable nature.'}</p>
              <p>{vi
                ? 'Ứng dụng giúp bạn khám phá theo cách riêng: chọn điểm đến, nghe thuyết minh bằng ngôn ngữ của mình, lưu hành trình và dùng cả khi không có mạng.'
                : 'This guide lets you explore your own way: pick a stop, listen in your language, save your route and keep using it offline.'}</p>
              <div className="about-actions">
                <button type="button" className="hero-cta" onClick={() => scrollToSection('explore-map')}><Play size={14} fill="currentColor" />{vi ? 'Bắt đầu khám phá' : 'Start exploring'}<ArrowRight size={15} /></button>
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
            <div><dt>{vi ? 'Điểm đến' : 'Destinations'}</dt><dd>{places.length}</dd></div>
            <div><dt>{vi ? 'Ngôn ngữ thuyết minh' : 'Narration languages'}</dt><dd>{languages.length}</dd></div>
            <div><dt>{vi ? 'Nhóm trải nghiệm' : 'Experience types'}</dt><dd>{categoryKeys.length}</dd></div>
            <div><dt>{vi ? 'Dùng ngoại tuyến' : 'Works offline'}</dt><dd>24/7</dd></div>
          </dl>

          <div className="about-steps">
            <h3>{vi ? 'Bắt đầu chỉ với 3 bước' : 'Get started in 3 steps'}</h3>
            <ol>
              <li><span className="about-step-icon"><MapPin size={20} /></span><strong>{vi ? 'Chọn điểm đến' : 'Pick a destination'}</strong><small>{vi ? 'Tìm kiếm hoặc chạm vào điểm trên bản đồ du lịch.' : 'Search or tap a stop on the travel map.'}</small></li>
              <li><span className="about-step-icon"><Headphones size={20} /></span><strong>{vi ? 'Nghe thuyết minh' : 'Listen to the story'}</strong><small>{vi ? 'Chọn ngôn ngữ ở góc trên và nghe câu chuyện của nơi đó.' : 'Choose a language at the top and hear the story of the place.'}</small></li>
              <li><span className="about-step-icon"><LocateFixed size={20} /></span><strong>{vi ? 'Bật GPS tản bộ' : 'Walk with GPS'}</strong><small>{vi ? 'Thuyết minh tự phát khi bạn đến gần mỗi điểm dừng.' : 'Narration plays automatically as you approach each stop.'}</small></li>
            </ol>
          </div>

          <div className="home-benefits about-benefits">
            <div><Leaf size={24} /><span><strong>{vi ? 'Trải nghiệm hiện đại' : 'A modern experience'}</strong><small>{vi ? 'với công nghệ AI' : 'powered by AI'}</small></span></div>
            <div><Globe2 size={24} /><span><strong>{vi ? 'Hỗ trợ đa ngôn ngữ' : 'Multiple languages'}</strong><small>{languages.map((item) => item.native).join(' · ')}</small></span></div>
            <div><Landmark size={24} /><span><strong>{vi ? 'Khám phá dễ dàng' : 'Explore with ease'}</strong><small>{vi ? 'mọi lúc, mọi nơi' : 'anytime, anywhere'}</small></span></div>
            <div><Heart size={24} /><span><strong>{vi ? 'Góp phần quảng bá' : 'Celebrate local heritage'}</strong><small>{vi ? 'văn hóa – du lịch Quảng Trị' : 'culture and tourism in Quang Tri'}</small></span></div>
          </div>
        </section>
      </div>

      <details className="place-detail-page" ref={placeDetailsRef}>
        <summary
          className="selected-place-panel place-detail-hero"
          style={{ backgroundImage: `linear-gradient(90deg, #073e31f2 0%, #0c5844c9 34%, #123d3440 67%, #102d2730 100%), url("${offlineImageUrl ?? selectedPlace.detailImage.src}")` }}
        >
          <div className="place-detail-hero-copy">
            <span className="place-detail-location-chip"><MapPin size={13} /> Quảng Trị</span>
            <h2>{localizedTitle(selectedPlace, language)}</h2>
            <p>{selectedPlace.copy[language].subtitle}</p>
            <div className="place-detail-hero-tags">
              <span><Sparkles size={13} />{categoryLabels[language][selectedPlace.category]}</span>
              <span><Clock3 size={13} />{selectedPlace.duration} {translate(language, 'minute')}</span>
              <span><MapPin size={13} />Quảng Trị · Quảng Bình</span>
            </div>
          </div>
          <span className="place-detail-hero-count"><span className="place-detail-hero-close"><ChevronLeft size={15} /> Quay lại bản đồ</span></span>
        </summary>
        <article className="place-detail-content">
          <div className="place-detail-layout">
            <div className="place-detail-main-column">
              <nav className="place-detail-breadcrumbs" aria-label="Đường dẫn">
                <button type="button" onClick={closePlaceDetails}><Home size={14} /> Trang chủ</button>
                <ChevronRight size={13} />
                <span>Du lịch Quảng Trị</span>
                <ChevronRight size={13} />
                <span aria-current="page">{localizedTitle(selectedPlace, language)}</span>
              </nav>
              <div className="place-detail-heading" lang={language}>
                <span className="eyebrow"><span className="eyebrow-line" /> {categoryLabels[language][selectedPlace.category]}</span>
                <h1>{localizedTitle(selectedPlace, language)}</h1>
                <p>{selectedPlace.copy[language].narration}</p>
              </div>
              {selectedPlace.detailImage.src && (
                <figure className="place-detail-feature-image">
                  <img src={offlineImageUrl ?? selectedPlace.detailImage.src} alt={selectedPlace.detailImage.alt} loading="lazy" />
                  <figcaption><span><Camera size={13} /> {selectedPlace.detailImage.caption || selectedPlace.detailImage.alt}</span></figcaption>
                </figure>
              )}
              <section className="place-visitor-info" lang="vi">
                <div className="place-visitor-info-heading">
                  <span className="eyebrow"><span className="eyebrow-line" /> THÔNG TIN ĐIỂM ĐẾN</span>
                  <h2>Thông tin tham quan</h2>
                </div>
                <div className="place-visitor-details">
                  {visitorDetails ? (
                    <>
                      <section className="place-visitor-detail"><h3>Vị trí</h3><p>{visitorDetails.location}</p></section>
                      <section className="place-visitor-detail"><h3>Giới thiệu</h3><p>{visitorDetails.introduction}</p></section>
                      <section className="place-visitor-detail">
                        <h3>Hoạt động tham quan</h3>
                        <ul>{visitorDetails.activities.map((activity) => <li key={activity}>{activity}</li>)}</ul>
                      </section>
                      {visitorDetails.food && <section className="place-visitor-detail"><h3>Ẩm thực</h3><p>{visitorDetails.food}</p></section>}
                      {visitorDetails.historicalValue && <section className="place-visitor-detail"><h3>Giá trị lịch sử</h3><p>{visitorDetails.historicalValue}</p></section>}
                      <section className="place-visitor-detail"><h3>Thời điểm thích hợp</h3><p>{visitorDetails.bestTime}</p></section>
                      <section className="place-visitor-detail"><h3>Điểm nổi bật</h3><p>{visitorDetails.highlight}</p></section>
                    </>
                  ) : selectedPlace.detailSections.map((section, index) => (
                    <section className="place-visitor-detail" key={`${selectedPlace.id}-${index}`}>
                      <h3>{section.heading}</h3><p>{section.body}</p>
                    </section>
                  ))}
                </div>
              </section>
            </div>
            <aside className="place-detail-sidebar">
              <section className="place-detail-side-card">
                <h2><span className="place-detail-side-icon"><Play size={12} fill="currentColor" /></span> Nghe bài viết</h2>
                <NarrationCard place={selectedPlace} language={language} distanceMeters={distanceMeters} onStartWalk={startWalk} onStopWalk={stopWalk} />
              </section>
              <PlaceRatingPanel placeId={selectedPlace.id} />
              <section className="place-detail-related">
                <h2><MapPin size={16} /> Thông tin liên quan</h2>
                <div>
                  <span>Du lịch Quảng Trị</span>
                  <span>{categoryLabels[language][selectedPlace.category]}</span>
                  <span>Địa điểm nổi bật</span>
                  <span>{selectedLanguage?.label ?? language}</span>
                </div>
              </section>
              <TicketPurchasePanel placeId={selectedPlace.id} />
              <RitualGuidancePanel place={selectedPlace} language={language} />
            </aside>
          </div>
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
