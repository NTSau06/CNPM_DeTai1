import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CircleCheck, CircleX, Clock3, QrCode, Ticket } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { cancelTicketOrder, fetchMyTicketOrders } from '../api'
import type { TicketOrder, TicketOrderStatus } from '../api'
import { paymentPath } from '../payment'
import { localizedTitle } from '../data/places'
import { apiErrorMessage, localeOf, ui, type UiKey } from '../uiText'
import { useAppStore } from '../store'

const formatVnd = (value: number, language: ReturnType<typeof useAppStore.getState>['language']) =>
  `${value.toLocaleString(localeOf(language))} ₫`

const STATUS_LABEL: Record<TicketOrderStatus, UiKey> = {
  pending: 'payPending',
  paid: 'payPaid',
  cancelled: 'tkStatusCancelled',
  expired: 'payExpired',
}

const PAYMENT_RESULT: Record<string, UiKey> = {
  success: 'paySuccess',
  failed: 'payFailed',
  invalid: 'payInvalid',
}

export function TicketOrdersPage() {
  const language = useAppStore((state) => state.language)
  const languageRef = useRef(language)
  languageRef.current = language
  const authToken = useAppStore((state) => state.authToken)
  const authReady = useAppStore((state) => state.authReady)
  const places = useAppStore((state) => state.places)
  const [orders, setOrders] = useState<TicketOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const routerLocation = useLocation()
  const paymentResult = new URLSearchParams(routerLocation.search).get('payment') ?? ''
  const paymentOrderId = new URLSearchParams(routerLocation.search).get('order') ?? ''

  const cancelOrder = async (order: TicketOrder) => {
    if (!authToken) return
    if (!window.confirm(ui(language, 'tkCancelConfirm', { n: order.quantity }))) return
    setCancellingId(order.id)
    setNotice('')
    try {
      const updated = await cancelTicketOrder(order.id, authToken)
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setNotice(ui(language, 'tkCancelled'))
    } catch (reason) {
      setNotice(apiErrorMessage(language, reason, 'tkCancelError'))
    } finally {
      setCancellingId(null)
    }
  }

  useEffect(() => {
    let active = true
    if (!authToken) {
      setOrders([])
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    setError('')
    void fetchMyTicketOrders(authToken)
      .then((result) => { if (active) setOrders(result) })
      .catch((reason) => {
        if (active) setError(apiErrorMessage(languageRef.current, reason, 'tkLoadError'))
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [authToken])

  if (!authReady) return null
  if (!authToken) return <Navigate to="/login" state={{ returnTo: '/tickets' }} replace />

  return (
    <div className="subpage ticket-history-page">
      <div className="subpage-back">
        <Link to="/explore"><ArrowLeft size={15} /> {ui(language, 'backToExplore')}</Link>
      </div>
      <div className="subpage-heading">
        <div className="eyebrow"><span className="eyebrow-line" /> {ui(language, 'tkPanel')}</div>
        <h1>{ui(language, 'tkHistoryTitle')}</h1>
        <p>{ui(language, 'tkHistoryIntro')}</p>
      </div>

      {PAYMENT_RESULT[paymentResult] && (
        <p
          className={`ticket-payment-result is-${paymentResult}`}
          role={paymentResult === 'success' ? 'status' : 'alert'}
        >
          {paymentResult === 'success' ? <CircleCheck size={16} /> : <CircleX size={16} />}
          {ui(language, PAYMENT_RESULT[paymentResult])}
        </p>
      )}
      {notice && <p className="ticket-history-status" role="status">{notice}</p>}
      {loading ? (
        <p className="ticket-history-status" role="status">{ui(language, 'tkHistoryLoading')}</p>
      ) : error ? (
        <p className="ticket-history-error" role="alert">{error}</p>
      ) : orders.length === 0 ? (
        <section className="empty-state">
          <div className="empty-icon"><Ticket size={25} /></div>
          <h2>{ui(language, 'tkHistoryEmpty')}</h2>
          <Link className="primary-link" to="/explore">{ui(language, 'tkHistoryExplore')} <ArrowRight size={15} /></Link>
        </section>
      ) : (
        <div className="ticket-history-list">
          {orders.map((order) => {
            const place = places.find((item) => item.id === order.placeId)
            const date = new Date(order.createdAt)
            const bookedAt = Number.isNaN(date.getTime())
              ? order.createdAt
              : date.toLocaleString(localeOf(language), { dateStyle: 'medium', timeStyle: 'short' })

            const status: TicketOrderStatus = order.status ?? 'paid'
            const inactive = status === 'cancelled' || status === 'expired'
            const expiresAt = order.expiresAt ? new Date(order.expiresAt) : null

            return (
              <article
                className={`ticket-history-card${inactive ? ' is-cancelled' : ''}${order.id === paymentOrderId ? ' is-highlighted' : ''}`}
                key={order.id}
              >
                <header className="ticket-history-card-heading">
                  <span className="ticket-history-icon"><Ticket size={18} /></span>
                  <div>
                    <h2>{place ? localizedTitle(place, language) : order.placeId}</h2>
                    <p><Clock3 size={14} />{ui(language, 'tkHistoryDate')}: {bookedAt}</p>
                    <p>
                      {ui(language, 'tkCode')}: <strong>{order.ticketCode ?? order.id}</strong>
                      {' · '}
                      <span className={`ticket-status is-${status}`}>{ui(language, STATUS_LABEL[status])}</span>
                    </p>
                    {status === 'pending' && expiresAt && !Number.isNaN(expiresAt.getTime()) && (
                      <p><Clock3 size={14} />{ui(language, 'payExpiresAt', { time: expiresAt.toLocaleTimeString(localeOf(language), { hour: '2-digit', minute: '2-digit' }) })}</p>
                    )}
                    {status === 'paid' && order.paymentRef && (
                      <p>{ui(language, 'payRef')}: {order.paymentRef}</p>
                    )}
                  </div>
                </header>
                <dl className="ticket-history-details">
                  <div>
                    <dt>{ui(language, 'tkHistoryQuantity')}</dt>
                    <dd>{order.quantity}</dd>
                  </div>
                  <div>
                    <dt>{ui(language, 'tkHistoryUnitPrice')}</dt>
                    <dd>{formatVnd(order.unitPriceVnd, language)}</dd>
                  </div>
                  <div>
                    <dt>{ui(language, 'tkHistoryTotal')}</dt>
                    <dd>{formatVnd(order.totalPriceVnd, language)}</dd>
                  </div>
                </dl>
                {status === 'pending' && (
                  <Link className="ticket-pay-button" to={paymentPath(order.id)}>
                    <QrCode size={15} aria-hidden="true" />
                    {ui(language, 'payContinue')}
                  </Link>
                )}
                {!inactive && (
                  <button
                    className="ticket-cancel-button"
                    disabled={cancellingId === order.id}
                    onClick={() => void cancelOrder(order)}
                    type="button"
                  >
                    <CircleX size={15} aria-hidden="true" />
                    {ui(language, cancellingId === order.id ? 'tkCancelling' : 'tkCancel')}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
