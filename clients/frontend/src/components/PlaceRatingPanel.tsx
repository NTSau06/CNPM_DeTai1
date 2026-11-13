// Hiển thị số liệu địa điểm và biểu mẫu gửi/xem đánh giá từ backend.
import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Star } from 'lucide-react'
import { getPlaceAnalytics, getPlaceRatings, getVisitorId, submitPlaceRating } from '../api'
import type { PlaceAnalytics, PlaceRatingSummary } from '../api'
import { useAppStore } from '../store'
import { localeOf, ui } from '../uiText'

export function PlaceRatingPanel({ placeId }: { placeId: string }) {
  const language = useAppStore((state) => state.language)
  const languageRef = useRef(language)
  languageRef.current = language
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
        .catch(() => { if (active) setMessage(ui(languageRef.current, 'rtStatsError')) })
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
      .catch(() => { if (active) setMessage(ui(languageRef.current, 'rtLoadError')) })
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
      setMessage(ui(language, 'rtThanks'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ui(language, 'rtSendError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rating-panel" aria-label={ui(language, 'rtPanel')}>
      <div className="rating-panel-heading">
        <span className="eyebrow"><span className="eyebrow-line" /> {ui(language, 'rtKicker')}</span>
        <h2>{ui(language, 'rtTitle')}</h2>
        {analyticsLoading
          ? <span className="skeleton rating-skeleton-line" aria-label={ui(language, 'rtLoadingVisits')} />
          : <p>{analytics ? ui(language, 'rtVisits', { n: analytics.visits.toLocaleString(localeOf(language)) }) : ui(language, 'rtNoVisits')}</p>}
        {ratingsLoading
          ? <span className="skeleton rating-skeleton-line short" aria-label={ui(language, 'rtLoadingRatings')} />
          : <p>
          {summary?.averageRating === null || !summary
            ? ui(language, 'rtNoRatings')
            : `${summary.averageRating.toFixed(1)} / 5`}
          {summary ? ` · ${ui(language, 'rtCount', { n: summary.totalRatings })}` : ''}
          </p>}
      </div>
      <div className="rating-review-list">
        {ratingsLoading
          ? <div className="rating-review-skeleton" aria-label={ui(language, 'rtLoadingReviews')}><span className="skeleton" /><span className="skeleton" /></div>
          : summary?.reviews.map((item) => (
          <article className="rating-review" key={`${item.createdAt}-${item.review}`}>
            <span>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</span>
            <p>{item.review}</p>
            <small>{new Date(item.createdAt).toLocaleDateString(localeOf(language))}</small>
          </article>
          ))}
      </div>
      <div className="rating-form">
        <label htmlFor="place-rating">{ui(language, 'rtScore')}</label>
        <div className="rating-stars" id="place-rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              aria-label={ui(language, 'rtStars', { n: value })}
              aria-pressed={rating === value}
              key={value}
              onClick={() => setRating(value)}
              type="button"
            >
              <Star fill={value <= rating ? 'currentColor' : 'none'} size={20} />
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="place-review">{ui(language, 'rtReviewLabel')}</label>
        <textarea
          id="place-review"
          maxLength={500}
          onChange={(event) => setReview(event.target.value)}
          placeholder={ui(language, 'rtPlaceholder')}
          value={review}
        />
        <button className="rating-submit" disabled={busy} onClick={() => void submit()}>
          {busy && <LoaderCircle className="loading-spinner" size={14} aria-hidden="true" />}
          {ui(language, busy ? 'rtSending' : 'rtSubmit')}
        </button>
        <small className="rating-privacy">{ui(language, 'rtPrivacy')}</small>
        {message && <p className="rating-feedback" role="status">{message}</p>}
      </div>
    </section>
  )
}
