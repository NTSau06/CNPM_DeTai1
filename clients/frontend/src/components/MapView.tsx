// Hiển thị bản đồ, marker địa điểm và các tuyến đường bằng MapLibre.
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import * as maplibregl from 'maplibre-gl'
import { GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Protocol, PMTiles } from 'pmtiles'
import { lineString, point } from '@turf/turf'
import { ArrowRight, ArrowUpDown, Compass, LoaderCircle, LocateFixed, MapPinned, Maximize2, Minimize2, Minus, Plus, RotateCw, Route, Search, X } from 'lucide-react'
import { getOfflineMap } from '../db'
import { translate } from '../i18n'
import { ui } from '../uiText'
import { makeOfflineStyle, makeOnlineStyle } from '../mapStyle'
import { useAppStore } from '../store'
import { categoryLabels } from '../data/places'
import type { Language, Place } from '../types'

const protocol = new Protocol()
maplibregl.setWorkerUrl(mapWorkerUrl)
maplibregl.addProtocol('pmtiles', protocol.tile)
const archives = new Map<number, { url: string; archive: PMTiles }>()

interface MapViewProps {
  places: Place[]
  language: Language
  selectedPlaceId: string
  focusRequest: number
  onSelectPlace: (id: string) => void
  onShowPlaceDetails: () => void
}

// Giá trị đặc biệt trong ô chọn điểm: vị trí GPS hiện tại của người dùng.
const MY_LOCATION_ID = '__my-location__'

