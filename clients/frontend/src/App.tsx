// Kết nối các trang, điều hướng chính và trạng thái dùng chung của ứng dụng web.
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AlertCircle, Bookmark, ChevronDown, Compass, Map, MapPinned, Menu, Settings2, X } from 'lucide-react'
import { translate } from './i18n'
import { languages } from './data/places'
import { useAppStore } from './store'
import { AppShell } from './components/AppShell'
import { DeviceEntryPage } from './pages/DeviceEntryPage'

const ExplorePage = lazy(() => import('./pages/ExplorePage').then((module) => ({ default: module.ExplorePage })))
const SavedPage = lazy(() => import('./pages/SavedPage').then((module) => ({ default: module.SavedPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const UserPage = lazy(() => import('./pages/UserPage').then((module) => ({ default: module.UserPage })))

export default function App() {
  const location = useLocation()
  const language = useAppStore((state) => state.language)
  const savedTourCount = useAppStore((state) => state.savedTours.length)
  const online = useAppStore((state) => state.online)
  const currentUser = useAppStore((state) => state.currentUser)
  const storageError = useAppStore((state) => state.storageError)
  const clearStorageError = useAppStore((state) => state.clearStorageError)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const navigationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!navigationOpen) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !navigationRef.current?.contains(event.target)) {
        setNavigationOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavigationOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [navigationOpen])

  useEffect(() => {
    const setOnline = () => useAppStore.getState().setOnline(true)
    const setOffline = () => useAppStore.getState().setOnline(false)
    window.addEventListener('online', setOnline)
    window.addEventListener('offline', setOffline)
    return () => {
      window.removeEventListener('online', setOnline)
      window.removeEventListener('offline', setOffline)
    }
  }, [])

  useEffect(() => {
    let nextToastId = 0
    let timeout: number | undefined
    const showApiError = (event: Event) => {
      const kind = event instanceof CustomEvent && event.detail?.kind === 'server' ? 'apiServerError' : 'apiNetworkError'
      const id = ++nextToastId
      setToast({ id, message: translate(useAppStore.getState().language, kind) })
      window.clearTimeout(timeout)
      timeout = window.setTimeout(() => setToast(null), 6000)
    }

    window.addEventListener('app-api-error', showApiError)
    return () => {
      window.removeEventListener('app-api-error', showApiError)
      window.clearTimeout(timeout)
    }
  }, [])

  const items = [
    { to: '/explore', label: translate(language, 'explore'), icon: Compass, end: true },
    { to: '/saved', label: translate(language, 'saved'), icon: Bookmark },
    { to: '/offline', label: translate(language, 'offline'), icon: MapPinned },
    { to: '/settings', label: translate(language, 'settings'), icon: Settings2 },
  ]

  if (location.pathname === '/' && new URLSearchParams(location.search).get('device') === 'mobile') {
    return <Navigate to="/explore" replace />
  }

  if (location.pathname === '/') {
    return <AppShell><DeviceEntryPage /></AppShell>
  }

  return (
    <AppShell>
      <header className="topbar">
        <NavLink to="/explore" className="brand" aria-label="Quảng Trị">
          <span className="brand-mark"><Map size={19} strokeWidth={1.8} /></span>
          <span className="brand-name">Quảng Trị</span>
        </NavLink>
        <div className="topbar-right">
          <span className={`connection-pill ${online ? 'is-online' : 'is-offline'}`}>
            <span className="status-dot" />
            {translate(language, online ? 'online' : 'offlineStatus')}
          </span>
          <div className="header-navigation" ref={navigationRef}>
            <button
              className="header-navigation-toggle"
              type="button"
              aria-expanded={navigationOpen}
              aria-haspopup="true"
              aria-controls="header-navigation-menu"
              aria-label={translate(language, 'navMenu')}
              onClick={() => setNavigationOpen((open) => !open)}
            >
              <Menu size={16} />
              <span>{translate(language, 'navMenu')}</span>
              <ChevronDown size={14} />
            </button>
            {navigationOpen && (
              <nav className="header-navigation-menu" id="header-navigation-menu" aria-label={translate(language, 'navMenu')}>
                {items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) => `header-navigation-item${isActive ? ' active' : ''}`}
                    onClick={() => setNavigationOpen(false)}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span>{label}</span>
                    {to === '/saved' && <span className="nav-count">{savedTourCount || ''}</span>}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>
          <LanguagePicker />
          <NavLink className="avatar-link" to={currentUser ? '/profile' : '/login'} aria-label={currentUser ? 'Hồ sơ người dùng' : 'Đăng nhập'}>
            {currentUser ? getInitials(currentUser.fullName) : 'A'}
          </NavLink>
        </div>
      </header>

      <main className="main-content">
        {storageError && (
          <button className="storage-alert" onClick={clearStorageError} role="alert">
            {translate(language, storageError)} <span aria-hidden="true">×</span>
          </button>
        )}
        <Suspense fallback={<div className="page-loading" aria-label={translate(language, 'loading')}><span className="skeleton page-skeleton-title" /><span className="skeleton page-skeleton-line" /><span className="skeleton page-skeleton-block" /></div>}>
          <Routes>
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/offline" element={<SettingsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/login" element={<UserPage />} />
            <Route path="/register" element={<UserPage />} />
            <Route path="/profile" element={<UserPage />} />
            <Route path="*" element={<Navigate to="/explore" replace />} />
          </Routes>
        </Suspense>
      </main>
      {toast && (
        <div className="api-toast" role="alert" key={toast.id}>
          <AlertCircle size={18} aria-hidden="true" />
          <span>{toast.message}</span>
          <button type="button" aria-label={translate(language, 'dismiss')} onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
            <Icon size={20} strokeWidth={1.8} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </AppShell>
  )
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}

function LanguagePicker() {
  const language = useAppStore((state) => state.language)
  const setLanguage = useAppStore((state) => state.setLanguage)
  return (
    <label className="language-picker">
      <span className="sr-only">Narration language</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} aria-label="Narration language">
        {languages.map((item) => (
          <option key={item.code} value={item.code}>{item.flag}　{item.native}</option>
        ))}
      </select>
    </label>
  )
}
