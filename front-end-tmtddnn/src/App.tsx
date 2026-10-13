import { lazy, Suspense, useEffect } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Bookmark, Compass, Map, MapPinned, Settings2 } from 'lucide-react'
import { translate } from './i18n'
import { useAppStore } from './store'
import { AppShell } from './components/AppShell'

const ExplorePage = lazy(() => import('./pages/ExplorePage').then((module) => ({ default: module.ExplorePage })))
const SavedPage = lazy(() => import('./pages/SavedPage').then((module) => ({ default: module.SavedPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))

export default function App() {
  const language = useAppStore((state) => state.language)
  const savedTourCount = useAppStore((state) => state.savedTours.length)
  const online = useAppStore((state) => state.online)
  const storageError = useAppStore((state) => state.storageError)
  const clearStorageError = useAppStore((state) => state.clearStorageError)

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

  const items = [
    { to: '/', label: translate(language, 'explore'), icon: Compass, end: true },
    { to: '/saved', label: translate(language, 'saved'), icon: Bookmark },
    { to: '/offline', label: translate(language, 'offline'), icon: MapPinned },
    { to: '/settings', label: translate(language, 'settings'), icon: Settings2 },
  ]

  return (
    <AppShell>
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="Quảng Trị">
          <span className="brand-mark"><Map size={19} strokeWidth={1.8} /></span>
          <span className="brand-name">Quảng Trị</span>
        </NavLink>
        <div className="topbar-right">
          <span className={`connection-pill ${online ? 'is-online' : 'is-offline'}`}>
            <span className="status-dot" />
            {translate(language, online ? 'online' : 'offlineStatus')}
          </span>
          <LanguagePicker />
          <NavLink className="avatar-link" to="/settings" aria-label={translate(language, 'settings')}>A</NavLink>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-label">YOUR LITTLE GUIDE</div>
        <nav aria-label="Main navigation" className="side-nav">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {to === '/saved' && <span className="nav-count">{savedTourCount || ''}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-sun">✳</span>
          <p>Đi qua miền đất,<br />đừng quên nhìn quanh.</p>
          <span className="note-caption">QUANG TRI · QUANG BINH</span>
        </div>
        <div className="sidebar-footer">MADE FOR SLOW TRAVEL <span>✳</span></div>
      </aside>

      <main className="main-content">
        {storageError && (
          <button className="storage-alert" onClick={clearStorageError} role="alert">
            {translate(language, storageError)} <span aria-hidden="true">×</span>
          </button>
        )}
        <Suspense fallback={<div className="page-loading">{translate(language, 'appReady')}…</div>}>
          <Routes>
            <Route path="/" element={<ExplorePage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/offline" element={<SettingsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

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

function LanguagePicker() {
  const language = useAppStore((state) => state.language)
  const setLanguage = useAppStore((state) => state.setLanguage)
  return (
    <label className="language-picker">
      <span className="sr-only">Narration language</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} aria-label="Narration language">
        <option value="vi">🇻🇳　VI</option>
        <option value="en">🇬🇧　EN</option>
        <option value="ja">🇯🇵　日本</option>
        <option value="fr">🇫🇷　FR</option>
      </select>
    </label>
  )
}