export function MapView({ places, language, selectedPlaceId, focusRequest, onSelectPlace, onShowPlaceDetails }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const placeMarkers = useRef(new Map<string, maplibregl.Marker>())
  const previousSelectedPlaceId = useRef(selectedPlaceId)
  const previousFocusRequest = useRef(focusRequest)
  const selectedPlaceNeedsFocus = useRef(true)
  const cameraFocusVersion = useRef(0)
  const selectedId = useRef(selectedPlaceId)
  const onSelect = useRef(onSelectPlace)
  const offline = useAppStore((state) => state.useOfflineMap)
  const offlineMap = useAppStore((state) => state.offlineMap)
  const online = useAppStore((state) => state.online)
  const location = useAppStore((state) => state.location)
  const allPlaces = useAppStore((state) => state.places)
  const routeIds = useAppStore((state) => state.suggestedRouteIds.length > 0
    ? state.suggestedRouteIds
    : state.routeIds)
  const error = useAppStore((state) => state.storageError)
  const [mapReady, setMapReady] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [mapSearch, setMapSearch] = useState('')
  const [routeStatus, setRouteStatus] = useState<'loading' | 'offline' | 'error' | null>(null)
  const [directionsStatus, setDirectionsStatus] = useState<'locating' | 'loading' | 'offline' | 'error' | 'unsupported' | null>(null)
  const [showDirections, setShowDirections] = useState(false)
  const [placeRoutePlannerOpen, setPlaceRoutePlannerOpen] = useState(false)
  const [fromPlaceId, setFromPlaceId] = useState(MY_LOCATION_ID)
  const [toPlaceId, setToPlaceId] = useState(selectedPlaceId)
  const [placeRoute, setPlaceRoute] = useState<[string, string] | null>(null)
  const [styleReadyTick, setStyleReadyTick] = useState(0)
  const [bearing, setBearing] = useState(0)
  const [pitch, setPitch] = useState(0)
  const mapPlaces = useMemo(() => {
    const query = mapSearch.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    if (!query) return places
    return places.filter((place) => {
      const copy = place.copy[language]
      return [copy.title, copy.subtitle].some((value) =>
        value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(query),
      )
    })
  }, [places, language, mapSearch])
  const selectedMapPlace = places.find((place) => place.id === selectedPlaceId) ?? places[0]
  const currentProps = useRef({ places: mapPlaces, language, location })
  const previewVisibleRef = useRef(previewVisible)
  previewVisibleRef.current = previewVisible
  const showPlace = (id: string) => {
    onSelectPlace(id)
    setPreviewVisible(true)
  }
  // Nhấp vào một địa điểm trên bản đồ: lần 1 mở ô xem chi tiết, nhấp lại đúng điểm đó thì đóng.
  const selectPlace = (id: string) => {
    if (id === selectedId.current && previewVisibleRef.current) {
      setPreviewVisible(false)
      return
    }
    showPlace(id)
  }

  selectedId.current = selectedPlaceId
  onSelect.current = selectPlace
  currentProps.current = { places: mapPlaces, language, location }

  useEffect(() => {
    if (!container.current) return
    setMapReady(false)
    let cancelled = false
    let blobUrl: string | undefined

    const startMap = async () => {
      let style = makeOnlineStyle()
      if (offline && offlineMap) {
        try {
          const storedPack = await getOfflineMap()
          if (storedPack && !cancelled) {
            let registered = archives.get(storedPack.installedAt)
            if (!registered) {
              blobUrl = URL.createObjectURL(storedPack.blob)
              const archive = new PMTiles(blobUrl)
              protocol.add(archive)
              registered = { url: blobUrl, archive }
              archives.set(storedPack.installedAt, registered)
            }
            blobUrl = registered.url
            const metadata = await registered.archive.getMetadata()
            const vectorLayers = getVectorLayers(metadata)
            if (vectorLayers.length === 0) throw new Error('The archive has no vector layers.')
            style = makeOfflineStyle(blobUrl, vectorLayers)
          } else if (!cancelled) {
            useAppStore.getState().setUseOfflineMap(false)
          }
        } catch {
          useAppStore.getState().setUseOfflineMap(false)
          useAppStore.setState({ storageError: 'offlinePackError' })
        }
      }
      if (cancelled || !container.current) return

      const instance = new maplibregl.Map({
        container: container.current,
        style,
        center: [106.68, 17.16],
        zoom: offline ? 9.5 : 9,
        minZoom: 7,
        maxZoom: 19,
        attributionControl: false,
        // Cho phép kéo bằng chuột / một ngón tay và lăn chuột để phóng to mà không cần giữ Ctrl.
        cooperativeGestures: false,
        dragPan: true,
        scrollZoom: true,
        touchZoomRotate: true,
        doubleClickZoom: true,
        keyboard: true,
        // Xoay 360° và nghiêng lên/xuống: kéo chuột phải (hoặc Ctrl + kéo) — kéo ngang để xoay,
        // kéo dọc để nghiêng; trên điện thoại xoay hai ngón, vuốt hai ngón lên/xuống để nghiêng.
        dragRotate: true,
        pitchWithRotate: true,
        touchPitch: true,
        maxPitch: 70,
      })
      instance.on('rotate', () => setBearing(instance.getBearing()))
      instance.on('pitch', () => setPitch(instance.getPitch()))
      map.current = instance
      instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      instance.once('style.load', () => {
        if (cancelled) return
        setMapReady(true)
        instance.addSource('places', { type: 'geojson', data: placeFeatures(currentProps.current.places) })
        instance.addLayer({
          id: 'place-halos',
          type: 'circle',
          source: 'places',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 8, 17, 14],
            'circle-color': ['case', ['==', ['get', 'id'], selectedId.current], '#c77952', '#f8f4ea'],
            'circle-stroke-color': ['case', ['==', ['get', 'id'], selectedId.current], '#fffaf1', '#607363'],
            'circle-stroke-width': 2,
          },
        })
        instance.addLayer({
          id: 'place-dots',
          type: 'circle',
          source: 'places',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2, 17, 4],
            'circle-color': ['case', ['==', ['get', 'id'], selectedId.current], '#fffaf1', '#607363'],
          },
        })
        instance.addSource('user-location', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        instance.addLayer({
          id: 'user-location-dot',
          type: 'circle',
          source: 'user-location',
          paint: { 'circle-radius': 7, 'circle-color': '#4a78ba', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' },
        })
        instance.on('click', 'place-halos', (event: MapLayerMouseEvent) => {
          const id = event.features?.[0]?.properties?.id
          if (typeof id === 'string') onSelect.current(id)
        })
        // Nhấp vào vùng trống của bản đồ cũng đóng ô xem chi tiết.
        instance.on('click', (event) => {
          if (!instance.getLayer('place-halos')) return
          const hits = instance.queryRenderedFeatures(event.point, { layers: ['place-halos'] })
          if (hits.length === 0) setPreviewVisible(false)
        })
        instance.on('mouseenter', 'place-halos', () => { instance.getCanvas().style.cursor = 'pointer' })
        instance.on('mouseleave', 'place-halos', () => { instance.getCanvas().style.cursor = '' })
        const current = currentProps.current
        syncPlaceMarkers(instance, current.places, current.language, selectedId.current, onSelect, placeMarkers.current)
        updateLayers(instance, current.places, selectedId.current, current.location)
      })
    }

    void startMap()
    return () => {
      cancelled = true
      setMapReady(false)
      setRouteStatus(null)
      for (const marker of placeMarkers.current.values()) marker.remove()
      placeMarkers.current.clear()
      map.current?.remove()
      map.current = null
    }
  }, [offline, offlineMap?.installedAt])

  useEffect(() => {
    if (!map.current) return
    syncPlaceMarkers(map.current, mapPlaces, language, selectedPlaceId, onSelect, placeMarkers.current)
    if (!map.current.isStyleLoaded()) return
    updateLayers(map.current, mapPlaces, selectedPlaceId, location)
  }, [mapPlaces, selectedPlaceId, language, location, routeIds])

  useEffect(() => {
    const instance = map.current
    if (!mapReady || !instance?.isStyleLoaded()) return

    const coordinates = routeIds
      .map((id) => allPlaces.find((place) => place.id === id)?.coordinates)
      .filter((coordinate): coordinate is [number, number] => coordinate !== undefined)

    if (coordinates.length < 2) {
      syncRoadRoute(instance, null)
      setRouteStatus(null)
      return
    }

    if (!online) {
      syncRoadRoute(instance, null)
      setRouteStatus('offline')
      return
    }

    const controller = new AbortController()
    const focusVersionAtStart = cameraFocusVersion.current
    setRouteStatus('loading')
    syncRoadRoute(instance, null)

    void fetchRoadRoute(coordinates, controller.signal)
      .then((roadCoordinates) => {
        if (controller.signal.aborted || map.current !== instance) return
        syncRoadRoute(instance, roadCoordinates)
        if (cameraFocusVersion.current !== focusVersionAtStart) {
          setRouteStatus(null)
          return
        }
        const bounds = roadCoordinates.reduce(
          (routeBounds, coordinate) => routeBounds.extend(coordinate),
          new maplibregl.LngLatBounds(roadCoordinates[0], roadCoordinates[0]),
        )
        instance.fitBounds(bounds, { padding: 56, maxZoom: 12, duration: 650 })
        setRouteStatus(null)
      })
      .catch(() => {
        if (controller.signal.aborted || map.current !== instance) return
        syncRoadRoute(instance, null)
        setRouteStatus('error')
      })

    return () => controller.abort()
  }, [mapReady, routeIds, online, allPlaces])

  useEffect(() => {
    if (previousSelectedPlaceId.current !== selectedPlaceId) {
      previousSelectedPlaceId.current = selectedPlaceId
      selectedPlaceNeedsFocus.current = true
      setPreviewVisible(true)
    }
    if (previousFocusRequest.current !== focusRequest) {
      previousFocusRequest.current = focusRequest
      selectedPlaceNeedsFocus.current = true
      setPreviewVisible(true)
    }

    if (!selectedPlaceNeedsFocus.current || !mapReady) return
    const selectedPlace = places.find((place) => place.id === selectedPlaceId)
    const instance = map.current
    if (!selectedPlace || !instance?.isStyleLoaded()) return

    cameraFocusVersion.current += 1
    instance.stop()
    instance.flyTo({ center: selectedPlace.coordinates, zoom: 15, duration: 600 })
    selectedPlaceNeedsFocus.current = false
  }, [selectedPlaceId, focusRequest, places, mapReady])

  useEffect(() => {
    const instance = map.current
    if (!mapReady || !instance) return
    if (!instance.isStyleLoaded()) {
      // Bản đồ còn đang tải ô nền: đợi tải xong rồi vẽ đường, tránh bỏ lỡ yêu cầu tìm đường.
      const retry = () => setStyleReadyTick((tick) => tick + 1)
      instance.once('idle', retry)
      return () => { instance.off('idle', retry) }
    }

    if (!showDirections && !placeRoute) {
      syncDirectionsRoute(instance, null)
      setDirectionsStatus(null)
      return
    }

    if (showDirections && !location) {
      setDirectionsStatus('error')
      return
    }

    if (!online) {
      syncDirectionsRoute(instance, null)
      setDirectionsStatus('offline')
      return
    }

    const placeCoordinates = placeRoute?.map((id) => id === MY_LOCATION_ID
      ? location ?? undefined
      : places.find((place) => place.id === id)?.coordinates)
    const destination = places.find((place) => place.id === selectedPlaceId)?.coordinates
    const coordinates = placeRoute
      ? placeCoordinates?.every((coordinate): coordinate is [number, number] => coordinate !== undefined)
        ? placeCoordinates
        : null
      : location && destination ? [location, destination] : null
    if (!coordinates) {
      syncDirectionsRoute(instance, null)
      setDirectionsStatus('error')
      return
    }

    const controller = new AbortController()
    const focusVersionAtStart = cameraFocusVersion.current
    setDirectionsStatus('loading')
    syncDirectionsRoute(instance, null)

    void fetchRoadRoute(coordinates, controller.signal)
      .then((roadCoordinates) => {
        if (controller.signal.aborted || map.current !== instance) return
        syncDirectionsRoute(instance, roadCoordinates)
        if (cameraFocusVersion.current !== focusVersionAtStart) {
          setDirectionsStatus(null)
          return
        }
        const bounds = roadCoordinates.reduce(
          (routeBounds, coordinate) => routeBounds.extend(coordinate),
          new maplibregl.LngLatBounds(roadCoordinates[0], roadCoordinates[0]),
        )
        instance.fitBounds(bounds, { padding: expanded ? 100 : 56, maxZoom: 15, duration: 650 })
        setDirectionsStatus(null)
      })
      .catch(() => {
        if (controller.signal.aborted || map.current !== instance) return
        syncDirectionsRoute(instance, null)
        setDirectionsStatus('error')
      })

    return () => controller.abort()
  }, [mapReady, showDirections, placeRoute, location, selectedPlaceId, online, expanded, places, styleReadyTick])

  useEffect(() => {
    if (!expanded) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    map.current?.resize()

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
      map.current?.resize()
    }
  }, [expanded])

  useEffect(() => {
    if (!expanded) setMapSearch('')
  }, [expanded])

  useEffect(() => {
    const stage = container.current?.parentElement
    if (!stage || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => map.current?.resize())
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const getCurrentLocation = () => new Promise<[number, number]>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('geolocation-unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve([coords.longitude, coords.latitude]),
      reject,
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    )
  })

  const handleLocationError = (error: unknown) => {
    setDirectionsStatus(error instanceof Error && error.message === 'geolocation-unsupported' ? 'unsupported' : 'error')
  }

  const centerOnLocation = () => {
    setDirectionsStatus('locating')
    void getCurrentLocation()
      .then((coordinates) => {
        useAppStore.getState().setLocation(coordinates)
        map.current?.flyTo({ center: coordinates, zoom: 16, speed: 0.8 })
        setDirectionsStatus(null)
      })
      .catch(handleLocationError)
  }

  const toggleDirections = () => {
    setPlaceRoute(null)
    setPlaceRoutePlannerOpen(false)
    if (showDirections) {
      setShowDirections(false)
      return
    }
    if (location) {
      setShowDirections(true)
      return
    }

    setDirectionsStatus('locating')
    void getCurrentLocation()
      .then((coordinates) => {
        useAppStore.getState().setLocation(coordinates)
        setShowDirections(true)
      })
      .catch(handleLocationError)
  }

  const openPlaceRoutePlanner = () => {
    setShowDirections(false)
    setPlaceRoute(null)
    setDirectionsStatus(null)
    // Mặc định đi từ vị trí hiện tại của người dùng tới điểm đang chọn.
    setFromPlaceId(MY_LOCATION_ID)
    setToPlaceId(selectedPlaceId)
    setPlaceRoutePlannerOpen((open) => !open)
  }

  const submitPlaceRoute = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!fromPlaceId || !toPlaceId || fromPlaceId === toPlaceId) {
      setDirectionsStatus('error')
      return
    }
    setShowDirections(false)
    const usesMyLocation = fromPlaceId === MY_LOCATION_ID || toPlaceId === MY_LOCATION_ID
    if (!usesMyLocation || location) {
      setPlaceRoute([fromPlaceId, toPlaceId])
      setPlaceRoutePlannerOpen(false)
      return
    }

    // Chưa có vị trí: xin quyền GPS rồi mới vẽ đường.
    const route: [string, string] = [fromPlaceId, toPlaceId]
    setDirectionsStatus('locating')
    void getCurrentLocation()
      .then((coordinates) => {
        useAppStore.getState().setLocation(coordinates)
        setPlaceRoute(route)
        setPlaceRoutePlannerOpen(false)
      })
      .catch(handleLocationError)
  }

  const routeEndpointOptions = (
    <>
      <option value={MY_LOCATION_ID}>📍 {translate(language, 'locate')}{location ? '' : ui(language, 'gpsHint')}</option>
      {places.map((place) => (
        <option key={place.id} value={place.id}>{place.copy[language].title}</option>
      ))}
    </>
  )

  return (
    <div className={`map-stage${expanded ? ' map-stage-expanded' : ''}`}>
      <div className="map-canvas" ref={container} aria-label={translate(language, 'map')} />
      {!mapReady && (
        <div className="map-loading-overlay" role="status">
          <LoaderCircle className="loading-spinner" size={20} />
          <span>{translate(language, 'preparing')}</span>
        </div>
      )}
      {expanded && (
        <>
          <div className="map-search-overlay">
            <Search size={17} aria-hidden="true" />
            <input
              aria-label={translate(language, 'search')}
              onChange={(event) => setMapSearch(event.target.value)}
              placeholder={translate(language, 'search')}
              type="search"
              value={mapSearch}
            />
            {mapSearch && <button type="button" onClick={() => setMapSearch('')} aria-label={translate(language, 'all')}><X size={16} /></button>}
          </div>
          {mapSearch.trim() && (
            <div className="map-search-results">
              {mapPlaces.length > 0 ? mapPlaces.slice(0, 6).map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => {
                    showPlace(place.id)
                    setMapSearch('')
                  }}
                >
                  <span><strong>{place.copy[language].title}</strong><small>{place.copy[language].subtitle}</small></span>
                  <MapPinned size={15} />
                </button>
              )) : <p>{translate(language, 'noResults')}</p>}
            </div>
          )}
        </>
      )}
      {previewVisible && (
        <button
          type="button"
          className="map-place-preview"
          aria-label={`${translate(language, 'openDetails')}: ${selectedMapPlace.copy[language].title}`}
          onClick={() => {
            setExpanded(false)
            onShowPlaceDetails()
          }}
        >
          <span className="map-place-preview-meta">
            <span>{categoryLabels[language][selectedMapPlace.category]}</span>
            <span>{selectedMapPlace.duration} {translate(language, 'minute')}</span>
          </span>
          <strong className="map-place-preview-title">{selectedMapPlace.copy[language].title}</strong>
          <span className="map-place-preview-subtitle">{selectedMapPlace.copy[language].subtitle}</span>
          <span className="map-place-preview-story">{selectedMapPlace.copy[language].narration}</span>
          <span className="map-place-preview-action">{translate(language, 'openDetails')} <ArrowRight size={14} /></span>
        </button>
      )}
      {offline && !offlineMap && <div className="map-offline-hint">{translate(language, 'offlineMapRequired')}</div>}
      {error === 'offlinePackError' && <div className="map-offline-hint">{translate(language, 'offlinePackError')}</div>}
      {routeStatus && (
        <div className={`map-route-status is-${routeStatus}`} role={routeStatus === 'loading' ? 'status' : 'alert'}>
          {routeStatus === 'loading' && <LoaderCircle className="loading-spinner" size={14} aria-hidden="true" />}
          {translate(language, routeStatus === 'loading' ? 'routeLoading' : routeStatus === 'offline' ? 'routeOffline' : 'routeError')}
        </div>
      )}
      {directionsStatus && (
        <div className={`map-route-status map-directions-status is-${directionsStatus}`} role={directionsStatus === 'loading' || directionsStatus === 'locating' ? 'status' : 'alert'}>
          {(directionsStatus === 'loading' || directionsStatus === 'locating') && <LoaderCircle className="loading-spinner" size={14} aria-hidden="true" />}
          {directionsStatus === 'locating'
            ? translate(language, 'locating')
            : directionsStatus === 'offline'
              ? translate(language, 'routeOffline')
              : directionsStatus === 'unsupported'
                ? translate(language, 'gpsUnsupported')
                : directionsStatus === 'error'
                ? showDirections || placeRoute ? translate(language, 'routeError') : translate(language, 'gpsError')
                : translate(language, 'routeLoading')}
        </div>
      )}
      {placeRoutePlannerOpen && (
        <form className="map-route-planner" onSubmit={submitPlaceRoute}>
          <label>
            <span>{translate(language, 'routeOrigin')}</span>
            <select value={fromPlaceId} onChange={(event) => setFromPlaceId(event.target.value)} required>
              {routeEndpointOptions}
            </select>
          </label>
          <label>
            <span>{translate(language, 'routeDestination')}</span>
            <select value={toPlaceId} onChange={(event) => setToPlaceId(event.target.value)} required>
              {routeEndpointOptions}
            </select>
          </label>
          <button type="button" className="map-route-swap" onClick={() => { setFromPlaceId(toPlaceId); setToPlaceId(fromPlaceId) }}>
            <ArrowUpDown size={13} />{ui(language, 'swap')}
          </button>
          <button type="submit" disabled={!fromPlaceId || !toPlaceId || fromPlaceId === toPlaceId || directionsStatus === 'locating'}>
            <Route size={14} />{translate(language, 'showRoute')}
          </button>
        </form>
      )}
      <div className="map-controls" aria-label="Map controls">
        <button onClick={() => setExpanded((value) => !value)} aria-label={expanded ? 'Exit full screen map' : 'Expand map'} title={expanded ? 'Exit full screen' : 'Expand map'}>
          {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
        <button onClick={() => map.current?.zoomIn()} aria-label="Zoom in"><Plus size={18} /></button>
        <button onClick={() => map.current?.zoomOut()} aria-label="Zoom out"><Minus size={18} /></button>
        <button
          onClick={() => map.current?.rotateTo(map.current.getBearing() - 45, { duration: 300 })}
          aria-label={ui(language, 'rotateMap')}
          title={ui(language, 'rotateHint')}
        >
          <RotateCw size={16} />
        </button>
        <button
          className={`map-compass${Math.abs(bearing) > 0.5 || pitch > 0.5 ? ' is-rotated' : ''}`}
          onClick={() => map.current?.easeTo({ bearing: 0, pitch: 0, duration: 400 })}
          aria-label={ui(language, 'resetNorth')}
          title={ui(language, 'northWithBearing', { n: Math.round(((bearing % 360) + 360) % 360) })}
        >
          <Compass size={17} style={{ transform: `rotate(${-bearing - 45}deg)` }} />
        </button>
        <span className="map-control-divider" />
        <button onClick={centerOnLocation} aria-label={translate(language, 'locate')} title={translate(language, 'locate')}><LocateFixed size={17} /></button>
        <button onClick={openPlaceRoutePlanner} aria-label={translate(language, 'placeDirections')} title={translate(language, 'placeDirections')} aria-expanded={placeRoutePlannerOpen}><Route size={17} /></button>
        <button onClick={toggleDirections} aria-label={translate(language, showDirections ? 'hideDirections' : 'directions')} title={translate(language, showDirections ? 'hideDirections' : 'directions')}><MapPinned size={17} /></button>
      </div>
      <div className="map-caption"><span className="map-caption-dot" /> {ui(language, 'regionName').toLocaleUpperCase(language)}</div>
    </div>
  )
}

