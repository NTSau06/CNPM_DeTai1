// Kết nối các trang, điều hướng chính và trạng thái dùng chung của ứng dụng web.
import type React from 'react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AlertCircle, Bookmark, ChevronDown, Compass, House, Info, Map, MapPinned, Menu, Settings2, Smartphone, X } from 'lucide-react'
import { translate } from './i18n'
import { ui, type UiKey } from './uiText'
import { languages } from './data/places'
import { useAppStore } from './store'
import { getVisitorId, leaveOnlinePresence, updateOnlinePresence } from './api'
import { AppShell } from './components/AppShell'
import { DeviceEntryPage } from './pages/DeviceEntryPage'
import { sendSessionHeartbeat } from './api'

const ExplorePage = lazy(() => import('./pages/ExplorePage').then((module) => ({ default: module.ExplorePage })))
const SavedPage = lazy(() => import('./pages/SavedPage').then((module) => ({ default: module.SavedPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const PairPage = lazy(() => import('./pages/PairPage').then((module) => ({ default: module.PairPage })))
const UserPage = lazy(() => import('./pages/UserPage').then((module) => ({ default: module.UserPage })))
const OnlineDashboardPage = lazy(() => import('./pages/OnlineDashboardPage').then((module) => ({ default: module.OnlineDashboardPage })))
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage').then((module) => ({ default: module.AdminLoginPage })))

// Gửi heartbeat đủ nhanh để số online cập nhật gần như tức thì (máy chủ giữ 30 giây).
const PRESENCE_INTERVAL_MS = 5_000
const exploreSections = ['explore-home', 'explore-featured', 'explore-map', 'explore-info'] as const
type ExploreSection = (typeof exploreSections)[number]
const homeNavItems: { id: ExploreSection; icon: typeof House; label: UiKey }[] = [
  { id: 'explore-home', icon: House, label: 'navHome' },
  { id: 'explore-featured', icon: Compass, label: 'navExplore' },
  { id: 'explore-map', icon: MapPinned, label: 'navMap' },
  { id: 'explore-info', icon: Info, label: 'navAbout' },
]

export default function App() {
  const location = useLocation()
  const language = useAppStore((state) => state.language)
  const savedTourCount = useAppStore((state) => state.savedTours.length)
  const currentUser = useAppStore((state) => state.currentUser)
  const authToken = useAppStore((state) => state.authToken)
  const storageError = useAppStore((state) => state.storageError)
  const clearStorageError = useAppStore((state) => state.clearStorageError)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const [activeExploreSection, setActiveExploreSection] = useState<ExploreSection>('explore-home')
  const navigationRef = useRef<HTMLDivElement>(null)
  const isAdminRoute = location.pathname.startsWith('/admin')

  useEffect(() => {
    if (location.pathname !== '/explore') return

    let frame = 0
    const updateActiveSection = () => {
      const topbarBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 72
      const threshold = topbarBottom + 48
      let activeSection: ExploreSection = 'explore-home'

      for (const section of exploreSections) {
        const element = document.getElementById(section)
        if (element && element.getBoundingClientRect().top <= threshold) activeSection = section
      }
      // Khi đã cuộn tới cuối trang, mục cuối (Giới thiệu) luôn được đánh dấu.
      const atPageBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atPageBottom) activeSection = exploreSections[exploreSections.length - 1]

      setActiveExploreSection((current) => current === activeSection ? current : activeSection)
    }
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(updateActiveSection)
    }

    updateActiveSection()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [location.pathname])

  useEffect(() => {
    // Trang admin không tự tính là thiết bị người dùng đang truy cập.
    if (isAdminRoute) return
    let visitorId: string | null = null
    let timer: number | undefined
    const update = async () => {
      try {
        visitorId ??= await getVisitorId()
        await updateOnlinePresence(visitorId)
      } catch {
        // Bỏ qua lỗi mạng tạm thời; lần heartbeat kế tiếp sẽ thử lại.
      }
    }
    const stop = () => {
      window.clearInterval(timer)
      timer = undefined
    }
    const start = () => {
      stop()
      void update()
      timer = window.setInterval(() => { void update() }, PRESENCE_INTERVAL_MS)
    }
    const leave = () => {
      stop()
      if (visitorId) leaveOnlinePresence(visitorId)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') start()
      else leave()
    }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', leave)
    return () => {
      leave()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', leave)
    }
  }, [isAdminRoute])

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
    if (!authToken) return
    let disposed = false
    const heartbeat = () => {
      if (document.visibilityState !== 'visible') return
      void sendSessionHeartbeat(authToken).catch((error: unknown) => {
        if (!disposed) console.error('Unable to update account activity.', error)
      })
    }
    heartbeat()
    const interval = window.setInterval(heartbeat, 30_000)
    document.addEventListener('visibilitychange', heartbeat)
    return () => {
      disposed = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', heartbeat)
    }
  }, [authToken])

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

  const goToExploreSection = (event: React.MouseEvent<HTMLAnchorElement>, id: ExploreSection) => {
    event.preventDefault()
    // Đóng trang chi tiết địa điểm (lớp phủ) nếu đang mở để mục được chọn hiện ra.
    document.querySelectorAll<HTMLDetailsElement>('.place-detail-page[open]').forEach((details) => { details.open = false })
    setNavigationOpen(false)
    setActiveExploreSection(id)
    const target = document.getElementById(id)
    if (id === 'explore-home') window.scrollTo({ top: 0, behavior: 'smooth' })
    else target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${id}`)
  }

  const items = [
    { to: '/explore', label: translate(language, 'explore'), icon: Compass, end: true },
    { to: '/saved', label: translate(language, 'saved'), icon: Bookmark },
    { to: '/offline', label: translate(language, 'offline'), icon: MapPinned },
    { to: '/settings', label: translate(language, 'settings'), icon: Settings2 },
  ]

  if (isAdminRoute) {
    return (
      <AppShell>
        <Suspense fallback={<div className="page-loading" aria-label={translate(language, 'loading')}><span className="skeleton page-skeleton-title" /><span className="skeleton page-skeleton-line" /><span className="skeleton page-skeleton-block" /></div>}>
          <Routes>
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<OnlineDashboardPage />} />
            <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <header className={`topbar${location.pathname === '/explore' ? ' topbar-explore' : ''}`}>
        <NavLink to="/explore" className="brand" aria-label="Quảng Trị">
          <span className="brand-mark"><Map size={19} strokeWidth={1.8} /></span>
          <span className="brand-copy">
            <span className="brand-name">Quảng Trị</span>
            <small>{ui(language, 'brandTagline')}</small>
          </span>
        </NavLink>
        {location.pathname === '/explore' && (
          <nav className="home-main-nav" aria-label={ui(language, 'homeNavLabel')}>
            {homeNavItems.map(({ id, icon: Icon, label }) => (
              <a
                key={id}
                className={`home-main-nav-link${activeExploreSection === id ? ' active' : ''}`}
                href={`#${id}`}
                aria-current={activeExploreSection === id ? 'location' : undefined}
                onClick={(event) => goToExploreSection(event, id)}
              >
                <Icon size={14} />{ui(language, label)}
              </a>
            ))}
          </nav>
        )}
        <div className="topbar-right">
          {/* Chỉ hiện trên máy tính: tạo mã QR để mang hành trình sang điện thoại. */}
          <NavLink className="device-picker-link" to="/device" title={ui(language, 'openOnPhone')} aria-label={ui(language, 'openOnPhone')}>
            <Smartphone size={15} aria-hidden="true" />
            <span>{ui(language, 'openOnPhone')}</span>
          </NavLink>
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
                <NavLink
                  to="/device"
                  className={({ isActive }) => `header-navigation-item header-navigation-phone${isActive ? ' active' : ''}`}
                  onClick={() => setNavigationOpen(false)}
                >
                  <Smartphone size={17} strokeWidth={1.8} />
                  <span>{ui(language, 'openOnPhone')}</span>
                </NavLink>
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
          <NavLink className="avatar-link" to={currentUser ? '/profile' : '/login'} aria-label={ui(language, currentUser ? 'userProfile' : 'signIn')}>
            {currentUser ? getInitials(currentUser.fullName) : 'A'}
          </NavLink>
        </div>
      </header>

      <main className={`main-content${location.pathname === '/explore' ? ' explore-main-content' : ''}`}>
        {storageError && (
          <button className="storage-alert" onClick={clearStorageError} role="alert">
            {translate(language, storageError)} <span aria-hidden="true">×</span>
          </button>
        )}
        <Suspense fallback={<div className="page-loading" aria-label={translate(language, 'loading')}><span className="skeleton page-skeleton-title" /><span className="skeleton page-skeleton-line" /><span className="skeleton page-skeleton-block" /></div>}>
          <Routes>
            <Route path="/device" element={<DeviceEntryPage />} />
            <Route path="/pair" element={<PairPage />} />
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
