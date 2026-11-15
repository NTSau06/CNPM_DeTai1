/// <reference lib="webworker" />
// Cache tài nguyên, tile bản đồ và API để ứng dụng tiếp tục hoạt động ngoại tuyến.
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> }

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST, {
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/],
})

// Mở lại đường dẫn như /saved bằng giao diện đã lưu khi mất mạng.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), {
  denylist: [/^\/api\//, /^\/static\//],
}))

registerRoute(
  ({ url }) => url.origin === 'https://tile.openstreetmap.de',
  new CacheFirst({
    cacheName: 'osm-map-tiles-v2',
    plugins: [new ExpirationPlugin({ maxEntries: 1400, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true })],
  }),
)

registerRoute(
  // Dữ liệu riêng tư dùng cache IndexedDB theo tài khoản, tránh lẫn phản hồi API.
  ({ url, request }) => url.pathname.startsWith('/api/')
    && !request.headers.has('Authorization')
    && !/^\/api\/v1\/(auth|tours|admin|pairing)(\/|$)/.test(url.pathname),
  new NetworkFirst({
    cacheName: 'quang-tri-api-v1',
    networkTimeoutSeconds: 4,
    plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  }),
)