async function fetchRoadRoute(coordinates: [number, number][], signal: AbortSignal): Promise<[number, number][]> {
  const waypoints = coordinates.map(([longitude, latitude]) => `${longitude},${latitude}`).join(';')
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`,
    { signal },
  )
  if (!response.ok) throw new Error(`Routing service returned HTTP ${response.status}.`)

  const result: unknown = await response.json()
  if (typeof result !== 'object' || result === null || !('code' in result) || result.code !== 'Ok' || !('routes' in result) || !Array.isArray(result.routes)) {
    throw new Error('Routing service returned no route.')
  }

  const geometry = result.routes[0]?.geometry
  if (
    typeof geometry !== 'object' ||
    geometry === null ||
    !('type' in geometry) ||
    geometry.type !== 'LineString' ||
    !('coordinates' in geometry) ||
    !isRouteCoordinates(geometry.coordinates)
  ) {
    throw new Error('Routing service returned invalid route geometry.')
  }

  return geometry.coordinates
}

function isRouteCoordinates(value: unknown): value is [number, number][] {
  return Array.isArray(value) && value.length >= 2 && value.every(
    (coordinate) =>
      Array.isArray(coordinate) &&
      coordinate.length >= 2 &&
      typeof coordinate[0] === 'number' &&
      Number.isFinite(coordinate[0]) &&
      typeof coordinate[1] === 'number' &&
      Number.isFinite(coordinate[1]),
  )
}

function getVectorLayers(metadata: unknown): { id: string }[] {
  if (typeof metadata !== 'object' || metadata === null || !('vector_layers' in metadata) || !Array.isArray(metadata.vector_layers)) return []
  return metadata.vector_layers.filter(
    (item): item is { id: string } => typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string',
  )
}

function placeFeatures(places: Place[]) {
  return {
    type: 'FeatureCollection' as const,
    features: places.map((place) => ({
      type: 'Feature' as const,
      id: place.id,
      geometry: { type: 'Point' as const, coordinates: place.coordinates },
      properties: { id: place.id },
    })),
  }
}

function syncPlaceMarkers(
  map: MapLibreMap,
  places: Place[],
  language: Language,
  selectedId: string,
  onSelect: { current: (id: string) => void },
  markers: Map<string, maplibregl.Marker>,
) {
  const visibleIds = new Set(places.map((place) => place.id))
  for (const [id, marker] of markers) {
    if (visibleIds.has(id)) continue
    marker.remove()
    markers.delete(id)
  }

  for (const place of places) {
    let marker = markers.get(place.id)
    if (!marker) {
      const element = document.createElement('button')
      element.type = 'button'
      element.className = 'poi-map-label'
      element.setAttribute('aria-label', place.copy[language].title)
      const dot = document.createElement('span')
      dot.className = 'poi-map-dot'
      const title = document.createElement('span')
      title.className = 'poi-map-title'
      element.append(dot, title)
      element.addEventListener('click', (event) => {
        event.stopPropagation()
        onSelect.current(place.id)
      })
      marker = new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat(place.coordinates).addTo(map)
      markers.set(place.id, marker)
    }
    const element = marker.getElement()
    const title = element.querySelector('.poi-map-title')
    if (title) title.textContent = place.copy[language].title
    element.setAttribute('aria-label', place.copy[language].title)
    element.classList.toggle('selected', place.id === selectedId)
    marker.setLngLat(place.coordinates)
  }
}

function updateLayers(
  map: MapLibreMap,
  places: Place[],
  selectedId: string,
  location: [number, number] | null,
) {
  const placesSource = map.getSource('places')
  if (placesSource instanceof GeoJSONSource) {
    placesSource.setData(placeFeatures(places))
    map.setPaintProperty('place-halos', 'circle-color', ['case', ['==', ['get', 'id'], selectedId], '#c77952', '#f8f4ea'])
    map.setPaintProperty('place-halos', 'circle-stroke-color', ['case', ['==', ['get', 'id'], selectedId], '#fffaf1', '#607363'])
    map.setPaintProperty('place-dots', 'circle-color', ['case', ['==', ['get', 'id'], selectedId], '#fffaf1', '#607363'])
  }

  const locationSource = map.getSource('user-location')
  if (locationSource instanceof GeoJSONSource) {
    locationSource.setData({
      type: 'FeatureCollection',
      features: location ? [{ type: 'Feature', geometry: point(location).geometry, properties: {} }] : [],
    })
  }

}

function syncRoadRoute(map: MapLibreMap, coordinates: [number, number][] | null) {
  const data = coordinates ? lineString(coordinates) : { type: 'FeatureCollection' as const, features: [] }
  const source = map.getSource('walk-route')
  if (source instanceof GeoJSONSource) {
    source.setData(data)
    return
  }

  map.addSource('walk-route', { type: 'geojson', data })
  map.addLayer({
    id: 'walk-route-line',
    type: 'line',
    source: 'walk-route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#c77952', 'line-width': 4, 'line-opacity': 0.9 },
  }, 'place-halos')
}

function syncDirectionsRoute(map: MapLibreMap, coordinates: [number, number][] | null) {
  const data = coordinates ? lineString(coordinates) : { type: 'FeatureCollection' as const, features: [] }
  const source = map.getSource('directions-route')
  if (source instanceof GeoJSONSource) {
    source.setData(data)
    return
  }

  map.addSource('directions-route', { type: 'geojson', data })
  map.addLayer({
    id: 'directions-route-line',
    type: 'line',
    source: 'directions-route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#477daf', 'line-width': 5, 'line-opacity': 0.95 },
  }, 'place-halos')
}
