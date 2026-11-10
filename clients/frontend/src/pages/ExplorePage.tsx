// Trang khám phá: tìm/lọc địa điểm, xem bản đồ, GPS, hành trình và thuyết minh.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookmarkPlus, Camera, ChevronDown, ChevronLeft, ChevronRight, Clock3, Compass, Globe2, Headphones, Heart, Home, Landmark, Leaf, LocateFixed, LoaderCircle, MapPin, Play, Search, Sparkles, Volume2, Waves } from 'lucide-react'
import { distance, point } from '@turf/turf'
import { NavLink } from 'react-router-dom'
import { getVisitorId, recordVisit } from '../api'
import { NarrationCard } from '../components/NarrationCard'
import { PlaceRatingPanel } from '../components/PlaceRatingPanel'
import { TicketPurchasePanel } from '../components/TicketPurchasePanel'
import { RitualGuidancePanel } from '../components/RitualGuidancePanel'
import { ItineraryPlanner } from '../components/ItineraryPlanner'
import { getOfflinePlacePack } from '../db'
import { categoryKeys, categoryLabels, languages, localizedTitle, places as bundledPlaces } from '../data/places'
import { translate } from '../i18n'
import { getNarrationAudioUrl, getNarrationText, speakWithAudio, speechAvailable, stopSpeaking } from '../speech'
import { optimizeRouteOrder } from '../routeOptimization'
import { useAppStore } from '../store'
import type { Category } from '../types'

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
  const selectedLanguage = languages.find((item) => item.code === language)

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

  const filteredPlaces = useMemo(() => places.filter((place) => {
    const title = localizedTitle(place, language).toLowerCase()
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || title.includes(query) || place.copy.vi.title.toLowerCase().includes(query) || place.copy.en.title.toLowerCase().includes(query)
    return matchesSearch && (category === 'all' || place.category === category)
  }), [places, language, search, category])
  const featuredPlaces = useMemo(() => {
    const featuredIds = ['bao-ninh-beach', 'cua-tung-beach', 'da-nhay']
    const preferred = featuredIds
      .map((id) => filteredPlaces.find((place) => place.id === id))
      .filter((place) => place !== undefined)
    return [...preferred, ...filteredPlaces.filter((place) => !featuredIds.includes(place.id))]
  }, [filteredPlaces])

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
    if (placeDetailsRef.current) placeDetailsRef.current.open = true
  }

  const selectFeaturedPlace = (placeId: string) => {
    setSelectedPlace(placeId)
    setMapFocusRequest((request) => request + 1)
    document.getElementById('explore-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
      <section className="explore-hero">
        <div className="explore-hero-inner">
          <div className="hero-copy">
            <span className="hero-script">{language === 'vi' ? 'Khám phá' : 'Discover'}</span>
            <h1>{language === 'vi' ? 'Quảng Trị' : translate(language, 'title')}</h1>
            <p>{language === 'vi' ? 'Qua thuyết minh tự động – bằng ngôn ngữ của bạn' : translate(language, 'introduction')}</p>
            <div className="hero-highlights">
              <span><Headphones size={17} />{language === 'vi' ? <>Thuyết minh AI<br />đa ngôn ngữ</> : <>Multilingual AI<br />audio guide</>}</span>
              <span><MapPin size={17} />{language === 'vi' ? <>Bản đồ tương tác<br />thông minh</> : <>Interactive<br />travel map</>}</span>
              <span><Landmark size={17} />{language === 'vi' ? <>Khám phá di tích<br />và danh thắng</> : <>Discover local<br />landmarks</>}</span>
            </div>
            <button type="button" className="hero-cta" onClick={() => document.getElementById('explore-map')?.scrollIntoView({ behavior: 'smooth' })}>
              <Play size={14} fill="currentColor" />{language === 'vi' ? 'Bắt đầu khám phá' : 'Start exploring'}<ArrowRight size={15} />
            </button>
          </div>
          <p className="hero-quote">{language === 'vi' ? <>“Quảng Trị – vùng đất của lịch sử<br />và khát vọng hòa bình”</> : <>“Quang Tri – a land of history<br />and the hope for peace”</>}</p>
        </div>
      </section>

      <div className="explore-content">
        <div className="explore-grid">
        <section className="map-column" id="explore-map">
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
        </section>

        <aside className="places-column" id="explore-featured">
          <button
            className="places-head"
            type="button"
            aria-expanded={placesExpanded}
            aria-controls="explore-place-list"
            onClick={() => setPlacesExpanded((expanded) => !expanded)}
          >
            <div><div className="eyebrow small"><span className="eyebrow-line" /> QUANG TRI · QUANG BINH</div><h2><span className="featured-heading-icon"><Sparkles size={15} fill="currentColor" /></span>{language === 'vi' ? 'Điểm đến nổi bật' : 'Featured destinations'}</h2></div>
            <span className="places-head-actions">
              <span className="count-badge">{filteredPlaces.length}</span>
              <ChevronDown className={`places-disclosure${placesExpanded ? ' expanded' : ''}`} size={16} />
            </span>
          </button>
          <div className="place-list" id="explore-place-list">
              {(placesExpanded ? filteredPlaces : featuredPlaces.slice(0, 3)).map((place, index) => {
                const active = selectedPlace.id === place.id
                return (
                  <button key={place.id} className={`place-row${active ? ' active' : ''}`} onClick={() => selectFeaturedPlace(place.id)}>
                    <span className={`featured-place-thumb illustration-${place.image}`} aria-hidden="true" />
                    <span className="place-row-copy">
                      <span className="featured-place-number">{String(index + 1).padStart(2, '0')}</span>
                      <strong>{localizedTitle(place, language)}</strong>
                      <small>{place.copy[language].subtitle}</small>
                      <span className="place-meta"><Clock3 size={12} /> {place.duration} {translate(language, 'minute')} <i /> {categoryLabels[language][place.category]}</span>
                    </span>
                    <span className="featured-place-play"><Play size={12} fill="currentColor" /></span>
                  </button>
                )
              })}
              {filteredPlaces.length === 0 && <div className="empty-search">{translate(language, 'noResults')}</div>}
          </div>
          {filteredPlaces.length > 3 && (
            <button type="button" className="featured-see-all" onClick={() => setPlacesExpanded((expanded) => !expanded)}>
              {placesExpanded
                ? language === 'vi' ? 'Thu gọn danh sách' : 'Show featured only'
                : language === 'vi' ? 'Xem tất cả điểm đến' : 'View all destinations'}<ArrowRight size={14} />
            </button>
          )}
          <NavLink to="/saved" className="all-stops-link">{translate(language, 'savedTitle')} <ArrowRight size={14} /></NavLink>
        </aside>
        </div>
        <section className="home-benefits" id="explore-info" aria-label="Điểm nổi bật">
          <div><Leaf size={24} /><span><strong>{language === 'vi' ? 'Trải nghiệm hiện đại' : 'A modern experience'}</strong><small>{language === 'vi' ? 'với công nghệ AI' : 'powered by AI'}</small></span></div>
          <div><Globe2 size={24} /><span><strong>{language === 'vi' ? 'Hỗ trợ đa ngôn ngữ' : 'Multiple languages'}</strong><small>{language === 'vi' ? 'Việt – Anh – Nhật – Hàn...' : 'Vietnamese, English, Japanese...'}</small></span></div>
          <div><Landmark size={24} /><span><strong>{language === 'vi' ? 'Khám phá dễ dàng' : 'Explore with ease'}</strong><small>{language === 'vi' ? 'mọi lúc, mọi nơi' : 'anytime, anywhere'}</small></span></div>
          <div><Heart size={24} /><span><strong>{language === 'vi' ? 'Góp phần quảng bá' : 'Celebrate local heritage'}</strong><small>{language === 'vi' ? 'văn hóa – du lịch Quảng Trị' : 'culture and tourism in Quang Tri'}</small></span></div>
          <Waves className="benefit-wave" size={38} aria-hidden="true" />
        </section>
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
          <span className="place-detail-hero-count">{String(places.findIndex((place) => place.id === selectedPlace.id) + 1).padStart(2, '0')} <i>/ {String(places.length).padStart(2, '0')}</i><span className="place-detail-hero-close"><ChevronLeft size={15} /> Quay lại bản đồ</span></span>
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
              <section className="place-story" lang="vi">
                <div className="place-story-heading">
                  <span className="eyebrow"><span className="eyebrow-line" /> KHÁM PHÁ ĐỊA ĐIỂM</span>
                  <h2>Câu chuyện của nơi này</h2>
                  <p>Khám phá những câu chuyện và hình ảnh đặc trưng của địa phương.</p>
                </div>
                <div className="place-story-sections">
                  {selectedPlace.detailSections.map((section, index) => (
                    <section className="place-story-section" key={`${selectedPlace.id}-${index}`}>
                      <span className="place-story-number">{String(index + 1).padStart(2, '0')}</span>
                      <div><h3>{section.heading}</h3><p>{section.body}</p></div>
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
