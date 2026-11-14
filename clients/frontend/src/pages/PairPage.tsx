// Điện thoại mở từ mã QR: nhận ngôn ngữ, địa điểm và phiên đăng nhập từ máy tính rồi vào thẳng ứng dụng.
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Smartphone, TriangleAlert } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BackendApiError, claimPairing } from '../api'
import { useAppStore } from '../store'
import { apiErrorMessage, ui } from '../uiText'

function safeInAppPath(path: string): string {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path : '/explore'
}

export function PairPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const language = useAppStore((state) => state.language)
  const authReady = useAppStore((state) => state.authReady)
  const [error, setError] = useState('')
  const claimed = useRef(false)
  const code = searchParams.get('code') ?? ''

  useEffect(() => {
    // Chờ khởi động xong để ngôn ngữ/phiên nhận từ máy tính không bị dữ liệu cũ ghi đè.
    if (!authReady || claimed.current) return
    claimed.current = true

    if (!code) {
      setError(ui(useAppStore.getState().language, 'pairMissingCode'))
      return
    }

    void (async () => {
      try {
        const result = await claimPairing(code)
        const store = useAppStore.getState()
        store.setLanguage(result.language)
        if (result.placeId && store.places.some((place) => place.id === result.placeId)) {
          store.setSelectedPlace(result.placeId)
        }
        if (result.token && result.user) await store.signIn(result.token, result.user)
        navigate(safeInAppPath(result.path), { replace: true })
      } catch (claimError) {
        const currentLanguage = useAppStore.getState().language
        setError(claimError instanceof BackendApiError && claimError.status === 410
          ? ui(currentLanguage, 'pairFailed')
          : apiErrorMessage(currentLanguage, claimError, 'pairFailed'))
      }
    })()
  }, [authReady, code, navigate])

  return (
    <section className="device-entry">
      <section className="device-entry-content">
        <div className="device-connected" role={error ? 'alert' : 'status'}>
          {error ? (
            <>
              <span className="device-connected-icon device-connected-icon-error"><TriangleAlert size={28} strokeWidth={1.7} /></span>
              <h1>{ui(language, 'pairFailedTitle')}</h1>
              <p className="device-entry-intro">{error}</p>
              <div className="device-connected-actions">
                <button className="device-connected-primary" type="button" onClick={() => navigate('/explore', { replace: true })}>
                  {ui(language, 'pairGoExplore')} <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="device-connected-icon"><Smartphone size={28} strokeWidth={1.7} /></span>
              <div className="device-qr-loading" aria-hidden="true" />
              <p className="device-entry-intro">{ui(language, 'pairConnecting')}</p>
            </>
          )}
        </div>
      </section>
    </section>
  )
}
