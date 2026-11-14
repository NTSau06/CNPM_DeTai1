// Định nghĩa các lời gọi tới backend và chuyển đổi dữ liệu API cho giao diện.
import type { Language, Place, SavedTour, UserProfile } from './types'

export interface ApiPlace {
  id: string
  category: Place['category']
  coordinates: [number, number]
  duration: number
  image: string
  copy: Partial<Record<Language, Place['copy'][Language]>>
  detailSections?: Place['detailSections']
  detailImage?: Place['detailImage'] | null
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

export interface OnlineVisitorCount {
  onlineVisitors: number
}

export interface AdminOverview extends OnlineVisitorCount {
  accountCount: number
  activeAccountCount: number
  placeCount: number
  visits: number
  ratingCount: number
  tickets?: TicketSalesSummary
  analytics: {
    visitsLast30Days: number
    totalRatings: number
    averageRating: number | null
    places: PlaceAnalytics[]
    latestReviews: {
      placeId: string
      rating: number
      review: string
      createdAt: string
    }[]
  }
}

export interface AdminUser {
  id: string
  fullName: string
  email: string
  phone: string
  isAdmin: boolean
}

export interface TicketPrice {
  placeId: string
  priceVnd: number | null
}

export interface TicketOrder {
  id: string
  placeId: string
  quantity: number
  unitPriceVnd: number
  totalPriceVnd: number
  createdAt: string
}

export interface TicketSalesSummary {
  totalTicketsSold: number
  totalOrders: number
  totalRevenueVnd: number
  places: { placeId: string; ticketsSold: number; revenueVnd: number }[]
  recentOrders: TicketOrder[]
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

export interface PairingTicket {
  code: string
  expiresAt: number
  expiresIn: number
  signedIn: boolean
}

export type PairingStatus = 'pending' | 'claimed' | 'expired'

export interface PairingClaim {
  language: Language
  placeId: string | null
  path: string
  token: string | null
  user: UserProfile | null
}

// Máy tính tạo phiên ghép nối; gửi kèm token để điện thoại được cấp phiên đăng nhập riêng.
export async function createPairing(
  language: Language,
  placeId: string | null,
  token: string | null,
): Promise<PairingTicket> {
  return request<PairingTicket>('/pairing', {
    method: 'POST',
    body: JSON.stringify({ language, placeId, path: '/explore' }),
  }, token ?? undefined)
}

export async function getPairingStatus(code: string): Promise<PairingStatus> {
  try {
    const result = await request<{ status: PairingStatus }>(`/pairing/${encodeURIComponent(code)}`)
    return result.status
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) return 'expired'
    throw error
  }
}

export async function claimPairing(code: string): Promise<PairingClaim> {
  return request<PairingClaim>(`/pairing/${encodeURIComponent(code)}/claim`, { method: 'POST' })
}

export async function fetchCurrentUser(token: string): Promise<UserProfile> {
  return request<UserProfile>('/auth/me', undefined, token)
}

export async function updateProfile(token: string, profile: UserProfile): Promise<UserProfile> {
  return request<UserProfile>('/auth/me', {
    method: 'PUT',
    body: JSON.stringify({
      fullName: profile.fullName,
      phone: profile.phone,
      birthDate: profile.birthDate,
      gender: profile.gender,
      address: profile.address,
    }),
  }, token)
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  }, token)
}
export async function logoutAccount(token: string): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' }, token)
}

export async function sendSessionHeartbeat(token: string): Promise<void> {
  await request<void>('/auth/heartbeat', { method: 'POST' }, token)
}

