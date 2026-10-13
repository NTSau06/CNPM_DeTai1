import { ArrowLeft, ArrowRight, Bookmark, Clock3, MapPin, Route, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { findPlace, localizedTitle } from '../data/places'
import { translate } from '../i18n'
import { useAppStore } from '../store'

export function SavedPage() {
  const language = useAppStore((state) => state.language)
  const tours = useAppStore((state) => state.savedTours)
  const removeTour = useAppStore((state) => state.removeTour)

  return (
    <div className="subpage">
      <div className="subpage-back"><Link to="/"><ArrowLeft size={15} /> {translate(language, 'explore')}</Link></div>
      <div className="subpage-heading">
        <div className="eyebrow"><span className="eyebrow-line" /> MADE FOR ANOTHER DAY</div>
        <h1>{translate(language, 'savedTitle')}</h1>
        <p>{translate(language, 'noSavedText')}</p>
      </div>
      {tours.length === 0 ? (
        <section className="empty-state">
          <div className="empty-icon"><Bookmark size={25} /></div>
          <h2>{translate(language, 'noSaved')}</h2>
          <p>{translate(language, 'noSavedText')}</p>
          <Link className="primary-link" to="/">{translate(language, 'explore')} <ArrowRight size={15} /></Link>
        </section>
      ) : (
        <div className="saved-tour-list">
          {tours.map((tour, index) => {
            const savedPlaces = tour.placeIds.map((id) => findPlace(id)).filter((place) => place !== undefined)
            const first = savedPlaces[0]
            return (
              <article className="saved-tour-card" key={tour.id}>
                <div className={`tour-cover illustration-${first?.image ?? 'river'}`}>
                  <span>WALK NO. {String(tours.length - index).padStart(2, '0')}</span>
                  <div>{first ? localizedTitle(first, language) : translate(language, 'route')}</div>
                </div>
                <div className="tour-card-copy">
                  <span className="eyebrow small">QUẢNG TRỊ · {new Date(tour.createdAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : language)}</span>
                  <h2>{savedPlaces.length ? savedPlaces.map((place) => localizedTitle(place, language)).join('  →  ') : translate(language, 'route')}</h2>
                  <div className="tour-meta"><span><MapPin size={14} />{tour.placeIds.length} {translate(language, 'stopCount')}</span><span><Route size={14} />{tour.distanceKm.toFixed(1)} {translate(language, 'distanceUnit')}</span><span><Clock3 size={14} />{tour.durationMinutes} {translate(language, 'minute')}</span></div>
                  <div className="tour-card-actions">
                    <Link to="/" onClick={() => first && useAppStore.getState().setSelectedPlace(first.id)}>{translate(language, 'explore')} <ArrowRight size={14} /></Link>
                    <button onClick={() => { void removeTour(tour.id) }} aria-label={translate(language, 'delete')}><Trash2 size={15} /> {translate(language, 'delete')}</button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
