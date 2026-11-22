// Trang mở ra khi quét mã QR trên trang thanh toán: kiểm tra đơn rồi bấm xác nhận để hoàn tất.
// Không cần đăng nhập vì mã thanh toán trong liên kết đủ để nhận diện đơn.
import { useEffect, useRef, useState } from 'react'
import { CircleCheck, ShieldCheck, LoaderCircle, Ticket, TriangleAlert } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { BackendApiError, confirmQrPayment, fetchQrPayment, type QrPaymentOrder } from '../api'
import { localizedTitle } from '../data/places'
import { useAppStore } from '../store'
import { apiErrorMessage, localeOf, ui } from '../uiText'

export function QrPaymentPage() {
  const { orderId = '' } = useParams<{ orderId: string }>()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') ?? ''
  const language = useAppStore((state) => state.language)
  const languageRef = useRef(language)
  languageRef.current = language
  const places = useAppStore((state) => state.places)
  const [order, setOrder] = useState<QrPaymentOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void fetchQrPayment(orderId, code)
      .then((result) => { if (active) setOrder(result) })
      .catch((reason) => {
        if (!active) return
        const invalid = reason instanceof BackendApiError && [403, 404, 422].includes(reason.status)
        setError(invalid ? ui(languageRef.current, 'qrPayInvalid') : apiErrorMessage(languageRef.current, reason, 'payError'))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [orderId, code])

  const confirm = async () => {
    setConfirming(true)
    setError('')
    try {
      setOrder(await confirmQrPayment(orderId, code))
    } catch (reason) {
      const invalid = reason instanceof BackendApiError && [403, 404, 422].includes(reason.status)
      setError(invalid ? ui(language, 'qrPayInvalid') : apiErrorMessage(language, reason, 'payError'))
    } finally {
      setConfirming(false)
    }
  }

  const amount = order ? `${order.totalPriceVnd.toLocaleString(localeOf(language))} ₫` : ''
  const place = order ? places.find((item) => item.id === order.placeId) : undefined

  return (
    <div className="subpage payment-page">
      <section className="payment-card qr-confirm-card" aria-busy={loading || confirming}>
        <header className="payment-card-heading">
          <span className="payment-card-icon"><ShieldCheck size={20} /></span>
          <div>
            <h1>{ui(language, 'qrPayTitle')}</h1>
            <p>{ui(language, 'qrPayNote')}</p>
          </div>
        </header>
        {loading ? (
          <p className="ticket-history-status" role="status"><LoaderCircle className="loading-spinner" size={14} /> {ui(language, 'payProcessing')}</p>
        ) : !order ? (
          <p className="ticket-history-error" role="alert"><TriangleAlert size={14} /> {error || ui(language, 'qrPayInvalid')}</p>
        ) : (
          <>
            <dl className="payment-summary">
              <div><dt><Ticket size={14} /> {ui(language, 'payOrder')}</dt><dd>{order.ticketCode} · {place ? localizedTitle(place, language) : order.placeId}</dd></div>
              <div><dt>{ui(language, 'tkHistoryQuantity')}</dt><dd>{order.quantity}</dd></div>
              <div><dt>{ui(language, 'payAmount')}</dt><dd><strong>{amount}</strong></dd></div>
            </dl>
            {order.status === 'paid' ? (
              <p className="qr-confirm-success" role="status"><CircleCheck size={18} /> {ui(language, 'qrPaySuccess')}</p>
            ) : order.status === 'pending' ? (
              <>
                {error && <p className="ticket-history-error" role="alert"><TriangleAlert size={14} /> {error}</p>}
                <button className="qr-confirm-button" type="button" disabled={confirming} onClick={() => void confirm()}>
                  {confirming ? <LoaderCircle className="loading-spinner" size={16} /> : <CircleCheck size={16} />}
                  {ui(language, 'qrPayConfirm', { amount })}
                </button>
              </>
            ) : (
              <p className="ticket-history-status" role="status">{ui(language, 'payNotPending')}</p>
            )}
            <p className="qr-confirm-back"><Link to="/explore">{ui(language, 'navHome')}</Link></p>
          </>
        )}
      </section>
    </div>
  )
}
