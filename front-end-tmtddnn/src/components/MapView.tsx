import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Protocol, PMTiles } from 'pmtiles'
import { lineString, point } from '@turf/turf'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import { getOfflineMap } from '../db'
import { translate } from '../i18n'
import { makeOfflineStyle, makeOnlineStyle } from '../mapStyle'
import { useAppStore } from '../store'
import { findPlace, places as allPlaces } from '../data/places'
import type { Language, Place } from '../types'

const protocol = new Protocol()
maplibregl.setWorkerUrl(mapWorkerUrl)
maplibregl.addProtocol('pmtiles', protocol.tile)
const archives = new Map<number, { url: string; archive: PMTiles }>()

interface MapViewProps {
  places: Place[]
  language: Language
  selectedPlaceId: string
  onSelectPlace: (id: string) => void
}

export function MapView({ places, language, selectedPlaceId, onSelectPlace }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const placeMarkers = useRef(new Map<string, maplibregl.Marker>())
  const selectedId = useRef(selectedPlaceId)
  const onSelect = useRef(onSelectPlace)
  const offline = useAppStore((state) => state.useOfflineMap)
  const offlineMap = useAppStore((state) => state.offlineMap)
  const online = useAppStore((state) => state.online)
  const location = useAppStore((state) => state.location)
  const routeIds = useAppStore((state) => state.routeIds)
  const error = useAppStore((state) => state.storageError)
  const [mapReady, setMapReady] = useState(false)
  const [routeStatus, setRouteStatus] = useState<'loading' | 'offline' | 'error' | null>(null)
  const currentProps = useRef({ places, language, location })

  selectedId.current = selectedPlaceId
  onSelect.current = onSelectPlace
  currentProps.current = { places, language, location }

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
        cooperativeGestures: true,
      })
      map.current = instance
      instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      instance.once('style.load', () => {
        if (cancelled) return
        setMapReady(true)
        instance.addSource('places', { type: 'geojson', data: placeFeatures(places) })
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
    syncPlaceMarkers(map.current, places, language, selectedPlaceId, onSelect, placeMarkers.current)
    if (!map.current.isStyleLoaded()) return
    updateLayers(map.current, places, selectedPlaceId, location)
  }, [places, selectedPlaceId, language, location, routeIds])

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
    setRouteStatus('loading')
    syncRoadRoute(instance, null)

    void fetchRoadRoute(coordinates, controller.signal)
      .then((roadCoordinates) => {
        if (controller.signal.aborted || map.current !== instance) return
        syncRoadRoute(instance, roadCoordinates)
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
  }, [mapReady, routeIds, online])

  useEffect(() => {
    const selectedPlace = findPlace(selectedPlaceId)
    if (selectedPlace && map.current?.isStyleLoaded()) {
      map.current.flyTo({ center: selectedPlace.coordinates, zoom: 14, duration: 600 })
    }
  }, [selectedPlaceId])

  const centerOnLocation = () => {
    if (!location) return
    map.current?.flyTo({ center: location, zoom: 17, speed: 0.8 })
  }

  return (
    <div className="map-stage">
      <div className="map-canvas" ref={container} aria-label={translate(language, 'map')} />
      {offline && !offlineMap && <div className="map-offline-hint">{translate(language, 'offlineMapRequired')}</div>}
      {error === 'offlinePackError' && <div className="map-offline-hint">{translate(language, 'offlinePackError')}</div>}
      {routeStatus && (
        <div className={`map-route-status is-${routeStatus}`} role={routeStatus === 'loading' ? 'status' : 'alert'}>
          {translate(language, routeStatus === 'loading' ? 'routeLoading' : routeStatus === 'offline' ? 'routeOffline' : 'routeError')}
        </div>
      )}
      <div className="map-controls" aria-label="Map controls">
        <button onClick={() => map.current?.zoomIn()} aria-label="Zoom in"><Plus size={18} /></button>
        <button onClick={() => map.current?.zoomOut()} aria-label="Zoom out"><Minus size={18} /></button>
        <span className="map-control-divider" />
        <button onClick={centerOnLocation} aria-label={translate(language, 'locate')} disabled={!location}><LocateFixed size={17} /></button>
      </div>
      <div className="map-caption"><span className="map-caption-dot" /> QUANG TRI · QUANG BINH</div>
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
