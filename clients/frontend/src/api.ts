// Định nghĩa các lời gọi tới backend và chuyển đổi dữ liệu API cho giao diện.
import type { Language, Place, SavedTour, UserProfile } from './types'

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

export interface AuthResponse {
  token: string
  user: UserProfile
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

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export async function registerAccount(
  fullName: string,
  email: string,
  phone: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, phone, password }),
  })
}

export async function loginAccount(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function fetchCurrentUser(token: string): Promise<UserProfile> {
  return request<UserProfile>('/auth/me', undefined, token)
}

export async function logoutAccount(token: string): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' }, token)
}

export function getStoredAuthToken() {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem('quang-tri:auth-token:v1')
}

export function storeAuthToken(token: string | null) {
  if (typeof localStorage === 'undefined') return
  if (token) localStorage.setItem('quang-tri:auth-token:v1', token)
  else localStorage.removeItem('quang-tri:auth-token:v1')
}

export async function fetchTours(token: string): Promise<SavedTour[]> {
  const result = await request<ApiCollection<SavedTour>>('/tours', undefined, token)
  return result.items
}

export async function createTour(tour: SavedTour, token: string): Promise<SavedTour> {
  return request<SavedTour>('/tours', {
    method: 'POST',
    body: JSON.stringify({
      id: tour.id,
      placeIds: tour.placeIds,
      createdAt: tour.createdAt,
    }),
  }, token)
}

export async function deleteRemoteTour(id: string, token: string): Promise<void> {
  await request<void>(`/tours/${encodeURIComponent(id)}`, { method: 'DELETE' }, token)
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
