import { useState, type FormEvent } from 'react'
import { LoaderCircle, MapPinned, Sparkles } from 'lucide-react'
import { fetchTicketPrices } from '../api'
import { categoryKeys, categoryLabels } from '../data/places'
import { optimizeRouteOrder } from '../routeOptimization'
import { useAppStore } from '../store'
import type { Category, Place } from '../types'
import { distance, point } from '@turf/turf'

interface ItineraryPlannerProps {
  places: Place[]
}

interface LodgingArea {
  name: string
  coordinates: [number, number]
}

const lodgingAreas: LodgingArea[] = [
  { name: 'Phong Nha – Sơn Trạch', coordinates: [106.283, 17.61] },
  { name: 'Đồng Hới', coordinates: [106.616, 17.467] },
  { name: 'Đông Hà', coordinates: [107.1, 16.82] },
]

function nearestLodgingArea(place: Place): LodgingArea {
  return lodgingAreas.reduce((nearest, area) =>
    distance(point(place.coordinates), point(area.coordinates), { units: 'kilometers' }) <
      distance(point(place.coordinates), point(nearest.coordinates), { units: 'kilometers' })
      ? area
      : nearest,
  )
}

export function ItineraryPlanner({ places }: ItineraryPlannerProps) {
  const language = useAppStore((state) => state.language)
  const location = useAppStore((state) => state.location)
  const setSelectedPlace = useAppStore((state) => state.setSelectedPlace)
  const setSuggestedRoute = useAppStore((state) => state.setSuggestedRoute)
  const [days, setDays] = useState(2)
  const [budget, setBudget] = useState('1000000')
  const [interests, setInterests] = useState<Category[]>(categoryKeys)
  const [plan, setPlan] = useState<{
    days: { places: Place[]; lodging: LodgingArea | null }[]
    ticketTotal: number
    unpricedCount: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleInterest = (interest: Category) => {
    setInterests((current) => current.includes(interest)
      ? current.filter((item) => item !== interest)
      : [...current, interest])
  }

  const createPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const budgetVnd = Number(budget)
    if (!Number.isInteger(days) || days < 1 || days > 7) {
      setError('Số ngày cần nằm trong khoảng 1–7.')
      return
    }
    if (!Number.isFinite(budgetVnd) || budgetVnd < 0) {
      setError('Vui lòng nhập ngân sách hợp lệ bằng VND.')
      return
    }
    if (interests.length === 0) {
      setError('Hãy chọn ít nhất một sở thích.')
      return
    }

    const candidates = places.filter((place) => interests.includes(place.category))
    if (candidates.length === 0) {
      setError('Không tìm thấy địa điểm phù hợp với sở thích đã chọn.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const ticketPrices = await fetchTicketPrices()
      const pricesByPlace = new Map(ticketPrices.map((item) => [item.placeId, item.priceVnd]))
      const selected: Place[] = []
      let ticketTotal = 0
      let unpricedCount = 0

      for (const place of candidates) {
        if (selected.length >= days * 2) break
        const price = pricesByPlace.get(place.id)
        const knownPrice = typeof price === 'number' ? price : 0
        if (ticketTotal + knownPrice > budgetVnd) continue
        selected.push(place)
        ticketTotal += knownPrice
        if (typeof price !== 'number') unpricedCount += 1
      }

      if (selected.length === 0) {
        setError('Ngân sách hiện tại không đủ cho địa điểm có giá vé đã công bố.')
        return
      }

      const origin = location ?? selected[0].coordinates
      const stops = location ? selected : selected.slice(1)
      const optimizedIds = await optimizeRouteOrder(origin, stops, new AbortController().signal)
      const orderedIds = location ? optimizedIds : [selected[0].id, ...optimizedIds]
      const orderedPlaces = orderedIds
        .map((id) => places.find((place) => place.id === id))
        .filter((place): place is Place => place !== undefined)

      setSuggestedRoute(orderedIds)

      const dayPlans = Array.from({ length: days }, () => [] as Place[])
      orderedPlaces.forEach((place, index) => {
        dayPlans[Math.floor(index / 2)].push(place)
      })
      const nonEmptyDays = dayPlans.filter((day) => day.length > 0)
      setPlan({
        days: nonEmptyDays.map((day, index) => ({
          places: day,
          lodging: index < nonEmptyDays.length - 1 ? nearestLodgingArea(day[day.length - 1]) : null,
        })),
        ticketTotal,
        unpricedCount,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tạo lịch trình. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="itinerary-planner">
      <div className="itinerary-heading">
        <span className="itinerary-icon"><Sparkles size={17} /></span>
        <div>
          <h2>Gợi ý lịch trình tự động</h2>
          <p>Chọn số ngày, sở thích và ngân sách vé để tạo tuyến cùng gợi ý khu vực nghỉ.</p>
        </div>
      </div>
      <form className="itinerary-form" onSubmit={(event) => void createPlan(event)}>
        <label className="itinerary-number-field">
          Số ngày
          <input type="number" min="1" max="7" step="1" value={days} onChange={(event) => setDays(Number(event.target.value))} />
        </label>
        <label className="itinerary-number-field">
          Ngân sách vé (VND)
          <input type="number" min="0" step="10000" value={budget} onChange={(event) => setBudget(event.target.value)} />
        </label>
        <fieldset className="itinerary-interests">
          <legend>Sở thích</legend>
          {categoryKeys.map((interest) => (
            <label key={interest}>
              <input type="checkbox" checked={interests.includes(interest)} onChange={() => toggleInterest(interest)} />
              {categoryLabels[language][interest]}
            </label>
          ))}
        </fieldset>
        <button className="itinerary-submit" type="submit" disabled={loading}>
          {loading ? <LoaderCircle className="loading-spinner" size={15} /> : <MapPinned size={15} />}
          {loading ? 'Đang tạo...' : 'Tạo lịch trình'}
        </button>
      </form>

      {error && <p className="itinerary-message is-error" role="alert">{error}</p>}
      {plan && (
        <div className="itinerary-result" aria-live="polite">
          <p className="itinerary-budget">
            Tổng vé đã biết: <strong>{plan.ticketTotal.toLocaleString('vi-VN')} VND</strong>
            {plan.unpricedCount > 0 && ` · ${plan.unpricedCount} điểm chưa có giá vé`}
          </p>
          <p className="itinerary-note">Ngân sách chưa bao gồm ăn uống, di chuyển và lưu trú. Tuyến các điểm đã được hiển thị trên bản đồ.</p>
          <div className="itinerary-days">
            {plan.days.map((day, index) => (
              <section className="itinerary-day" key={`day-${index + 1}`}>
                <h3>Ngày {index + 1}</h3>
                <ol>
                  {day.places.map((place) => (
                    <li key={place.id}>
                      <button type="button" onClick={() => setSelectedPlace(place.id)}>
                        {place.copy[language].title}
                      </button>
                      <small>{place.duration} phút</small>
                    </li>
                  ))}
                </ol>
                {day.lodging && (
                  <div className="itinerary-lodging">
                    <strong>Gợi ý nghỉ đêm: {day.lodging.name}</strong>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`khách sạn nhà nghỉ ${day.lodging.name}`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Tìm khách sạn/nhà nghỉ trên bản đồ
                    </a>
                  </div>
                )}
              </section>
            ))}
          </div>
          <p className="itinerary-note">Gợi ý khu vực, không phải danh sách cơ sở đã xác minh. Hãy hỏi trực tiếp nơi lưu trú về phòng trống, giá và thanh toán.</p>
        </div>
      )}
    </section>
  )
}
