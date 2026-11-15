export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export interface UserProfile {
  id: string; fullName: string; email: string; phone: string; birthDate: string
  gender: '' | 'female' | 'male' | 'other' | 'prefer-not-to-say'; address: string
}
export interface TicketPrice { placeId: string; priceVnd: number | null }
export interface TicketOrder { id: string; placeId: string; quantity: number; totalPriceVnd: number; createdAt: number }
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
    throw new Error(error instanceof Error ? error.message : 'Backend connection failed.')
  }
  if (!response.ok) {
    const detail = await response.text()
    throw new ApiError(response.status, detail)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

