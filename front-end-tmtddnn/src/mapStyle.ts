import type { StyleSpecification } from 'maplibre-gl'

export function makeOnlineStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      streets: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'street-tiles', type: 'raster', source: 'streets' }],
  }
}

export function makeOfflineStyle(url: string, vectorLayers: { id: string }[]): StyleSpecification {
  const layers: StyleSpecification['layers'] = [{ id: 'offline-background', type: 'background', paint: { 'background-color': '#f1eee4' } }]
  for (const [index, sourceLayer] of vectorLayers.entries()) {
    const safeId = `${index}-${sourceLayer.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
    layers.push(
      {
        id: `${safeId}-areas`,
        type: 'fill',
        source: 'offline',
        'source-layer': sourceLayer.id,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#e6dfcf', 'fill-opacity': 0.72 },
      },
      {
        id: `${safeId}-lines`,
        type: 'line',
        source: 'offline',
        'source-layer': sourceLayer.id,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#b7a88d', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 17, 2] },
      },
      {
        id: `${safeId}-points`,
        type: 'circle',
        source: 'offline',
        'source-layer': sourceLayer.id,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-color': '#829080', 'circle-radius': 2, 'circle-opacity': 0.68 },
      },
    )
  }
  return {
    version: 8,
    sources: { offline: { type: 'vector', url: `pmtiles://${url}` } },
    layers,
  }
}
