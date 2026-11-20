// Cổng thanh toán mô phỏng: hiển thị đơn vé, cho chọn ngân hàng và xác nhận/hủy giao dịch.
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Clock3, CreditCard, LoaderCircle, ShieldCheck, Ticket } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { completeMockPayment, fetchTicketOrder, type TicketOrder } from '../api'
import { localizedTitle } from '../data/places'
import { useAppStore } from '../store'
import { apiErrorMessage, localeOf, ui } from '../uiText'

const BANKS = ['Vietcombank', 'VietinBank', 'BIDV', 'Techcombank', 'MB Bank', 'Ví điện tử']

export function MockPaymentPage() {
  const { orderId = '' } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const language = useAppStore((state) => state.language)
  const languageRef = useRef(language)
  languageRef.current = language
  const authToken = useAppStore((state) => state.authToken)
  const authReady = useAppStore((state) => state.authReady)
  const places = useAppStore((state) => state.places)
  const [order, setOrder] = useState<TicketOrder | null>(null)
  const [bank, setBank] = useState(BANKS[0])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!authToken || !orderId) return () => { active = false }
    setLoading(true)
    void fetchTicketOrder(orderId, authToken)
      .then((result) => { if (active) setOrder(result) })
      .catch((reason) => { if (active) setError(apiErrorMessage(languageRef.current, reason, 'payError')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [authToken, orderId])

  if (!authReady) return null
  if (!authToken) return <Navigate to="/login" state={{ returnTo: `/payment/mock/${orderId}` }} replace />

  const finish = async (success: boolean) => {
    if (!order) return
    setBusy(true)
    setError('')
    try {
      const updated = await completeMockPayment(order.id, success, authToken)
      const result = updated.status === 'paid' ? 'success' : 'failed'
      navigate(`/tickets?payment=${result}&order=${encodeURIComponent(order.id)}`, { replace: true })
    } catch (reason) {
      setError(apiErrorMessage(language, reason, 'payError'))
      setBusy(false)
    }
  }

  const locale = localeOf(language)
  const formatVnd = (value: number) => `${value.toLocaleString(locale)} ₫`
  const place = order ? places.find((item) => item.id === order.placeId) : undefined
  const expiresAt = order?.expiresAt ? new Date(order.expiresAt) : null
  const payable = order?.status === 'pending'

  return (
    <div className="subpage payment-page">
      <div className="subpage-back"><Link to="/tickets"><ArrowLeft size={15} /> {ui(language, 'payBackToTickets')}</Link></div>
      <section className="payment-card" aria-busy={loading || busy}>
        <header className="payment-card-heading">
          <span className="payment-card-icon"><CreditCard size={20} /></span>
          <div>
            <h1>{ui(language, 'payTitle')}</h1>
            <p><ShieldCheck size={14} /> {ui(language, 'payIntro')}</p>
          </div>
        </header>
        {loading ? (
          <p className="ticket-history-status" role="status"><LoaderCircle className="loading-spinner" size={14} /> {ui(language, 'payProcessing')}</p>
        ) : !order ? (
          <p className="ticket-history-error" role="alert">{error || ui(language, 'payError')}</p>
        ) : (
          <>
            <dl className="payment-summary">
              <div><dt><Ticket size={14} /> {ui(language, 'payOrder')}</dt><dd>{order.ticketCode ?? order.id} · {place ? localizedTitle(place, language) : order.placeId}</dd></div>
              <div><dt>{ui(language, 'tkHistoryQuantity')}</dt><dd>{order.quantity} × {formatVnd(order.unitPriceVnd)}</dd></div>
              <div className="payment-total"><dt>{ui(language, 'payAmount')}</dt><dd>{formatVnd(order.totalPriceVnd)}</dd></div>
              {expiresAt && payable && (
                <div><dt><Clock3 size={14} /></dt><dd>{ui(language, 'payExpiresAt', { time: expiresAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</dd></div>
              )}
            </dl>
            {payable ? (
              <>
                <fieldset className="payment-banks" disabled={busy}>
                  <legend>{ui(language, 'payBank')}</legend>
                  {BANKS.map((name) => (
                    <label key={name} className={bank === name ? 'is-selected' : undefined}>
                      <input type="radio" name="bank" value={name} checked={bank === name} onChange={() => setBank(name)} />
                      {name}
                    </label>
                  ))}
                </fieldset>
                <div className="payment-actions">
                  <button type="button" className="payment-confirm" disabled={busy} onClick={() => void finish(true)}>
                    {busy && <LoaderCircle className="loading-spinner" size={14} />}
                    {busy ? ui(language, 'payProcessing') : ui(language, 'payConfirm', { total: formatVnd(order.totalPriceVnd) })}
                  </button>
                  <button type="button" className="payment-cancel" disabled={busy} onClick={() => void finish(false)}>
                    {ui(language, 'payCancel')}
                  </button>
                </div>
              </>
            ) : (
              <p className="ticket-history-status" role="status">{ui(language, 'payNotPending')}</p>
            )}
            {error && <p className="ticket-history-error" role="alert">{error}</p>}
          </>
        )}
      </section>
    </div>
  )
}
