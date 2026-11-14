// "Mở trên điện thoại": mã QR tạo phiên ghép nối để điện thoại nhận ngôn ngữ, địa điểm và đăng nhập từ máy tính.
import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, Home, QrCode, RefreshCw, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import { useNavigate } from 'react-router-dom'
import { createPairing, getPairingStatus, type PairingTicket } from '../api'
import { useAppStore } from '../store'
import { apiErrorMessage, ui } from '../uiText'

type PairingState = 'loading' | 'pending' | 'claimed' | 'expired' | 'error'

const POLL_INTERVAL_MS = 2000

function pairingUrl(code: string): string {
  const url = new URL(`${import.meta.env.BASE_URL}pair`, import.meta.env.VITE_MOBILE_URL || window.location.origin)
  url.searchParams.set('code', code)
  return url.toString()
}

function formatRemaining(seconds: number): string {
  const safe = Math.max(0, seconds)
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

export function DeviceEntryPage() {
  const navigate = useNavigate()
  const language = useAppStore((state) => state.language)
  const [requestId, setRequestId] = useState(0)
  const [ticket, setTicket] = useState<PairingTicket | null>(null)
  const [pairingState, setPairingState] = useState<PairingState>('loading')
  const [qrImage, setQrImage] = useState('')
  const [qrError, setQrError] = useState('')
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const needsLanAddress = !import.meta.env.VITE_MOBILE_URL &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname)

  // Tạo phiên ghép nối mới khi mở trang hoặc bấm "Tạo mã mới".
  useEffect(() => {
    let cancelled = false
    const { language: currentLanguage, selectedPlaceId, authToken } = useAppStore.getState()
    setTicket(null)
    setQrImage('')
    setQrError('')
    setPairingState('loading')

    void (async () => {
      try {
        const created = await createPairing(currentLanguage, selectedPlaceId || null, authToken)
        const image = await QRCode.toDataURL(pairingUrl(created.code), { width: 240, margin: 2, errorCorrectionLevel: 'M' })
        if (cancelled) return
        // Tính hạn theo đồng hồ máy này để đếm ngược đúng dù đồng hồ máy chủ lệch.
        const createdAt = Math.floor(Date.now() / 1000)
        setTicket({ ...created, expiresAt: createdAt + created.expiresIn })
        setQrImage(image)
        setNow(createdAt)
        setPairingState('pending')
      } catch (error) {
        if (cancelled) return
        setQrError(apiErrorMessage(useAppStore.getState().language, error, 'dvQrError'))
        setPairingState('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [requestId])

  // Hỏi backend xem điện thoại đã quét mã chưa.
  useEffect(() => {
    if (pairingState !== 'pending' || !ticket) return

    let cancelled = false
    let polling = false
    const clock = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    const timer = window.setInterval(() => {
      const current = Math.floor(Date.now() / 1000)
      if (polling) return
      polling = true
      void getPairingStatus(ticket.code)
        .then((status) => {
          if (cancelled) return
          if (status === 'claimed') setPairingState('claimed')
          else if (status === 'expired' || current >= ticket.expiresAt) setPairingState('expired')
        })
        .catch(() => {
          // Lỗi mạng tạm thời: thử lại ở lượt sau, chỉ báo hết hạn khi quá thời gian.
          if (!cancelled && current >= ticket.expiresAt) setPairingState('expired')
        })
        .finally(() => {
          polling = false
        })
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(clock)
      window.clearInterval(timer)
    }
  }, [pairingState, ticket])

  const refreshPairing = () => setRequestId((value) => value + 1)
  const remaining = ticket ? ticket.expiresAt - now : 0

  return (
    <section className="device-entry">
      <section className="device-entry-content">
        <div className="device-entry-actions">
          <button className="device-entry-home" type="button" onClick={() => navigate('/explore')}>
            <Home size={16} /> {ui(language, 'dvHome')}
          </button>
        </div>
        <div className="device-entry-eyebrow"><span /> {ui(language, 'dvEyebrow')}</div>
        {pairingState === 'claimed' ? (
          <div className="device-qr-panel">
            <div className="device-connected" role="status">
              <span className="device-connected-icon"><CheckCircle2 size={30} strokeWidth={1.7} /></span>
              <h1>{ui(language, 'dvConnected1')}<br /><em>{ui(language, 'dvConnected2')}</em></h1>
              <p className="device-entry-intro">{ui(language, 'dvConnectedText')}</p>
              <div className="device-connected-actions">
                <button className="device-connected-primary" type="button" onClick={() => navigate('/explore')}>
                  {ui(language, 'dvContinueDesktop')} <ArrowRight size={16} />
                </button>
                <button className="device-qr-refresh" type="button" onClick={refreshPairing}>
                  <Smartphone size={15} /> {ui(language, 'dvPairAgain')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="device-qr-panel">
            <div className="device-qr-layout">
              <div>
                <span className="device-qr-icon"><QrCode size={22} /></span>
                <h1>{ui(language, 'dvQrTitle1')}<br /><em>{ui(language, 'dvQrTitle2')}</em></h1>
                <p className="device-entry-intro">{ui(language, 'dvQrIntro')}</p>
                {ticket?.signedIn && <p className="device-qr-signed">{ui(language, 'dvQrSignedIn')}</p>}
                <ol className="device-qr-steps">
                  <li><span>1</span> {ui(language, 'dvStep1')}</li>
                  <li><span>2</span> {ui(language, 'dvStep2')}</li>
                  <li><span>3</span> {ui(language, 'dvStep3')}</li>
                </ol>
              </div>
              <div className="device-qr-code">
                {pairingState === 'pending' && qrImage ? (
                  <>
                    <img src={qrImage} alt={ui(language, 'dvQrAlt')} />
                    <span>{ui(language, 'dvScan')}</span>
                    <small className="device-qr-timer">{ui(language, 'dvExpiresIn', { time: formatRemaining(remaining) })}</small>
                  </>
                ) : pairingState === 'expired' || pairingState === 'error' ? (
                  <>
                    <p className="device-qr-error" role="alert">
                      {pairingState === 'expired' ? ui(language, 'dvExpired') : qrError}
                    </p>
                    <button className="device-qr-refresh" type="button" onClick={refreshPairing}>
                      <RefreshCw size={15} /> {ui(language, 'dvRefresh')}
                    </button>
                  </>
                ) : (
                  <div className="device-qr-loading" aria-label={ui(language, 'dvQrLoading')} />
                )}
              </div>
            </div>
            {needsLanAddress && (
              <p className="device-qr-warning" role="status">
                {ui(language, 'dvLocalhost1')} <code>npm run dev</code> {ui(language, 'dvLocalhost2')}
              </p>
            )}
          </div>
        )}
        <div className="device-entry-footer"><span /> {ui(language, 'regionName').toLocaleUpperCase(language)} <span /></div>
      </section>
    </section>
  )
}
