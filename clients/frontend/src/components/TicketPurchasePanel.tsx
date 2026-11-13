import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Ticket } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  createTicketOrder,
  fetchMyTicketOrders,
  fetchTicketPrices,
} from '../api'
import type { TicketOrder, TicketPrice } from '../api'
import { useAppStore } from '../store'
import type { Language } from '../types'
import { localeOf, ui } from '../uiText'

const formatVnd = (value: number, language: Language) => `${value.toLocaleString(localeOf(language))} ₫`

export function TicketPurchasePanel({ placeId }: { placeId: string }) {
  const authToken = useAppStore((state) => state.authToken)
  const language = useAppStore((state) => state.language)
  const languageRef = useRef(language)
  languageRef.current = language
  const [price, setPrice] = useState<TicketPrice | null>(null)
  const [orders, setOrders] = useState<TicketOrder[]>([])
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setMessage('')
    setError('')
    const load = async () => {
      try {
        const prices = await fetchTicketPrices()
        const myOrders = authToken ? await fetchMyTicketOrders(authToken) : []
        if (!active) return
        setPrice(prices.find((item) => item.placeId === placeId) ?? { placeId, priceVnd: null })
        setOrders(myOrders)
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : ui(languageRef.current, 'tkLoadError'))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [placeId, authToken])

  const ownedTickets = orders
    .filter((order) => order.placeId === placeId)
    .reduce((total, order) => total + order.quantity, 0)
  const availablePrice = typeof price?.priceVnd === 'number' && price.priceVnd > 0
    ? price.priceVnd
    : null

  const orderTickets = async () => {
    if (!authToken || availablePrice === null) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const order = await createTicketOrder(placeId, quantity, authToken)
      setOrders((current) => [order, ...current])
      setMessage(ui(language, 'tkSuccess', { n: quantity, total: formatVnd(order.totalPriceVnd, language) }))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : ui(language, 'tkOrderError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ticket-purchase-panel" aria-label={ui(language, 'tkPanel')}>
      <div className="ticket-purchase-heading">
        <span className="ticket-purchase-icon"><Ticket size={18} /></span>
        <div>
          <h2>{ui(language, 'tkTitle')}</h2>
          <p>{loading ? ui(language, 'tkLoading') : availablePrice !== null ? ui(language, 'tkPrice', { price: formatVnd(availablePrice, language) }) : ui(language, 'tkNotOnSale')}</p>
        </div>
      </div>
      {ownedTickets > 0 && <p className="ticket-owned-count">{ui(language, 'tkOwned', { n: ownedTickets })}</p>}
      {availablePrice !== null && (
        <div className="ticket-order-controls">
          {authToken ? (
            <>
              <label>
                {ui(language, 'tkQuantity')}
                <select
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  disabled={busy}
                >
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => void orderTickets()} disabled={busy || loading}>
                {busy && <LoaderCircle className="loading-spinner" size={14} />}
                {busy ? ui(language, 'tkBooking') : ui(language, 'tkBook', { total: formatVnd(availablePrice * quantity, language) })}
              </button>
            </>
          ) : (
            <Link to="/login">{ui(language, 'tkSignIn')}</Link>
          )}
        </div>
      )}
      <small className="ticket-purchase-note">{ui(language, 'tkNote')}</small>
      {error && <p className="ticket-purchase-feedback error" role="alert">{error}</p>}
      {message && <p className="ticket-purchase-feedback" role="status">{message}</p>}
    </section>
  )
}
