import { useEffect, useState } from 'react'
import { LoaderCircle, Star } from 'lucide-react'
import { getPlaceAnalytics, getPlaceRatings, getVisitorId, submitPlaceRating } from '../api'
import type { PlaceAnalytics, PlaceRatingSummary } from '../api'

export function PlaceRatingPanel({ placeId }: { placeId: string }) {
  const [summary, setSummary] = useState<PlaceRatingSummary | null>(null)
  const [analytics, setAnalytics] = useState<PlaceAnalytics | null>(null)
  const [rating, setRating] = useState(5)
  const [review, setReview] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [ratingsLoading, setRatingsLoading] = useState(true)

  useEffect(() => {
    let active = true
    const loadAnalytics = () => {
      setAnalyticsLoading(true)
      void getPlaceAnalytics(placeId)
        .then((result) => { if (active) setAnalytics(result) })
        .catch(() => { if (active) setMessage('Chưa tải được số liệu địa điểm. Kiểm tra kết nối máy chủ rồi thử lại.') })
        .finally(() => { if (active) setAnalyticsLoading(false) })
    }
    const refreshAfterVisit = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.placeId === placeId) loadAnalytics()
    }

    setSummary(null)
    setAnalytics(null)
    setMessage('')
    setRatingsLoading(true)
    void getPlaceRatings(placeId)
      .then((result) => { if (active) setSummary(result) })
      .catch(() => { if (active) setMessage('Chưa tải được đánh giá. Kiểm tra kết nối máy chủ rồi thử lại.') })
      .finally(() => { if (active) setRatingsLoading(false) })
    loadAnalytics()
    window.addEventListener('place-visit-recorded', refreshAfterVisit)
    return () => {
      active = false
      window.removeEventListener('place-visit-recorded', refreshAfterVisit)
    }
  }, [placeId])

  const submit = async () => {
    setBusy(true)
    setMessage('')
    try {
      const visitorId = await getVisitorId()
      setSummary(await submitPlaceRating(placeId, visitorId, rating, review))
      setReview('')
      setMessage('Cảm ơn bạn đã đánh giá địa điểm.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không gửi được đánh giá.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rating-panel" aria-label="Đánh giá địa điểm">
      <div className="rating-panel-heading">
        <span className="eyebrow"><span className="eyebrow-line" /> Ý KIẾN DU KHÁCH</span>
        <h2>Đánh giá điểm dừng</h2>
        {analyticsLoading
          ? <span className="skeleton rating-skeleton-line" aria-label="Đang tải lượt ghé" />
          : <p>{analytics ? `${analytics.visits.toLocaleString('vi-VN')} lượt ghé được app ghi nhận trong 30 ngày gần nhất` : 'Chưa có dữ liệu lượt ghé.'}</p>}
        {ratingsLoading
          ? <span className="skeleton rating-skeleton-line short" aria-label="Đang tải đánh giá" />
          : <p>
          {summary?.averageRating === null || !summary
            ? 'Chưa có đánh giá'
            : `${summary.averageRating.toFixed(1)} / 5`}
          {summary ? ` · ${summary.totalRatings} lượt đánh giá` : ''}
          </p>}
      </div>
      <div className="rating-review-list">
        {ratingsLoading
          ? <div className="rating-review-skeleton" aria-label="Đang tải nhận xét"><span className="skeleton" /><span className="skeleton" /></div>
          : summary?.reviews.map((item) => (
          <article className="rating-review" key={`${item.createdAt}-${item.review}`}>
            <span>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</span>
            <p>{item.review}</p>
            <small>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</small>
          </article>
          ))}
      </div>
      <div className="rating-form">
        <label htmlFor="place-rating">Chấm điểm</label>
        <div className="rating-stars" id="place-rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              aria-label={`${value} sao`}
              aria-pressed={rating === value}
              key={value}
              onClick={() => setRating(value)}
              type="button"
            >
              <Star fill={value <= rating ? 'currentColor' : 'none'} size={20} />
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="place-review">Nhận xét (không bắt buộc)</label>
        <textarea
          id="place-review"
          maxLength={500}
          onChange={(event) => setReview(event.target.value)}
          placeholder="Chia sẻ cảm nhận của bạn (không bắt buộc)"
          value={review}
        />
        <button className="rating-submit" disabled={busy} onClick={() => void submit()}>
          {busy && <LoaderCircle className="loading-spinner" size={14} aria-hidden="true" />}
          {busy ? 'Đang gửi…' : 'Gửi đánh giá'}
        </button>
        <small className="rating-privacy">Mỗi mã thiết bị có thể cập nhật một đánh giá/địa điểm; đánh giá chưa xác minh danh tính và có thể bị giả mạo.</small>
        {message && <p className="rating-feedback" role="status">{message}</p>}
      </div>
    </section>
  )
}