export async function loginAdmin(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function logoutAdmin(token: string): Promise<void> {
  await request<void>('/admin/logout', { method: 'POST' }, token)
}

export async function fetchAdminOverview(token: string): Promise<AdminOverview> {
  return request<AdminOverview>('/admin/overview', undefined, token)
}

export async function fetchTicketPrices(): Promise<TicketPrice[]> {
  const result = await request<{ items: TicketPrice[] }>('/tickets/prices')
  return result.items
}

export async function fetchMyTicketOrders(token: string): Promise<TicketOrder[]> {
  const result = await request<{ items: TicketOrder[]; total: number }>('/tickets/orders', undefined, token)
  return result.items
}

export async function createTicketOrder(
  placeId: string,
  quantity: number,
  token: string,
): Promise<TicketOrder> {
  return request<TicketOrder>('/tickets/orders', {
    method: 'POST',
    body: JSON.stringify({ placeId, quantity }),
  }, token)
}

export async function updateAdminTicketPrice(
  placeId: string,
  priceVnd: number | null,
  token: string,
): Promise<TicketPrice> {
  return request<TicketPrice>(`/admin/tickets/prices/${encodeURIComponent(placeId)}`, {
    method: 'PUT',
    body: JSON.stringify({ priceVnd }),
  }, token)
}

export function getStoredAdminToken() {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem('quang-tri:admin-token:v1')
}

export function storeAdminToken(token: string | null) {
  if (typeof localStorage === 'undefined') return
  if (token) localStorage.setItem('quang-tri:admin-token:v1', token)
  else localStorage.removeItem('quang-tri:admin-token:v1')
}

export function getStoredAuthToken() {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem('quang-tri:auth-token:v1')
}

export function storeAuthToken(token: string | null) {
  if (typeof localStorage === 'undefined') return
  if (token) localStorage.setItem('quang-tri:auth-token:v1', token)
  else localStorage.removeItem('quang-tri:auth-token:v1')
}

export function getStoredAdminAuthToken() {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem('quang-tri:admin-auth-token:v1')
}

export function storeAdminAuthToken(token: string | null) {
  if (typeof localStorage === 'undefined') return
  if (token) localStorage.setItem('quang-tri:admin-auth-token:v1', token)
  else localStorage.removeItem('quang-tri:admin-auth-token:v1')
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

/**
 * Tạo UUID v4. `crypto.randomUUID()` chỉ có trong ngữ cảnh an toàn (HTTPS/localhost),
 * nên khi mở bằng http://<IP-LAN> trên điện thoại phải dùng getRandomValues.
 */
export function generateId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function getVisitorId(): Promise<string> {
  const key = 'quang-tri:visitor-id:v1'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const visitorId = generateId()
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

export async function updateOnlinePresence(visitorId: string): Promise<void> {
  await request<void>('/analytics/presence', {
    method: 'POST',
    body: JSON.stringify({ visitorId }),
  })
}

/** Báo thiết bị đã rời trang; dùng sendBeacon để vẫn gửi được khi tab đang đóng. */
export function leaveOnlinePresence(visitorId: string): void {
  const url = `${baseUrl}/analytics/presence/leave`
  const body = JSON.stringify({ visitorId })
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return
  } catch {
    // Chuyển sang fetch bên dưới.
  }
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined)
}

export async function getOnlineVisitorCount(): Promise<OnlineVisitorCount> {
  return request('/analytics/presence')
}

export async function getAdminOnlineVisitorCount(token: string): Promise<OnlineVisitorCount> {
  return request('/admin/analytics/online', undefined, token)
}

export async function getAdminOverview(token: string): Promise<AdminOverview> {
  return request('/admin/overview', undefined, token)
}

export async function getAdminUsers(token: string): Promise<AdminUser[]> {
  const result = await request<ApiCollection<AdminUser>>('/admin/users', undefined, token)
  return result.items
}

export async function deleteAdminUser(userId: string, token: string): Promise<void> {
  await request<void>(`/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' }, token)
}

export async function createAdminPlace(place: ApiPlace, token: string): Promise<ApiPlace> {
  return request<ApiPlace>('/admin/places', {
    method: 'POST',
    body: JSON.stringify(place),
  }, token)
}

export async function updateAdminPlace(placeId: string, place: ApiPlace, token: string): Promise<ApiPlace> {
  return request<ApiPlace>(`/admin/places/${encodeURIComponent(placeId)}`, {
    method: 'PUT',
    body: JSON.stringify(place),
  }, token)
}

export async function deleteAdminPlace(placeId: string, token: string): Promise<void> {
  await request<void>(`/admin/places/${encodeURIComponent(placeId)}`, { method: 'DELETE' }, token)
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
  const retiredPlaceIds = new Set(['truong-son-cemetery'])
  const localById = new Map(localPlaces.map((place) => [place.id, place]))
  return remotePlaces.flatMap((remote) => {
    if (retiredPlaceIds.has(remote.id)) return []
    const place = localById.get(remote.id)
    if (!place) {
      const vietnameseCopy = remote.copy.vi ?? Object.values(remote.copy)[0]
      if (!vietnameseCopy) return []
      return [{
        ...remote,
        copy: {
          vi: remote.copy.vi ?? vietnameseCopy,
          en: remote.copy.en ?? vietnameseCopy,
          ja: remote.copy.ja ?? vietnameseCopy,
          fr: remote.copy.fr ?? vietnameseCopy,
          'zh-CN': remote.copy['zh-CN'] ?? vietnameseCopy,
          'ko-KR': remote.copy['ko-KR'] ?? vietnameseCopy,
          es: remote.copy.es ?? vietnameseCopy,
        },
        detailSections: remote.detailSections ?? [],
        detailImage: remote.detailImage ?? { src: '', alt: vietnameseCopy.title, caption: '' },
      }]
    }
    return [{
      ...place,
      category: remote.category,
      coordinates: remote.coordinates,
      duration: remote.duration,
      image: remote.image,
      copy: { ...place.copy, ...remote.copy },
      detailSections: remote.detailSections?.length ? remote.detailSections : place.detailSections,
      detailImage: remote.detailImage ?? place.detailImage,
    }]
  })
}
