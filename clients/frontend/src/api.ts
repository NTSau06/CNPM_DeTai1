import type { Language, Place, SavedTour } from './types'

interface ApiPlace {
  id: string
  category: Place['category']
  coordinates: [number, number]
  duration: number
  image: string
  copy: Partial<Record<Language, Place['copy'][Language]>>
}

interface ApiCollection<T> {
  items: T[]
  total: number
}

export interface PlaceRatingSummary {
  placeId: string
  averageRating: number | null
  totalRatings: number
  reviews: { rating: number; review: string; createdAt: string }[]
}

export interface PlaceAnalytics {
  placeId: string
  visits: number
  averageRating: number | null
  ratingCount: number
}

export class BackendApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'BackendApiError'
  }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch (error) {
    notifyApiFailure('network')
    throw new BackendApiError(
      error instanceof Error ? error.message : 'Backend connection failed.',
      0,
    )
  }

  if (!response.ok) {
    if (response.status >= 500) notifyApiFailure('server')
    let message = `Backend request failed (${response.status}).`
    try {
      const payload: unknown = await response.json()
      if (typeof payload === 'object' && payload !== null && 'detail' in payload && typeof payload.detail === 'string') {
        message = payload.detail
      }
    } catch {
      message = `Backend request failed (${response.status}).`
    }
    throw new BackendApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function notifyApiFailure(kind: 'network' | 'server') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-api-error', { detail: { kind } }))
  }
}

export async function fetchPlaces(): Promise<ApiPlace[]> {
  const result = await request<ApiCollection<ApiPlace>>('/places')
  return result.items
}

export async function fetchTours(): Promise<SavedTour[]> {
  const result = await request<ApiCollection<SavedTour>>('/tours')
  return result.items
}

export async function createTour(tour: SavedTour): Promise<SavedTour> {
  return request<SavedTour>('/tours', {
    method: 'POST',
    body: JSON.stringify({
      id: tour.id,
      placeIds: tour.placeIds,
      createdAt: tour.createdAt,
    }),
  })
}

export async function deleteRemoteTour(id: string): Promise<void> {
  await request<void>(`/tours/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function getVisitorId(): Promise<string> {
  const key = 'quang-tri:visitor-id:v1'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const visitorId = crypto.randomUUID()
  localStorage.setItem(key, visitorId)
  return visitorId
}

export async function recordVisit(
  placeId: string,
  visitorId: string,
  coordinates: [number, number],
): Promise<boolean> {
  const result = await request<{ recorded: boolean }>('/analytics/visits', {
    method: 'POST',
    body: JSON.stringify({ placeId, visitorId, coordinates }),
  })
  return result.recorded
}

export async function getPlaceAnalytics(placeId: string): Promise<PlaceAnalytics> {
  return request(`/places/${encodeURIComponent(placeId)}/analytics`)
}

export async function getPlaceRatings(placeId: string): Promise<PlaceRatingSummary> {
  return request(`/places/${encodeURIComponent(placeId)}/ratings`)
}

export async function submitPlaceRating(
  placeId: string,
  visitorId: string,
  rating: number,
  review: string,
): Promise<PlaceRatingSummary> {
  return request('/analytics/ratings', {
    method: 'POST',
    body: JSON.stringify({ placeId, visitorId, rating, review }),
  })
}

export function mergeRemotePlaces(localPlaces: Place[], remotePlaces: ApiPlace[]): Place[] {
  const remoteById = new Map(remotePlaces.map((place) => [place.id, place]))
  const retiredPlaceIds = new Set(['truong-son-cemetery'])
  return localPlaces.flatMap((place) => {
    if (retiredPlaceIds.has(place.id)) return []
    const remote = remoteById.get(place.id)
    if (!remote) return [place]
    return [{
      ...place,
      category: remote.category,
      coordinates: remote.coordinates,
      duration: remote.duration,
      image: remote.image,
      copy: { ...place.copy, ...remote.copy },
    }]
  })
}

export type { ApiPlace }
