import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Clock3, Ticket } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { fetchMyTicketOrders } from '../api'
import type { TicketOrder } from '../api'
import { localizedTitle } from '../data/places'
import { apiErrorMessage, localeOf, ui } from '../uiText'
import { useAppStore } from '../store'

const formatVnd = (value: number, language: ReturnType<typeof useAppStore.getState>['language']) =>
  `${value.toLocaleString(localeOf(language))} ₫`

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

            return (
              <article className="ticket-history-card" key={order.id}>
                <header className="ticket-history-card-heading">
                  <span className="ticket-history-icon"><Ticket size={18} /></span>
                  <div>
                    <h2>{place ? localizedTitle(place, language) : order.placeId}</h2>
                    <p><Clock3 size={14} />{ui(language, 'tkHistoryDate')}: {bookedAt}</p>
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
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
