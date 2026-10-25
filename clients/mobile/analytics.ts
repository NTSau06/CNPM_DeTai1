import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const VISITOR_KEY = 'quang-tri:visitor-id:v1'

export class AnalyticsApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'AnalyticsApiError'
  }
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    let detail = `Request failed (${response.status}).`
    try {
      const payload: unknown = await response.json()
      if (typeof payload === 'object' && payload !== null && 'detail' in payload && typeof payload.detail === 'string') {
        detail = payload.detail
      }
    } catch {
      detail = `Request failed (${response.status}).`
    }
    throw new AnalyticsApiError(detail, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function getVisitorId(): Promise<string> {
  const existing = await AsyncStorage.getItem(VISITOR_KEY)
  if (existing) return existing
  const visitorId = Crypto.randomUUID()
  await AsyncStorage.setItem(VISITOR_KEY, visitorId)
  return visitorId
}

export async function recordNearbyVisit(
  placeId: string,
  coordinates: [number, number],
): Promise<void> {
  const day = new Date().toISOString().slice(0, 10)
  const key = `quang-tri:visit:${placeId}:${day}`
  if (await AsyncStorage.getItem(key)) return
  const visitorId = await getVisitorId()
  await request('/analytics/visits', {
    method: 'POST',
    body: JSON.stringify({ placeId, visitorId, coordinates }),
  })
  await AsyncStorage.setItem(key, '1')
}

export async function getPlaceAnalytics(placeId: string): Promise<PlaceAnalytics> {
  return request(`/places/${encodeURIComponent(placeId)}/analytics`)
}

export async function getPlaceRatings(placeId: string): Promise<PlaceRatingSummary> {
  return request(`/places/${encodeURIComponent(placeId)}/ratings`)
}

export async function submitPlaceRating(
  placeId: string,
  rating: number,
  review: string,
): Promise<PlaceRatingSummary> {
  const visitorId = await getVisitorId()
  return request('/analytics/ratings', {
    method: 'POST',
    body: JSON.stringify({ placeId, visitorId, rating, review }),
  })
}
