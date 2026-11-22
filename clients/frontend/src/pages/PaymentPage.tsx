// Trang thanh toán vé: hiện mã QR, quét bằng điện thoại để mở trang xác nhận thanh toán.
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Clock3, LoaderCircle, QrCode, ShieldCheck, Ticket, TriangleAlert } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { fetchTicketOrder, fetchTicketPayment, qrPaymentPath, type TicketOrder } from '../api'
import { localizedTitle } from '../data/places'
import { useAppStore } from '../store'
import { apiErrorMessage, localeOf, ui } from '../uiText'

const POLL_INTERVAL_MS = 3000

/** Đường dẫn đầy đủ của trang xác nhận, dùng địa chỉ Wi-Fi để điện thoại mở được. */
function qrPaymentUrl(orderId: string, code: string): string {
  const path = `${import.meta.env.BASE_URL}${qrPaymentPath(orderId, code).slice(1)}`
  return new URL(path, import.meta.env.VITE_MOBILE_URL || window.location.origin).toString()
}

export function PaymentPage() {
  const { orderId = '' } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const language = useAppStore((state) => state.language)
  const languageRef = useRef(language)
  languageRef.current = language
  const authToken = useAppStore((state) => state.authToken)
  const authReady = useAppStore((state) => state.authReady)
  const places = useAppStore((state) => state.places)
  const [order, setOrder] = useState<TicketOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qrImage, setQrImage] = useState('')
  const [qrFailed, setQrFailed] = useState(false)
  const finished = useRef(false)

  useEffect(() => {
    let active = true
    if (!authToken || !orderId) return () => { active = false }
    setLoading(true)
    void fetchTicketPayment(orderId, authToken)
      .then((result) => { if (active) setOrder(result.order) })
      .catch((reason) => { if (active) setError(apiErrorMessage(languageRef.current, reason, 'payError')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [authToken, orderId])

  const code = order?.status === 'pending' ? order.paymentCode ?? '' : ''
  const confirmUrl = code ? qrPaymentUrl(orderId, code) : ''
  const needsLanAddress = !import.meta.env.VITE_MOBILE_URL &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname)

  useEffect(() => {
    let active = true
    setQrImage('')
    setQrFailed(false)
    if (!confirmUrl) return () => { active = false }
    void QRCode.toDataURL(confirmUrl, { width: 240, margin: 2, errorCorrectionLevel: 'M' })
      .then((image: string) => { if (active) setQrImage(image) })
      .catch(() => { if (active) setQrFailed(true) })
    return () => { active = false }
  }, [confirmUrl])

  // Chờ xác nhận trên điện thoại: kiểm tra trạng thái đơn định kỳ rồi chuyển sang trang vé.
  useEffect(() => {
    if (!authToken || !confirmUrl) return
    const timer = window.setInterval(() => {
      void fetchTicketOrder(orderId, authToken)
        .then((latest) => {
          if (finished.current || latest.status === 'pending') return
          finished.current = true
          const result = latest.status === 'paid' ? 'success' : 'failed'
          navigate(`/tickets?payment=${result}&order=${encodeURIComponent(orderId)}`, { replace: true })
        })
        .catch(() => undefined)
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [authToken, orderId, confirmUrl, navigate])

  if (!authReady) return null
  if (!authToken) return <Navigate to="/login" state={{ returnTo: `/payment/${orderId}` }} replace />

  const locale = localeOf(language)
  const formatVnd = (value: number) => `${value.toLocaleString(locale)} ₫`
  const place = order ? places.find((item) => item.id === order.placeId) : undefined
  const expiresAt = order?.expiresAt ? new Date(order.expiresAt) : null

  return (
    <div className="subpage payment-page">
      <div className="subpage-back"><Link to="/tickets"><ArrowLeft size={15} /> {ui(language, 'payBackToTickets')}</Link></div>
      <section className="payment-card" aria-busy={loading}>
        <header className="payment-card-heading">
          <span className="payment-card-icon"><QrCode size={20} /></span>
          <div>
            <h1>{ui(language, 'payQrTitle')}</h1>
            <p><ShieldCheck size={14} /> {ui(language, 'payQrHint')}</p>
          </div>
        </header>
        {loading ? (
          <p className="ticket-history-status" role="status"><LoaderCircle className="loading-spinner" size={14} /> {ui(language, 'payProcessing')}</p>
        ) : !order ? (
          <p className="ticket-history-error" role="alert"><TriangleAlert size={14} /> {error || ui(language, 'payError')}</p>
        ) : (
          <>
            <dl className="payment-summary">
              <div><dt><Ticket size={14} /> {ui(language, 'payOrder')}</dt><dd>{order.ticketCode ?? order.id} · {place ? localizedTitle(place, language) : order.placeId}</dd></div>
              <div><dt>{ui(language, 'tkHistoryQuantity')}</dt><dd>{order.quantity} × {formatVnd(order.unitPriceVnd)}</dd></div>
              {expiresAt && confirmUrl && (
                <div><dt><Clock3 size={14} /></dt><dd>{ui(language, 'payExpiresAt', { time: expiresAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</dd></div>
              )}
            </dl>
            {confirmUrl ? (
              <>
                <div className="payment-qr">
                  <div className="payment-qr-image">
                    {qrImage ? (
                      <img src={qrImage} alt={ui(language, 'payQrTitle')} width={220} height={220} />
                    ) : qrFailed ? (
                      <TriangleAlert size={28} />
                    ) : (
                      <LoaderCircle className="loading-spinner" size={24} />
                    )}
                  </div>
                  <dl className="payment-transfer">
                    <div><dt>{ui(language, 'payAmount')}</dt><dd><strong>{formatVnd(order.totalPriceVnd)}</strong></dd></div>
                    <div><dt>{ui(language, 'payQrCode')}</dt><dd><strong>{code}</strong></dd></div>
                    <div><dt /><dd><a className="payment-open-link" href={confirmUrl} target="_blank" rel="noreferrer">{ui(language, 'payQrOpenHere')}</a></dd></div>
                  </dl>
                </div>
                {needsLanAddress && <p className="payment-qr-lan"><TriangleAlert size={14} /> {ui(language, 'payQrLan')}</p>}
                <p className="payment-qr-waiting" role="status">
                  <LoaderCircle className="loading-spinner" size={13} /> {ui(language, 'payQrWaiting')}
                </p>
              </>
            ) : (
              <p className="ticket-history-status" role="status">{ui(language, 'payNotPending')}</p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
