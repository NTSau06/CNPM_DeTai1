import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Activity, LogOut, Map, MapPin, RefreshCw, ShieldCheck, Ticket, UsersRound } from 'lucide-react'
import { BackendApiError, fetchAdminOverview, fetchPlaces, fetchTicketPrices, getStoredAdminToken, loginAdmin, logoutAdmin, storeAdminToken, updateAdminTicketPrice } from '../api'
import type { AdminOverview } from '../api'
import './admin.css'

export function AdminPage() {
  const [token, setToken] = useState(() => getStoredAdminToken())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({})
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [savingPricePlaceId, setSavingPricePlaceId] = useState<string | null>(null)
  const [priceMessage, setPriceMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (!token) return
    let disposed = false

    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const [nextOverview, places] = await Promise.all([
          fetchAdminOverview(token),
          fetchPlaces(),
        ])
        if (disposed) return
        setOverview(nextOverview)
        setPlaceNames(Object.fromEntries(places.map((place) => [place.id, place.copy.vi?.title ?? place.id])))
        setLastUpdated(new Date())
        setError('')
        try {
          const prices = await fetchTicketPrices()
          if (disposed) return
          setPriceDrafts((current) => Object.fromEntries(
            places.map((place) => [
              place.id,
              current[place.id] ?? prices.find((item) => item.placeId === place.id)?.priceVnd?.toString() ?? '',
            ]),
          ))
          setPriceMessage('')
        } catch (priceError) {
          if (disposed) return
          setPriceMessage(priceError instanceof BackendApiError && priceError.status === 404
            ? 'API vé chưa được tải. Hãy khởi động lại backend để bật chức năng vé.'
            : priceError instanceof Error ? priceError.message : 'Không tải được bảng giá vé.')
        }
      } catch (requestError) {
        if (disposed) return
        if (requestError instanceof BackendApiError && (requestError.status === 401 || requestError.status === 403)) {
          storeAdminToken(null)
          setToken(null)
          setOverview(null)
        }
        setError(requestError instanceof Error ? requestError.message : 'Không thể tải dữ liệu quản trị.')
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    setLoading(true)
    void refresh()
    const interval = window.setInterval(() => void refresh(), 20_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      disposed = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [token, refreshKey])

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await loginAdmin(email.trim(), password)
      storeAdminToken(response.token)
      setToken(response.token)
      setPassword('')
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Đăng nhập quản trị thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const signOut = async () => {
    try {
      if (token) await logoutAdmin(token)
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Đăng xuất quản trị thất bại.')
    } finally {
      storeAdminToken(null)
      setToken(null)
      setOverview(null)
    }
  }

  const saveTicketPrice = async (placeId: string) => {
    if (!token) return
    const draft = priceDrafts[placeId]?.trim() ?? ''
    const priceVnd = draft ? Number(draft) : null
    if (priceVnd !== null && (!Number.isSafeInteger(priceVnd) || priceVnd < 70_000 || priceVnd > 150_000)) {
      setPriceMessage('Giá vé phải từ 70.000 đến 150.000 VND, hoặc để trống để đóng bán.')
      return
    }
    setSavingPricePlaceId(placeId)
    setPriceMessage('')
    try {
      const updated = await updateAdminTicketPrice(placeId, priceVnd, token)
      setPriceDrafts((current) => ({ ...current, [placeId]: updated.priceVnd?.toString() ?? '' }))
      setPriceMessage('Đã cập nhật giá vé.')
    } catch (requestError) {
      setPriceMessage(requestError instanceof BackendApiError && requestError.status === 404
        ? 'API vé chưa được tải. Hãy khởi động lại backend để bật chức năng vé.'
        : requestError instanceof Error ? requestError.message : 'Không thể cập nhật giá vé.')
    } finally {
      setSavingPricePlaceId(null)
    }
  }

  if (!token) {
    return (
      <section className="admin-login-page">
        <form className="admin-login-card" onSubmit={signIn}>
          <span className="admin-login-icon"><ShieldCheck size={22} /></span>
          <p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
          <h1>Đăng nhập admin</h1>
          <p className="admin-muted">Đăng nhập bằng tài khoản quản trị đã được cấu hình cho máy chủ.</p>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <button className="admin-primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
          <p className="admin-login-note">Tài khoản admin được tạo từ biến môi trường ADMIN_EMAIL và ADMIN_PASSWORD.</p>
        </form>
      </section>
    )
  }

  const ticketSales = overview?.tickets ?? {
    totalTicketsSold: 0,
    totalOrders: 0,
    totalRevenueVnd: 0,
    places: [],
    recentOrders: [],
  }

  return (
    <section className="admin-page">
      <header className="admin-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> BẢNG ĐIỀU KHIỂN</p>
          <h1>Quản trị Quảng Trị</h1>
          <p>Theo dõi tài khoản đang hoạt động và tình hình sử dụng ứng dụng.</p>
        </div>
        <div className="admin-actions">
          {lastUpdated && <span className="admin-updated">Cập nhật {lastUpdated.toLocaleTimeString('vi-VN')}</span>}
          <button className="admin-secondary-button" type="button" onClick={() => setRefreshKey((value) => value + 1)} aria-label="Làm mới bảng điều khiển">
            <RefreshCw size={16} /> Làm mới
          </button>
          <button className="admin-secondary-button" type="button" onClick={signOut}>
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </header>

      {error && <p className="admin-error admin-banner" role="alert">{error}</p>}
      {loading && !overview ? (
        <div className="admin-loading" role="status">Đang tải thống kê…</div>
      ) : overview ? (
        <>
          <div className="admin-metrics-grid">
            <MetricCard icon={<Activity size={19} />} label="Tài khoản đang hoạt động" value={overview.activeAccountCount} detail="Có ít nhất một phiên đăng nhập còn hiệu lực" accent="green" />
            <MetricCard icon={<UsersRound size={19} />} label="Tổng tài khoản" value={overview.accountCount} detail="Tài khoản đã đăng ký" accent="sand" />
            <MetricCard icon={<Map size={19} />} label="Địa điểm trên web" value={Object.keys(placeNames).length} detail="Địa điểm khách có thể xem trên web" accent="green" />
            <MetricCard icon={<MapPin size={19} />} label="Lượt ghé 30 ngày" value={overview.analytics.visitsLast30Days} detail="Lượt ghé đã được ứng dụng ghi nhận" accent="blue" />
            <MetricCard icon={<Ticket size={19} />} label="Vé đã bán" value={ticketSales.totalTicketsSold} detail={`${ticketSales.totalOrders} đơn đặt vé`} accent="blue" />
            <MetricCard icon={<Activity size={19} />} label="Doanh thu ghi nhận" value={ticketSales.totalRevenueVnd} detail="Tổng giá trị đơn thử nghiệm · VND" accent="sand" />
          </div>

          <div className="admin-content-grid">
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div><h2>Giá vé và lượt bán</h2><p>Giá demo 70.000–150.000 VND; để trống để đóng bán</p></div>
              </div>
              <ul className="admin-ticket-list">
                {Object.entries(placeNames).map(([placeId, placeName]) => {
                  const sale = ticketSales.places.find((item) => item.placeId === placeId)
                  return (
                    <li key={placeId}>
                      <div className="admin-ticket-place">
                        <strong>{placeName}</strong>
                        <small>{sale?.ticketsSold ?? 0} vé · {(sale?.revenueVnd ?? 0).toLocaleString('vi-VN')} ₫</small>
                      </div>
                      <label className="admin-ticket-price">
                        <span className="sr-only">Giá vé {placeName} bằng VND</span>
                        <input
                          aria-label={`Giá vé ${placeName} bằng VND`}
                          type="number"
                          min="70000"
                          max="150000"
                          step="1000"
                          inputMode="numeric"
                          placeholder="Chưa mở bán"
                          value={priceDrafts[placeId] ?? ''}
                          onChange={(event) => setPriceDrafts((current) => ({ ...current, [placeId]: event.target.value }))}
                        />
                        <span>₫</span>
                      </label>
                      <button
                        className="admin-secondary-button"
                        type="button"
                        disabled={savingPricePlaceId === placeId}
                        onClick={() => void saveTicketPrice(placeId)}
                      >
                        {savingPricePlaceId === placeId ? 'Đang lưu…' : 'Lưu giá'}
                      </button>
                    </li>
                  )
                })}
              </ul>
              {priceMessage && <p className="admin-ticket-message" role="status">{priceMessage}</p>}
            </section>
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div><h2>Địa điểm nổi bật</h2><p>Lượt ghé trong 30 ngày gần nhất</p></div>
              </div>
              {overview.analytics.places.length ? (
                <ol className="admin-place-list">
                  {overview.analytics.places.slice(0, 8).map((place, index) => (
                    <li key={place.placeId}>
                      <span className="admin-place-rank">{String(index + 1).padStart(2, '0')}</span>
                      <span className="admin-place-name">{placeNames[place.placeId] ?? place.placeId}</span>
                      <span className="admin-place-count">{place.visits} lượt</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="admin-empty">Chưa có lượt ghé được ghi nhận.</p>}
            </section>

          </div>
          <p className="admin-footnote">Tài khoản được tính đang hoạt động khi có ít nhất một phiên đăng nhập còn hiệu lực; đăng nhập trên nhiều thiết bị vẫn chỉ tính một tài khoản. Phiên hết hạn hoặc đã đăng xuất không được tính. Vé và doanh thu ở đây là đơn thử nghiệm đã đặt, không phải khoản thanh toán thực nhận.</p>
        </>
      ) : (
        <div className="admin-loading" role="status">Không có dữ liệu để hiển thị.</div>
      )}
    </section>
  )
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: ReactNode
  label: string
  value: number
  detail: string
  accent: string
}) {
  return (
    <article className="admin-metric-card">
      <div className={`admin-metric-icon ${accent}`}>{icon}</div>
      <p>{label}</p>
      <strong>{value.toLocaleString('vi-VN')}</strong>
      <span>{detail}</span>
    </article>
  )
}
