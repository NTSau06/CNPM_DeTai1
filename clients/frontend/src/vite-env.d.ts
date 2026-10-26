/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Khai báo kiểu môi trường Vite và module ảo do plugin PWA cung cấp.

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_MOBILE_URL?: string
}
