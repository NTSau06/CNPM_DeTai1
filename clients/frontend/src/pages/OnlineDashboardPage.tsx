import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Navigate, NavLink, useNavigate } from 'react-router-dom'
import { Activity, ArrowLeft, ArrowRight, BookOpen, ChartNoAxesColumn, Clock3, Home, Lightbulb, LogOut, Map, MapPin, Menu, Pencil, Plus, Ticket, Trash2, Users, X } from 'lucide-react'
import {
  createAdminPlace,
  deleteAdminPlace,
  deleteAdminUser,
  BackendApiError,
  fetchCurrentUser,
  fetchPlaces,
  fetchTicketPrices,
  getAdminOverview,
  getAdminUsers,
  getStoredAdminAuthToken,
  logoutAccount,
  mergeRemotePlaces,
  storeAdminAuthToken,
  updateAdminPlace,
  updateAdminTicketPrice,
} from '../api'
import type { AdminOverview, AdminUser, ApiPlace } from '../api'
import { languages, categoryLabels } from '../data/places'
import { useAppStore } from '../store'
import { getNarrationAudioUrl } from '../speech'
import type { Language, Place, PlaceDetailSection, UserProfile } from '../types'

type AdminTab = 'overview' | 'tickets' | 'users' | 'places'
type PlaceCopy = Place['copy'][Language]

interface PlaceForm {
  id: string
  category: Place['category']
  longitude: string
  latitude: string
  duration: string
  image: string
  copy: Partial<Record<Language, PlaceCopy>>
  detailSections: PlaceDetailSection[]
  detailImage: Place['detailImage']
}

const emptyCopy: PlaceCopy = { title: '', subtitle: '', narration: '' }

function makePlaceForm(place?: Place): PlaceForm {
  return {
    id: place?.id ?? '',
    category: place?.category ?? 'landmark',
    longitude: place?.coordinates[0].toString() ?? '',
    latitude: place?.coordinates[1].toString() ?? '',
    duration: place?.duration.toString() ?? '5',
    image: place?.image ?? 'river',
    copy: place?.copy ?? { vi: emptyCopy },
    detailSections: place?.detailSections ?? [],
    detailImage: place?.detailImage ?? { src: '', alt: '', caption: '' },
  }
}

function toApiPlace(form: PlaceForm): ApiPlace {
  const vietnamese = form.copy.vi ?? emptyCopy
  const copy: Record<Language, PlaceCopy> = {
    vi: form.copy.vi ?? vietnamese,
    en: form.copy.en ?? vietnamese,
    ja: form.copy.ja ?? vietnamese,
    fr: form.copy.fr ?? vietnamese,
    'zh-CN': form.copy['zh-CN'] ?? vietnamese,
    'ko-KR': form.copy['ko-KR'] ?? vietnamese,
    es: form.copy.es ?? vietnamese,
  }
  return {
    id: form.id.trim(),
    category: form.category,
    coordinates: [Number(form.longitude), Number(form.latitude)],
    duration: Number(form.duration),
    image: form.image.trim(),
    copy,
    detailSections: form.detailSections,
    detailImage: form.detailImage,
  }
}

