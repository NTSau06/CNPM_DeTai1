import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Navigate, NavLink, useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut, Map, MapPin, Pencil, Plus, Shield, Ticket, Trash2, Users } from 'lucide-react'
import {
  createAdminPlace,
  deleteAdminPlace,
  deleteAdminUser,
  BackendApiError,
  fetchCurrentUser,
  fetchPlaces,
  fetchTicketPrices,
  getAdminOnlineVisitorCount,
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
  const online = useAppStore((state) => state.online)
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
    const interval = window.setInterval(() => { void refresh() }, 30_000)
    return () => window.clearInterval(interval)
  }, [refresh])

  // Làm mới riêng số thiết bị online mỗi 5 giây để thấy thay đổi gần như tức thì.
  useEffect(() => {
    if (!authToken) return
    let active = true
    const interval = window.setInterval(() => {
      getAdminOnlineVisitorCount(authToken)
        .then(({ onlineVisitors }) => {
          if (active) setOverview((current) => (current ? { ...current, onlineVisitors } : current))
        })
        .catch(() => undefined)
    }, 5_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [authToken])

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

  return (
    <div className="admin-standalone">
      <header className="topbar admin-topbar">
        <div className="brand">
          <span className="brand-mark"><Map size={19} strokeWidth={1.8} /></span>
          <span className="brand-name">Quảng Trị · Quản trị</span>
        </div>
        <div className="topbar-right">
          <span className={`connection-pill ${online ? 'is-online' : 'is-offline'}`}>
            <span className="status-dot" />
            {online ? 'Đang kết nối' : 'Ngoại tuyến'}
          </span>
          <span className="online-visitors" title="Số thiết bị người dùng đang mở trang">
            <Users size={13} aria-hidden="true" />
            <span>{overview ? overview.onlineVisitors.toLocaleString('vi-VN') : '—'}</span>
            <span className="online-visitors-label">Đang kết nối</span>
          </span>
          <NavLink to="/explore" className="device-picker-link" title="Mở trang người dùng">
            <ArrowLeft size={14} />
            <span>Trang người dùng</span>
          </NavLink>
          <span className="device-picker-link" title={adminUser.email}>
            <Shield size={14} />
            <span>{adminUser.fullName}</span>
          </span>
          <button className="signout-button" type="button" onClick={() => { void onSignOutAdmin() }}>
            <LogOut size={14} /> Đăng xuất
          </button>
        </div>
      </header>
      <main className="main-content">
        <section className="admin-page">
          <header className="admin-page-heading">
            <span className="user-eyebrow">QUẢN TRỊ HỆ THỐNG</span>
            <h1>Trang quản trị</h1>
            <p>Thống kê truy cập, tài khoản và nội dung địa điểm.</p>
          </header>

      <nav className="admin-tabs" aria-label="Chức năng quản trị">
        {([
          ['overview', 'Tổng quan'],
          ['tickets', 'Vé tham quan'],
          ['users', 'Tài khoản'],
          ['places', 'Địa điểm'],
        ] as const).map(([key, label]) => (
          <button className={tab === key ? 'active' : ''} key={key} onClick={() => setTab(key)} type="button">
            {label}
          </button>
        ))}
        <button className="admin-refresh" disabled={loading || busy} onClick={() => void refresh()} type="button">
          {loading ? 'Đang tải…' : 'Làm mới'}
        </button>
      </nav>

      {message && <p className="admin-message" role="status">{message}</p>}
      {loading ? <p className="admin-message">Đang tải dữ liệu quản trị…</p> : (
        <>
          {tab === 'overview' && overview && (
            <div className="admin-stat-grid">
              <article className="admin-stat-card"><Users size={18} /><span>Thiết bị online</span><strong>{overview.onlineVisitors.toLocaleString('vi-VN')}</strong><small>Đang mở trang, tự giảm khi rời đi</small></article>
              <article className="admin-stat-card"><MapPin size={18} /><span>Lượt ghé</span><strong>{overview.visits.toLocaleString('vi-VN')}</strong><small>30 ngày gần nhất · ghi nhận qua app</small></article>
              <article className="admin-stat-card"><Users size={18} /><span>Tài khoản</span><strong>{users.length.toLocaleString('vi-VN')}</strong><small>{overview.activeAccountCount.toLocaleString('vi-VN')} đang có phiên hoạt động</small></article>
              <article className="admin-stat-card"><MapPin size={18} /><span>Địa điểm</span><strong>{overview.placeCount.toLocaleString('vi-VN')}</strong><small>{overview.ratingCount.toLocaleString('vi-VN')} lượt đánh giá</small></article>
              <article className="admin-stat-card"><Ticket size={18} /><span>Vé đã bán</span><strong>{(overview.tickets?.totalTicketsSold ?? 0).toLocaleString('vi-VN')}</strong><small>{(overview.tickets?.totalOrders ?? 0).toLocaleString('vi-VN')} đơn đặt vé</small></article>
              <article className="admin-stat-card"><Ticket size={18} /><span>Doanh thu thử nghiệm</span><strong>{(overview.tickets?.totalRevenueVnd ?? 0).toLocaleString('vi-VN')} ₫</strong><small>Tổng giá trị đơn đặt vé</small></article>
            </div>
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
  return (
    <div className="admin-form-grid">
      <label>{label} · Tiêu đề<input required={required} maxLength={160} value={value.title} onChange={(event) => update('title', event.target.value)} /></label>
      <label>{label} · Phụ đề<input maxLength={240} value={value.subtitle} onChange={(event) => update('subtitle', event.target.value)} /></label>
      <label className="admin-form-wide">{label} · Thuyết minh<textarea required={required} rows={3} value={value.narration} onChange={(event) => update('narration', event.target.value)} /></label>
    </div>
  )
}
