// Danh sách địa điểm yêu thích của tài khoản, có mở chi tiết, bỏ yêu thích và chia sẻ.
import { useState } from 'react'
import { ArrowLeft, ArrowRight, Clock3, Heart, Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { categoryLabels, localizedTitle } from '../data/places'
import { translate } from '../i18n'
import { placeShareUrl, shareLink } from '../share'
import { useAppStore } from '../store'
import { ui } from '../uiText'

export function FavoritesPage() {
  const language = useAppStore((state) => state.language)
  const places = useAppStore((state) => state.places)
  const currentUser = useAppStore((state) => state.currentUser)
  const favoriteIds = useAppStore((state) => state.favoriteIds)
  const toggleFavorite = useAppStore((state) => state.toggleFavorite)
  const [message, setMessage] = useState('')

  const favorites = favoriteIds
    .map((id) => places.find((place) => place.id === id))
    .filter((place) => place !== undefined)

  const share = async (placeId: string, title: string) => {
    const outcome = await shareLink(title, ui(language, 'shPlaceText', { title }), placeShareUrl(placeId))
    setMessage(outcome === 'copied' ? ui(language, 'shCopied') : outcome === 'failed' ? ui(language, 'shFailed') : '')
  }

  const remove = async (placeId: string) => {
    setMessage('')
    if (!(await toggleFavorite(placeId))) setMessage(ui(language, 'favError'))
  }

  return (
    <div className="subpage favorites-page">
      <div className="subpage-back"><Link to="/explore"><ArrowLeft size={15} /> {translate(language, 'explore')}</Link></div>
      <div className="subpage-heading">
        <div className="eyebrow"><span className="eyebrow-line" /> {ui(language, 'favEyebrow')}</div>
        <h1>{ui(language, 'favTitle')}</h1>
        <p>{ui(language, 'favIntro')}</p>
      </div>
      {message && <p className="ticket-history-status" role="status">{message}</p>}
      {!currentUser ? (
        <section className="empty-state">
          <div className="empty-icon"><Heart size={25} /></div>
          <h2>{ui(language, 'favSignIn')}</h2>
          <Link className="primary-link" to="/login" state={{ returnTo: '/favorites' }}>{ui(language, 'signIn')} <ArrowRight size={15} /></Link>
        </section>
      ) : favorites.length === 0 ? (
        <section className="empty-state">
          <div className="empty-icon"><Heart size={25} /></div>
          <h2>{ui(language, 'favEmpty')}</h2>
          <p>{ui(language, 'favEmptyText')}</p>
          <Link className="primary-link" to="/explore">{translate(language, 'explore')} <ArrowRight size={15} /></Link>
        </section>
      ) : (
        <div className="favorite-list">
          {favorites.map((place) => {
            const title = localizedTitle(place, language)
            return (
              <article className="favorite-card" key={place.id}>
                <div
                  className="favorite-card-image"
                  style={{ backgroundImage: `url("${place.detailImage.src}")` }}
                  aria-hidden="true"
                />
                <div className="favorite-card-body">
                  <span className="eyebrow small">{categoryLabels[language][place.category]}</span>
                  <h2>{title}</h2>
                  <p>{place.copy[language]?.subtitle ?? place.copy.vi.subtitle}</p>
                  <span className="favorite-card-meta"><Clock3 size={13} /> {place.duration} {translate(language, 'minute')}</span>
                  <div className="favorite-card-actions">
                    <Link to={`/explore?place=${encodeURIComponent(place.id)}`}>{ui(language, 'favOpen')} <ArrowRight size={14} /></Link>
                    <button type="button" onClick={() => void share(place.id, title)}><Share2 size={14} /> {ui(language, 'shShare')}</button>
                    <button type="button" className="favorite-remove" onClick={() => void remove(place.id)}>
                      <Heart size={14} fill="currentColor" /> {ui(language, 'favRemove')}
                    </button>
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
