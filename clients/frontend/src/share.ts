// Tạo liên kết chia sẻ địa điểm/hành trình và chia sẻ bằng Web Share API hoặc sao chép.

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

const MAX_SHARED_STOPS = 20

function origin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin
}

export function placeShareUrl(placeId: string): string {
  return `${origin()}/explore?place=${encodeURIComponent(placeId)}`
}

export function routeShareUrl(placeIds: string[]): string {
  return `${origin()}/explore?route=${placeIds.slice(0, MAX_SHARED_STOPS).map(encodeURIComponent).join(',')}`
}

/** Đọc tham số chia sẻ trên URL; chỉ giữ mã địa điểm có trong danh mục hiện tại. */
export function readSharedLink(search: string, knownIds: Set<string>): { placeId: string | null; routeIds: string[] } {
  const params = new URLSearchParams(search)
  const place = params.get('place')
  const route = params.get('route')
  const placeId = place && knownIds.has(place) ? place : null
  const routeIds = route
    ? [...new Set(route.split(',').filter((id) => knownIds.has(id)))].slice(0, MAX_SHARED_STOPS)
    : []
  return { placeId, routeIds }
}

export async function shareLink(title: string, text: string, url: string): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url })
      return 'shared'
    } catch (error) {
      // Người dùng đóng bảng chia sẻ: không coi là lỗi.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
