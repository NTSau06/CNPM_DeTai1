// Chọn trải nghiệm máy tính/điện thoại và tạo mã QR để mở trên điện thoại.
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Map, Monitor, QrCode, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import { useNavigate } from 'react-router-dom'

export function DeviceEntryPage() {
  const navigate = useNavigate()
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
          setQrError(error instanceof Error ? error.message : 'Không thể tạo mã QR.')
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
    <main className="device-entry">
      <header className="device-entry-brand">
        <span className="brand-mark"><Map size={19} strokeWidth={1.8} /></span>
        <span className="brand-name">Quảng Trị</span>
      </header>

      <section className="device-entry-content">
        <div className="device-entry-eyebrow"><span /> HÀNH TRÌNH KHÁM PHÁ BẮT ĐẦU TỪ ĐÂY</div>
        {!showQr ? (
          <>
            <h1>Bạn muốn khám phá<br /><em>theo cách nào?</em></h1>
            <p className="device-entry-intro">Chọn thiết bị để bắt đầu hành trình qua những miền di sản và cảnh đẹp.</p>
            <div className="device-choice-grid">
              <button className="device-choice-card" type="button" onClick={() => navigate('/explore')}>
                <span className="device-choice-icon"><Monitor size={25} strokeWidth={1.6} /></span>
                <span className="device-choice-copy">
                  <strong>Trên máy tính</strong>
                  <small>Khám phá với màn hình rộng và bản đồ chi tiết.</small>
                </span>
                <ArrowRight className="device-choice-arrow" size={19} />
              </button>
              <button className="device-choice-card" type="button" onClick={openPhoneExperience}>
                <span className="device-choice-icon"><Smartphone size={25} strokeWidth={1.6} /></span>
                <span className="device-choice-copy">
                  <strong>Trên điện thoại</strong>
                  <small>Tiếp tục hành trình ngay trên thiết bị di động.</small>
                </span>
                <ArrowRight className="device-choice-arrow" size={19} />
              </button>
            </div>
          </>
        ) : (
          <div className="device-qr-panel">
            <button className="device-entry-back" type="button" onClick={() => setShowQr(false)}>
              <ArrowLeft size={16} /> Quay lại chọn thiết bị
            </button>
            <div className="device-qr-layout">
              <div>
                <span className="device-qr-icon"><QrCode size={22} /></span>
                <h1>Mở trên<br /><em>điện thoại</em></h1>
                <p className="device-entry-intro">Dùng camera điện thoại quét mã QR để tiếp tục khám phá trên thiết bị của bạn.</p>
                <ol className="device-qr-steps">
                  <li><span>1</span> Mở camera trên điện thoại</li>
                  <li><span>2</span> Hướng camera vào mã QR</li>
                  <li><span>3</span> Chạm vào liên kết hiện ra</li>
                </ol>
              </div>
              <div className="device-qr-code">
                {qrImage
                  ? <img src={qrImage} alt="Mã QR mở ứng dụng Quảng Trị trên điện thoại" />
                  : qrError
                    ? <p className="device-qr-error" role="alert">{qrError}</p>
                    : <div className="device-qr-loading" aria-label="Đang tạo mã QR" />}
                <span>Quét để bắt đầu</span>
              </div>
            </div>
            {needsLanAddress && (
              <p className="device-qr-warning" role="status">
                Máy tính đang dùng địa chỉ localhost nên điện thoại không thể mở liên kết này. Hãy chạy ứng dụng bằng <code>npm run dev</code> từ thư mục gốc dự án để tạo mã QR dùng chung mạng Wi-Fi.
              </p>
            )}
          </div>
        )}
        <div className="device-entry-footer"><span /> QUẢNG TRỊ · QUẢNG BÌNH <span /></div>
      </section>
    </main>
  )
}
