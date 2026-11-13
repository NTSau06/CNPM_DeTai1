// Chọn trải nghiệm máy tính/điện thoại và tạo mã QR để mở trên điện thoại.
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Home, Monitor, QrCode, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { ui } from '../uiText'

export function DeviceEntryPage() {
  const navigate = useNavigate()
  const language = useAppStore((state) => state.language)
  const [showQr, setShowQr] = useState(false)
  const [qrImage, setQrImage] = useState('')
  const [qrError, setQrError] = useState('')
  const mobileUrl = useMemo(() => {
    const appUrl = new URL(import.meta.env.BASE_URL, import.meta.env.VITE_MOBILE_URL || window.location.origin)
    appUrl.searchParams.set('device', 'mobile')
    return appUrl.toString()
  }, [])
  const needsLanAddress = !import.meta.env.VITE_MOBILE_URL &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname)

  useEffect(() => {
    if (!showQr) return

    let cancelled = false
    setQrImage('')
    setQrError('')
    void QRCode.toDataURL(mobileUrl, { width: 240, margin: 2, errorCorrectionLevel: 'M' })
      .then((image) => {
        if (!cancelled) setQrImage(image)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setQrError(error instanceof Error ? error.message : ui(useAppStore.getState().language, 'dvQrError'))
        }
      })

    return () => {
      cancelled = true
    }
  }, [mobileUrl, showQr])

  const openPhoneExperience = () => {
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
      navigate('/explore')
      return
    }
    setShowQr(true)
  }

  return (
    <section className="device-entry">
      <section className="device-entry-content">
        <div className="device-entry-actions">
          <button className="device-entry-home" type="button" onClick={() => navigate('/explore')}>
            <Home size={16} /> {ui(language, 'dvHome')}
          </button>
        </div>
        <div className="device-entry-eyebrow"><span /> {ui(language, 'dvEyebrow')}</div>
        {!showQr ? (
          <>
            <h1>{ui(language, 'dvTitle1')}<br /><em>{ui(language, 'dvTitle2')}</em></h1>
            <p className="device-entry-intro">{ui(language, 'dvIntro')}</p>
            <div className="device-choice-grid">
              <button className="device-choice-card" type="button" onClick={() => navigate('/explore')}>
                <span className="device-choice-icon"><Monitor size={25} strokeWidth={1.6} /></span>
                <span className="device-choice-copy">
                  <strong>{ui(language, 'dvDesktop')}</strong>
                  <small>{ui(language, 'dvDesktopText')}</small>
                </span>
                <ArrowRight className="device-choice-arrow" size={19} />
              </button>
              <button className="device-choice-card" type="button" onClick={openPhoneExperience}>
                <span className="device-choice-icon"><Smartphone size={25} strokeWidth={1.6} /></span>
                <span className="device-choice-copy">
                  <strong>{ui(language, 'dvPhone')}</strong>
                  <small>{ui(language, 'dvPhoneText')}</small>
                </span>
                <ArrowRight className="device-choice-arrow" size={19} />
              </button>
            </div>
          </>
        ) : (
          <div className="device-qr-panel">
            <button className="device-entry-back" type="button" onClick={() => setShowQr(false)}>
              <ArrowLeft size={16} /> {ui(language, 'dvBack')}
            </button>
            <div className="device-qr-layout">
              <div>
                <span className="device-qr-icon"><QrCode size={22} /></span>
                <h1>{ui(language, 'dvQrTitle1')}<br /><em>{ui(language, 'dvQrTitle2')}</em></h1>
                <p className="device-entry-intro">{ui(language, 'dvQrIntro')}</p>
                <ol className="device-qr-steps">
                  <li><span>1</span> {ui(language, 'dvStep1')}</li>
                  <li><span>2</span> {ui(language, 'dvStep2')}</li>
                  <li><span>3</span> {ui(language, 'dvStep3')}</li>
                </ol>
              </div>
              <div className="device-qr-code">
                {qrImage
                  ? <img src={qrImage} alt={ui(language, 'dvQrAlt')} />
                  : qrError
                    ? <p className="device-qr-error" role="alert">{qrError}</p>
                    : <div className="device-qr-loading" aria-label={ui(language, 'dvQrLoading')} />}
                <span>{ui(language, 'dvScan')}</span>
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
