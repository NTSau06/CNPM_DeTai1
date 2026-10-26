// Cấu hình Vite, React, PWA và proxy API dùng trong môi trường phát triển.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/static': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