export function OnlineDashboardPage() {
  const navigate = useNavigate()
  const setPlaces = useAppStore((state) => state.setPlaces)
  const [adminUser, setAdminUser] = useState<UserProfile | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(() => getStoredAdminAuthToken())
  const [authChecked, setAuthChecked] = useState(false)
  const [tab, setTab] = useState<AdminTab>('overview')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [places, setPlacesList] = useState<ApiPlace[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null)
  const [form, setForm] = useState<PlaceForm | null>(null)
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [savingPricePlaceId, setSavingPricePlaceId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const refresh = useCallback(async () => {
    if (!authToken) return
    setLoading(true)
    setMessage('')
    try {
      const [nextOverview, nextUsers, remotePlaces, ticketPrices] = await Promise.all([
        getAdminOverview(authToken),
        getAdminUsers(authToken),
        fetchPlaces(),
        fetchTicketPrices().catch(() => []),
      ])
      const mergedPlaces = mergeRemotePlaces(useAppStore.getState().places, remotePlaces)
      setOverview(nextOverview)
      setUsers(nextUsers)
      setPlacesList(remotePlaces)
      setPlaces(mergedPlaces)
      setPriceDrafts((current) => Object.fromEntries(
        remotePlaces.map((place) => [
          place.id,
          current[place.id] ?? ticketPrices.find((item) => item.placeId === place.id)?.priceVnd?.toString() ?? '',
        ]),
      ))
    } catch (error) {
      setMessage(error instanceof Error && 'status' in error && error.status === 403
        ? 'Tài khoản của bạn chưa được cấp quyền quản trị.'
        : error instanceof Error ? error.message : 'Không tải được dữ liệu quản trị.')
    } finally {
      setLoading(false)
    }
  }, [authToken, setPlaces])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let active = true
    const token = getStoredAdminAuthToken()
    if (!token) {
      setAdminUser(null)
      setAuthToken(null)
      setAuthChecked(true)
      return
    }
    fetchCurrentUser(token)
      .then((user) => {
        if (!active) return
        if (user.isAdmin) {
          setAdminUser(user)
          setAuthToken(token)
        } else {
          storeAdminAuthToken(null)
          setAdminUser(null)
          setAuthToken(null)
        }
      })
      .catch(() => {
        if (!active) return
        storeAdminAuthToken(null)
        setAdminUser(null)
        setAuthToken(null)
      })
      .finally(() => {
        if (active) setAuthChecked(true)
      })
    return () => {
      active = false
    }
  }, [])

  const onSignOutAdmin = async () => {
    const token = authToken
    storeAdminAuthToken(null)
    setAdminUser(null)
    setAuthToken(null)
    if (token) {
      await logoutAccount(token).catch(() => undefined)
    }
    navigate('/admin/login', { replace: true })
  }

  if (!authChecked) return null
  if (!adminUser || !authToken || !adminUser.isAdmin) {
    return <Navigate to="/admin/login" replace />
  }

  const removeUser = async (user: AdminUser) => {
    if (!authToken || !window.confirm(`Xóa tài khoản ${user.email}? Các hành trình đã lưu của tài khoản này cũng sẽ bị xóa.`)) return
    setBusy(true)
    setMessage('')
    try {
      await deleteAdminUser(user.id, authToken)
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không xóa được tài khoản.')
    } finally {
      setBusy(false)
    }
  }

  const savePlace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!authToken || !form) return
    setBusy(true)
    setMessage('')
    try {
      const payload = toApiPlace(form)
      const vietnameseCopy = payload.copy.vi
      if (!payload.id || !payload.image || !vietnameseCopy?.title || !vietnameseCopy.narration || !payload.detailImage?.src) {
        throw new Error('Nhập mã, hình minh họa, ảnh chi tiết, tiêu đề và lời thuyết minh tiếng Việt.')
      }
      if (!Number.isFinite(payload.coordinates[0]) || payload.coordinates[0] < -180 || payload.coordinates[0] > 180
        || !Number.isFinite(payload.coordinates[1]) || payload.coordinates[1] < -90 || payload.coordinates[1] > 90) {
        throw new Error('Kinh độ phải từ -180 đến 180, vĩ độ từ -90 đến 90.')
      }
      if (!Number.isInteger(payload.duration) || payload.duration < 1 || payload.duration > 240) {
        throw new Error('Thời lượng phải là số nguyên từ 1 đến 240 phút.')
      }
      if (editingPlaceId) await updateAdminPlace(editingPlaceId, payload, authToken)
      else await createAdminPlace(payload, authToken)
      setForm(null)
      setEditingPlaceId(null)
      await refresh()
      setMessage('Đã lưu địa điểm.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không lưu được địa điểm.')
    } finally {
      setBusy(false)
    }
  }

  const removePlace = async (place: ApiPlace) => {
    if (!authToken || !window.confirm(`Xóa địa điểm "${place.copy.vi?.title ?? place.id}"? Các hành trình cũ có thể còn tham chiếu địa điểm này.`)) return
    setBusy(true)
    setMessage('')
    try {
      await deleteAdminPlace(place.id, authToken)
      await refresh()
      setMessage('Đã xóa địa điểm.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không xóa được địa điểm.')
    } finally {
      setBusy(false)
    }
  }

  const saveTicketPrice = async (placeId: string) => {
    if (!authToken) return
    const draft = priceDrafts[placeId]?.trim() ?? ''
    const priceVnd = draft ? Number(draft) : null
    if (priceVnd !== null && (!Number.isSafeInteger(priceVnd) || priceVnd < 70_000 || priceVnd > 150_000)) {
      setMessage('Giá vé phải từ 70.000 đến 150.000 VND, hoặc để trống để đóng bán.')
      return
    }
    setSavingPricePlaceId(placeId)
    setMessage('')
    try {
      const updated = await updateAdminTicketPrice(placeId, priceVnd, authToken)
      setPriceDrafts((current) => ({ ...current, [placeId]: updated.priceVnd?.toString() ?? '' }))
      await refresh()
      setMessage('Đã cập nhật giá vé.')
    } catch (requestError) {
      setMessage(requestError instanceof BackendApiError && requestError.status === 404
        ? 'API vé chưa được tải. Hãy khởi động lại backend để bật chức năng vé.'
        : requestError instanceof Error ? requestError.message : 'Không thể cập nhật giá vé.')
    } finally {
      setSavingPricePlaceId(null)
    }
  }

  const openEdit = (apiPlace: ApiPlace) => {
    const localPlace = useAppStore.getState().places.find((place) => place.id === apiPlace.id)
    setEditingPlaceId(apiPlace.id)
    setForm(makePlaceForm(localPlace))
    setMessage('')
  }

  const placeNames = Object.fromEntries(places.map((place) => [place.id, place.copy.vi?.title ?? place.id]))
  const popularPlaces = (overview?.analytics.places ?? [])
    .filter((place) => place.visits > 0)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 6)
  const maxPlaceVisits = Math.max(...popularPlaces.map((place) => place.visits), 1)

  return (
    <div className={`admin-standalone admin-dashboard-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      <aside className="admin-sidebar" aria-label="Điều hướng quản trị">
        <NavLink to="/admin" className="admin-sidebar-brand" onClick={() => setTab('overview')}>
          <span className="admin-sidebar-logo"><Map size={25} strokeWidth={1.8} /></span>
          <strong>Quảng Trị</strong>
          <small>Thuyết minh tự động<br />đa ngôn ngữ</small>
        </NavLink>
        <nav className="admin-sidebar-nav">
          <span className="admin-sidebar-label">KHÔNG GIAN QUẢN TRỊ</span>
          {([
            ['overview', 'Tổng quan', Home, 'Tổng hợp hoạt động và số liệu'],
            ['places', 'Quản lý địa điểm', MapPin, 'Thêm, sửa và xóa địa điểm'],
            ['tickets', 'Quản lý vé', Ticket, 'Cập nhật giá và theo dõi vé'],
            ['users', 'Quản lý người dùng', Users, 'Xem và quản lý tài khoản'],
          ] as const).map(([key, label, Icon, description]) => (
            <button
              className={`admin-sidebar-link${tab === key ? ' active' : ''}`}
              key={key}
              onClick={() => { setTab(key); setSidebarOpen(false) }}
              title={description}
              type="button"
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {tab === key && <span className="admin-sidebar-active-mark" />}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <NavLink to="/explore" className="admin-sidebar-link">
            <ArrowLeft size={17} /><span>Trang người dùng</span>
          </NavLink>
          <button className="admin-sidebar-link admin-sidebar-logout" type="button" onClick={() => { void onSignOutAdmin() }}>
            <LogOut size={17} /><span>Đăng xuất</span>
          </button>
          <div className="admin-sidebar-note"><Activity size={15} /><span>Hệ thống quản lý du lịch số Quảng Trị</span></div>
        </div>
      </aside>
      {sidebarOpen && <button className="admin-sidebar-backdrop" type="button" aria-label="Đóng menu" onClick={() => setSidebarOpen(false)} />}
      <header className="topbar admin-topbar admin-dashboard-topbar">
        <div className="admin-topbar-left">
          <button className="admin-menu-toggle" type="button" aria-label={sidebarOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}>
            {sidebarOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <span className="admin-breadcrumb">Quảng Trị <span>·</span> Quản trị</span>
        </div>
        <div className="topbar-right admin-dashboard-topbar-right">
          <span className="admin-account-chip" title={adminUser.email}>
            <span className="admin-account-avatar">{adminUser.fullName.slice(0, 2).toUpperCase()}</span>
            <span>{adminUser.fullName}</span>
          </span>
        </div>
      </header>
      <main className="main-content admin-dashboard-main">
        <section className="admin-page">
      {tab === 'overview' ? (
        <section className="admin-welcome-banner">
          <div className="admin-welcome-copy">
            <span className="admin-welcome-script">Chào mừng trở lại!</span>
            <h1>Trang quản trị hệ thống</h1>
            <p>Quản lý và phát triển nền tảng thuyết minh du lịch Quảng Trị</p>
          </div>
          <div className="admin-welcome-actions">
            <span><Clock3 size={15} /> Cập nhật khi làm mới dữ liệu</span>
            <button className="admin-refresh" disabled={loading || busy} onClick={() => void refresh()} type="button">
              {loading ? 'Đang tải…' : 'Làm mới dữ liệu'}
            </button>
          </div>
        </section>
      ) : (
        <header className="admin-page-heading">
          <span className="user-eyebrow">QUẢN TRỊ HỆ THỐNG</span>
          <h1>{tab === 'places' ? 'Quản lý địa điểm' : tab === 'tickets' ? 'Quản lý vé tham quan' : 'Quản lý tài khoản'}</h1>
          <p>Quản lý dữ liệu và nội dung trên nền tảng du lịch số Quảng Trị.</p>
          <button className="admin-refresh" disabled={loading || busy} onClick={() => void refresh()} type="button">
            {loading ? 'Đang tải…' : 'Làm mới dữ liệu'}
          </button>
        </header>
      )}
      {message && <p className="admin-message" role="status">{message}</p>}
      {loading ? <p className="admin-message">Đang tải dữ liệu quản trị…</p> : (
        <>
          {tab === 'overview' && overview && (
            <>
            <div className="admin-stat-grid">
              <article className="admin-stat-card stat-places"><span className="admin-stat-icon"><MapPin size={20} /></span><span className="admin-stat-label">Địa điểm</span><strong>{overview.placeCount.toLocaleString('vi-VN')}</strong><small>Điểm đến đang được quản lý</small></article>
              <article className="admin-stat-card stat-users"><span className="admin-stat-icon"><Users size={20} /></span><span className="admin-stat-label">Người dùng</span><strong>{overview.accountCount.toLocaleString('vi-VN')}</strong><small>{overview.activeAccountCount.toLocaleString('vi-VN')} phiên đang hoạt động</small></article>
              <article className="admin-stat-card stat-visits"><span className="admin-stat-icon"><MapPin size={20} /></span><span className="admin-stat-label">Lượt ghé</span><strong>{overview.visits.toLocaleString('vi-VN')}</strong><small>Ghi nhận trong 30 ngày gần nhất</small></article>
              <article className="admin-stat-card stat-ratings"><span className="admin-stat-icon"><BookOpen size={20} /></span><span className="admin-stat-label">Đánh giá</span><strong>{overview.ratingCount.toLocaleString('vi-VN')}</strong><small>Đánh giá của du khách</small></article>
            </div>
            <div className="admin-overview-grid">
              <section className="admin-panel admin-analytics-panel">
                <div className="admin-panel-heading">
                  <div className="admin-overview-title"><span className="admin-panel-icon"><ChartNoAxesColumn size={17} /></span><div><h2>Điểm đến được quan tâm</h2><small>Lượt ghé theo địa điểm · 30 ngày gần nhất</small></div></div>
                  <button className="admin-panel-link" type="button" onClick={() => setTab('places')}>Quản lý địa điểm <ArrowRight size={14} /></button>
                </div>
                {popularPlaces.length > 0 ? (
                  <div className="admin-visit-chart" aria-label="Lượt ghé theo địa điểm trong 30 ngày gần nhất">
                    {popularPlaces.map((place, index) => (
                      <div className="admin-visit-row" key={place.placeId}>
                        <span className="admin-visit-name" title={placeNames[place.placeId] ?? place.placeId}>{placeNames[place.placeId] ?? place.placeId}</span>
                        <span className="admin-visit-track"><span className={`admin-visit-bar chart-color-${index + 1}`} style={{ width: `${Math.max(4, place.visits / maxPlaceVisits * 100)}%` }} /></span>
                        <strong>{place.visits.toLocaleString('vi-VN')}</strong>
                      </div>
                    ))}
                  </div>
                ) : <p className="admin-empty-state">Chưa có lượt ghé được ghi nhận trong 30 ngày gần nhất.</p>}
              </section>
              <section className="admin-panel admin-reviews-panel">
                <div className="admin-panel-heading">
                  <div className="admin-overview-title"><span className="admin-panel-icon review-icon"><BookOpen size={17} /></span><div><h2>Đánh giá gần đây</h2><small>Phản hồi mới từ du khách</small></div></div>
                  <span className="admin-review-count">{overview.analytics.latestReviews.length}</span>
                </div>
                {overview.analytics.latestReviews.length > 0 ? (
                  <div className="admin-recent-reviews">
                    {overview.analytics.latestReviews.slice(0, 5).map((review, index) => (
                      <article className="admin-review-row" key={`${review.placeId}-${review.createdAt}-${index}`}>
                        <span className={`admin-review-avatar review-color-${index + 1}`}>{review.rating}★</span>
                        <span className="admin-review-copy"><strong>{placeNames[review.placeId] ?? review.placeId}</strong><span>{review.review}</span><small>{formatAdminDate(review.createdAt)}</small></span>
                      </article>
                    ))}
                  </div>
                ) : <p className="admin-empty-state">Chưa có nhận xét mới từ du khách.</p>}
              </section>
            </div>
            <section className="admin-dashboard-tip">
              <span className="admin-tip-icon"><Lightbulb size={22} /></span>
              <div><strong>Mẹo sử dụng</strong><p>Thêm và cập nhật điểm đến để giữ bản đồ du lịch luôn đầy đủ thông tin.</p></div>
              <button type="button" onClick={() => setTab('places')}>Quản lý địa điểm <ArrowRight size={14} /></button>
            </section>
            </>
          )}

          {tab === 'tickets' && (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <h2>Giá vé và lượt bán <span>{places.length}</span></h2>
              </div>
              <div className="admin-place-list">
                {places.map((place) => {
                  const sale = overview?.tickets?.places.find((item) => item.placeId === place.id)
                  const placeName = place.copy.vi?.title ?? place.id
                  return (
                    <article className="admin-place-row" key={place.id}>
                      <div>
                        <strong>{placeName}</strong>
                        <small>{sale?.ticketsSold ?? 0} vé · {(sale?.revenueVnd ?? 0).toLocaleString('vi-VN')} ₫</small>
                      </div>
                      <div className="admin-row-actions">
                        <input
                          aria-label={`Giá vé ${placeName} bằng VND`}
                          type="number"
                          min="70000"
                          max="150000"
                          step="1000"
                          inputMode="numeric"
                          placeholder="Chưa mở bán"
                          value={priceDrafts[place.id] ?? ''}
                          onChange={(event) => setPriceDrafts((current) => ({ ...current, [place.id]: event.target.value }))}
                        />
                        <button
                          className="admin-secondary-button"
                          type="button"
                          disabled={savingPricePlaceId === place.id}
                          onClick={() => void saveTicketPrice(place.id)}
                        >
                          {savingPricePlaceId === place.id ? 'Đang lưu…' : 'Lưu giá'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {tab === 'users' && (
            <section className="admin-panel">
              <h2>Tài khoản người dùng <span>{users.length}</span></h2>
              {users.length === 0 ? <p>Chưa có tài khoản.</p> : (
                <div className="admin-table-wrap"><table className="admin-table">
                  <thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th /></tr></thead>
                  <tbody>{users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.fullName}</td>
                      <td>{user.email}</td>
                      <td>{user.isAdmin ? 'Quản trị viên' : 'Người dùng'}</td>
                      <td><button className="admin-icon-button danger" disabled={busy || user.id === adminUser.id} onClick={() => void removeUser(user)} title={user.id === adminUser.id ? 'Không thể xóa tài khoản đang đăng nhập' : 'Xóa tài khoản'} type="button"><Trash2 size={15} /></button></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </section>
          )}

          {tab === 'places' && (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <h2>Quản lý địa điểm <span>{places.length}</span></h2>
                <button className="admin-primary-button" disabled={busy} onClick={() => { setEditingPlaceId(null); setForm(makePlaceForm()); setMessage('') }} type="button"><Plus size={15} /> Thêm địa điểm</button>
              </div>
              {form && (
                <form className="admin-place-form" onSubmit={(event) => void savePlace(event)}>
                  <h3>{editingPlaceId ? 'Chỉnh sửa địa điểm' : 'Thêm địa điểm mới'}</h3>
                  <div className="admin-form-grid">
                    <label>Mã địa điểm<input required disabled={Boolean(editingPlaceId)} maxLength={120} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} /></label>
                    <label>Danh mục<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as Place['category'] })}>{(['landmark', 'food', 'craft', 'rest'] as const).map((category) => <option key={category} value={category}>{categoryLabels.vi[category]}</option>)}</select></label>
                    <label>Kinh độ<input required type="number" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /></label>
                    <label>Vĩ độ<input required type="number" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /></label>
                    <label>Thời lượng (phút)<input required type="number" min="1" max="240" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} /></label>
                    <label>Mã hình minh họa<input required maxLength={120} value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} /><small>Ví dụ: cave, beach, river</small></label>
                    <label>Ảnh chi tiết (URL)<input required type="url" value={form.detailImage.src} onChange={(event) => setForm({ ...form, detailImage: { ...form.detailImage, src: event.target.value } })} /></label>
                    <label>Chú thích ảnh<input value={form.detailImage.caption} onChange={(event) => setForm({ ...form, detailImage: { ...form.detailImage, caption: event.target.value } })} /></label>
                    <label className="admin-form-wide">Mô tả ảnh<input value={form.detailImage.alt} onChange={(event) => setForm({ ...form, detailImage: { ...form.detailImage, alt: event.target.value } })} /></label>
                  </div>
                  <details className="admin-localized-fields" open>
                    <summary>Nội dung tiếng Việt</summary>
                    <LocalizedFields language="vi" form={form} setForm={setForm} required />
                  </details>
                  {languages.filter(({ code }) => code !== 'vi').map(({ code, label }) => (
                    <details className="admin-localized-fields" key={code}>
                      <summary>{label} ({code})</summary>
                      <LocalizedFields language={code} form={form} setForm={setForm} />
                    </details>
                  ))}
                  <div className="admin-sections-editor">
                    <div className="admin-panel-heading"><h3>Nội dung chi tiết</h3><button className="admin-secondary-button" type="button" onClick={() => setForm({ ...form, detailSections: [...form.detailSections, { heading: '', body: '' }] })}><Plus size={14} /> Thêm mục</button></div>
                    {form.detailSections.map((section, index) => (
                      <div className="admin-section-fields" key={index}>
                        <label>Tiêu đề mục<input value={section.heading} onChange={(event) => setForm({ ...form, detailSections: form.detailSections.map((item, itemIndex) => itemIndex === index ? { ...item, heading: event.target.value } : item) })} /></label>
                        <label>Nội dung<textarea rows={3} value={section.body} onChange={(event) => setForm({ ...form, detailSections: form.detailSections.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item) })} /></label>
                        <button className="admin-icon-button danger" type="button" aria-label="Xóa mục nội dung" onClick={() => setForm({ ...form, detailSections: form.detailSections.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="admin-form-actions">
                    <button className="admin-primary-button" disabled={busy} type="submit">{busy ? 'Đang lưu…' : 'Lưu địa điểm'}</button>
                    <button className="admin-secondary-button" disabled={busy} onClick={() => { setForm(null); setEditingPlaceId(null) }} type="button">Hủy</button>
                  </div>
                </form>
              )}
              <div className="admin-place-list">{places.map((place) => (
                <article className="admin-place-row" key={place.id}>
                  <div><strong>{place.copy.vi?.title ?? place.id}</strong><small>{place.id} · {categoryLabels.vi[place.category]} · {place.duration} phút</small></div>
                  <div className="admin-row-actions">
                    <button className="admin-icon-button" disabled={busy} onClick={() => openEdit(place)} title="Chỉnh sửa" type="button"><Pencil size={15} /></button>
                    <button className="admin-icon-button danger" disabled={busy || places.length <= 1} onClick={() => void removePlace(place)} title={places.length <= 1 ? 'Cần giữ lại ít nhất một địa điểm' : 'Xóa địa điểm'} type="button"><Trash2 size={15} /></button>
                  </div>
                </article>
              ))}</div>
            </section>
          )}
        </>
      )}
        </section>
      </main>
    </div>
  )
}

function LocalizedFields({
  language,
  form,
  setForm,
  required = false,
}: {
  language: Language
  form: PlaceForm
  setForm: (form: PlaceForm) => void
  required?: boolean
}) {
  const value = form.copy[language] ?? emptyCopy
  const update = (field: keyof PlaceCopy, next: string) => {
    setForm({ ...form, copy: { ...form.copy, [language]: { ...value, [field]: next } } })
  }
  const label = languages.find((item) => item.code === language)?.label ?? language
  const bundledAudio = getNarrationAudioUrl({ id: form.id, copy: {} }, language)
  const audioUrl = value.audioUrl ?? bundledAudio ?? ''
  return (
    <div className="admin-form-grid">
      <label>{label} · Tiêu đề<input required={required} maxLength={160} value={value.title} onChange={(event) => update('title', event.target.value)} /></label>
      <label>{label} · Phụ đề<input maxLength={240} value={value.subtitle} onChange={(event) => update('subtitle', event.target.value)} /></label>
      <label className="admin-form-wide">{label} · Thuyết minh<textarea required={required} rows={3} value={value.narration} onChange={(event) => update('narration', event.target.value)} /></label>
      <label className="admin-form-wide">{label} · Audio thuyết minh
        <input value={audioUrl} maxLength={2048} placeholder="https://example.com/audio.mp3 hoặc /audio/diem-den/vi.mp3" pattern="https?://.+|/[^/].*" onChange={(event) => update('audioUrl', event.target.value.trim())} />
        <small>Nhập đường dẫn trực tiếp tới file âm thanh. Xóa đường dẫn để dùng giọng đọc tự động. Bấm Lưu địa điểm để áp dụng.</small>
      </label>
      {audioUrl && <div className="admin-form-wide"><audio key={audioUrl} controls preload="none" src={audioUrl} aria-label={`Nghe thử audio ${label}`} style={{ width: '100%' }} /></div>}
    </div>
  )
}

function formatAdminDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Thời gian không xác định'
    : date.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
}
