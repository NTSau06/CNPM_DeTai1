// Gọi API Gateway từ ứng dụng di động và khai báo kiểu dữ liệu dùng chung.
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export interface UserProfile {
  id: string; fullName: string; email: string; phone: string; birthDate: string
  gender: '' | 'female' | 'male' | 'other' | 'prefer-not-to-say'; address: string
  isAdmin?: boolean
}
export interface TicketPrice { placeId: string; priceVnd: number | null }
export interface TicketOrder {
  id: string
  ticketCode?: string
  placeId: string
  quantity: number
  unitPriceVnd: number
  totalPriceVnd: number
  createdAt: string
  status?: 'pending' | 'paid' | 'cancelled' | 'expired'
  expiresAt?: string | null
}

export async function api<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch (error) {
    throw new ApiError(0, error instanceof Error ? error.message : 'Backend connection failed.')
  }
  if (!response.ok) {
    // Backend FastAPI trả lỗi dạng {"detail": "..."}; lấy phần detail để hiển thị.
    let detail = `Request failed (${response.status}).`
    try {
      const payload: unknown = await response.json()
      if (typeof payload === 'object' && payload !== null && 'detail' in payload && typeof payload.detail === 'string') {
        detail = payload.detail
      }
    } catch {
      // Giữ thông báo mặc định.
    }
    throw new ApiError(response.status, detail)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const formatVnd = (value: number, locale: string) => `${value.toLocaleString(locale)} ₫`

export async function fetchTicketPrices(): Promise<TicketPrice[]> {
  return (await api<{ items: TicketPrice[] }>('/tickets/prices')).items
}

export async function fetchMyTicketOrders(token: string): Promise<TicketOrder[]> {
  return (await api<{ items: TicketOrder[] }>('/tickets/orders', undefined, token)).items
}

export async function createTicketOrder(placeId: string, quantity: number, token: string): Promise<TicketOrder> {
  return api<TicketOrder>('/tickets/orders', {
    method: 'POST',
    body: JSON.stringify({ placeId, quantity }),
  }, token)
}

export async function cancelTicketOrder(orderId: string, token: string): Promise<TicketOrder> {
  return api<TicketOrder>(`/tickets/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' }, token)
}

export async function fetchProfile(token: string): Promise<UserProfile> {
  return api<UserProfile>('/auth/me', undefined, token)
}

const EMAIL_LOCAL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/
const EMAIL_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const EMAIL_TLD_PATTERN = /^(?:[a-z]{2,63}|xn--[a-z0-9]{1,59}(?:-[a-z0-9]+)*)$/

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidEmail(value: string): boolean {
  const normalized = normalizeEmail(value)
  if (!normalized || normalized.length > 254) return false
  const atIndex = normalized.indexOf('@')
  if (atIndex <= 0 || atIndex !== normalized.lastIndexOf('@')) return false
  const local = normalized.slice(0, atIndex)
  const domain = normalized.slice(atIndex + 1)
  if (
    local.length > 64 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    !EMAIL_LOCAL_PATTERN.test(local)
  ) {
    return false
  }
  if (!domain || domain.length > 253 || !domain.includes('.')) return false
  const labels = domain.split('.')
  if (labels.length < 2 || labels.some((label) => !EMAIL_LABEL_PATTERN.test(label))) {
    return false
  }
  return EMAIL_TLD_PATTERN.test(labels[labels.length - 1])
}

export async function updateProfile(token: string, profile: UserProfile): Promise<UserProfile> {
  return api<UserProfile>('/auth/me', {
    method: 'PUT',
    body: JSON.stringify({
      fullName: profile.fullName,
      email: normalizeEmail(profile.email),
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
): Promise<{ token: string; user: UserProfile }> {
  return api('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  }, token)
}

export async function deleteOwnAccount(token: string, password: string): Promise<void> {
  await api<void>('/auth/me', { method: 'DELETE', body: JSON.stringify({ password }) }, token)
}
