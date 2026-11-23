// Cấu hình Vite, React, PWA và proxy API dùng trong môi trường phát triển.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Tên miền HTTPS được phép truy cập dev server: đường hầm Cloudflare/ngrok và tên miền do
// run-local.ps1 truyền qua PUBLIC_HOSTS (ví dụ khi chạy với -PublicUrl https://ten-mien-rieng).
// Đọc qua globalThis để không cần cài @types/node khi `tsc -b` kiểm tra tệp này.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const publicHosts = (env.PUBLIC_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,webp,png,woff2,mp3}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'Quảng Trị — Khám phá Quảng Bình',
        short_name: 'Quảng Trị',
        description: 'Bản đồ điểm đến và thuyết minh đa ngôn ngữ tại Quảng Trị và Quảng Bình.',
        lang: 'vi',
        start_url: './',
        display: 'standalone',
        background_color: '#f7f5ef',
        theme_color: '#f7f5ef',
        icons: [
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io', ...publicHosts],
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/static': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
