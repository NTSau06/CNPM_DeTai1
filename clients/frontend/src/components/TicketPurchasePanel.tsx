import { useEffect, useState } from 'react'
import { LoaderCircle, Ticket } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  createTicketOrder,
  fetchMyTicketOrders,
  fetchTicketPrices,
} from '../api'
import type { TicketOrder, TicketPrice } from '../api'
import { useAppStore } from '../store'

const formatVnd = (value: number) => `${value.toLocaleString('vi-VN')} ₫`

export function TicketPurchasePanel({ placeId }: { placeId: string }) {
  const authToken = useAppStore((state) => state.authToken)
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
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không tải được thông tin vé.')
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
      setMessage(`Đặt thành công ${quantity} vé, tổng ${formatVnd(order.totalPriceVnd)}.`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể đặt vé.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ticket-purchase-panel" aria-label="Đặt vé tham quan">
      <div className="ticket-purchase-heading">
        <span className="ticket-purchase-icon"><Ticket size={18} /></span>
        <div>
          <h2>Vé tham quan</h2>
          <p>{loading ? 'Đang tải thông tin vé…' : availablePrice !== null ? `Giá ${formatVnd(availablePrice)}/vé` : 'Địa điểm hiện chưa mở bán vé.'}</p>
        </div>
      </div>
      {ownedTickets > 0 && <p className="ticket-owned-count">Bạn đã đặt {ownedTickets} vé tại địa điểm này.</p>}
      {availablePrice !== null && (
        <div className="ticket-order-controls">
          {authToken ? (
            <>
              <label>
                Số lượng
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
                {busy ? 'Đang đặt…' : `Đặt vé · ${formatVnd(availablePrice * quantity)}`}
              </button>
            </>
          ) : (
            <Link to="/login">Đăng nhập để đặt vé</Link>
          )}
        </div>
      )}
      <small className="ticket-purchase-note">Giá vé minh họa để thử nghiệm, chưa xác nhận là giá chính thức. Đơn đặt vé chưa thu tiền trực tuyến.</small>
      {error && <p className="ticket-purchase-feedback error" role="alert">{error}</p>}
      {message && <p className="ticket-purchase-feedback" role="status">{message}</p>}
    </section>
  )
}
