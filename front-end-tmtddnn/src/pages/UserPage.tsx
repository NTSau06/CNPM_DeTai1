import { useState, type FormEvent } from 'react'
import { Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, LogOut, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { useAppStore } from '../store'
import type { UserProfile } from '../types'

const previewNotice = 'Bản xem trước: đăng nhập chưa xác minh tài khoản và dữ liệu chỉ nằm trong bộ nhớ trang. Google OAuth chưa được kết nối.'

export function UserPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentUser = useAppStore((state) => state.currentUser)
  const setCurrentUser = useAppStore((state) => state.setCurrentUser)
  const updateCurrentUser = useAppStore((state) => state.updateCurrentUser)
  const signOut = useAppStore((state) => state.signOut)
  const isProfile = location.pathname === '/profile'
  const isRegister = location.pathname === '/register'
  const [feedback, setFeedback] = useState('')
  const [saved, setSaved] = useState(false)

  if (isProfile && !currentUser) return <Navigate to="/login" replace />
  if (!isProfile && currentUser) return <Navigate to="/profile" replace />

  const onSubmitAuth = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const email = String(values.get('email') ?? '').trim().toLowerCase()
    const password = String(values.get('password') ?? '')
    if (password.length < 8) {
      setFeedback('Mật khẩu cần có ít nhất 8 ký tự.')
      return
    }

    if (isRegister && password !== values.get('confirmPassword')) {
      setFeedback('Mật khẩu xác nhận chưa khớp.')
      return
    }

    const emailName = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
    const user: UserProfile = {
      fullName: isRegister ? String(values.get('fullName') ?? '').trim() : emailName,
      email,
      phone: isRegister ? String(values.get('phone') ?? '').trim() : '',
      birthDate: '',
      gender: '',
      address: '',
    }
    setCurrentUser(user)
    navigate('/profile', { replace: true })
  }

  const onSaveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentUser) return
    const values = new FormData(event.currentTarget)
    updateCurrentUser({
      ...currentUser,
      fullName: String(values.get('fullName') ?? '').trim(),
      phone: String(values.get('phone') ?? '').trim(),
      birthDate: String(values.get('birthDate') ?? ''),
      gender: values.get('gender') as UserProfile['gender'],
      address: String(values.get('address') ?? '').trim(),
    })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  if (isProfile && currentUser) {
    return (
      <section className="user-page">
        <NavLink to="/" className="user-back"><ArrowLeft size={15} /> Trở về khám phá</NavLink>
        <div className="user-card profile-card">
          <div className="user-page-heading">
            <span className="user-avatar-large">{getInitials(currentUser.fullName)}</span>
            <div>
              <span className="user-eyebrow">TÀI KHOẢN CỦA BẠN</span>
              <h1>Hồ sơ cá nhân</h1>
              <p>Cập nhật thông tin để cá nhân hóa hành trình của bạn.</p>
            </div>
            <button className="signout-button" onClick={() => { signOut(); navigate('/login', { replace: true }) }}>
              <LogOut size={15} /> Đăng xuất
            </button>
          </div>
          <PreviewNotice />
          <form className="user-form profile-form" onSubmit={onSaveProfile}>
            <label>Họ và tên
              <span className="input-with-icon"><UserRound size={16} /><input name="fullName" required maxLength={80} defaultValue={currentUser.fullName} autoComplete="name" /></span>
            </label>
            <label>Email
              <span className="input-with-icon"><Mail size={16} /><input type="email" value={currentUser.email} readOnly /></span>
            </label>
            <label>Số điện thoại
              <span className="input-with-icon"><Phone size={16} /><input name="phone" type="tel" maxLength={20} defaultValue={currentUser.phone} autoComplete="tel" /></span>
            </label>
            <label>Ngày sinh
              <input name="birthDate" type="date" defaultValue={currentUser.birthDate} />
            </label>
            <label>Giới tính
              <select name="gender" defaultValue={currentUser.gender}>
                <option value="">Chọn (không bắt buộc)</option>
                <option value="female">Nữ</option>
                <option value="male">Nam</option>
                <option value="other">Khác</option>
                <option value="prefer-not-to-say">Không muốn trả lời</option>
              </select>
            </label>
            <label className="profile-address">Địa chỉ
              <span className="input-with-icon"><MapPin size={16} /><input name="address" maxLength={160} defaultValue={currentUser.address} autoComplete="street-address" placeholder="Tỉnh/thành phố, quốc gia" /></span>
            </label>
            <div className="profile-actions">
              {saved && <span className="profile-saved" role="status"><Check size={15} /> Đã cập nhật trong phiên này</span>}
              <button className="user-submit" type="submit">Lưu thông tin</button>
            </div>
          </form>
        </div>
      </section>
    )
  }

  return (
    <section className="user-page">
      <NavLink to="/" className="user-back"><ArrowLeft size={15} /> Trở về khám phá</NavLink>
      <div className="user-card auth-card">
        <div className="auth-heading">
          <span className="user-avatar-large"><UserRound size={24} /></span>
          <span className="user-eyebrow">QUẢNG TRỊ · QUẢNG BÌNH</span>
          <h1>{isRegister ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</h1>
          <p>{isRegister ? 'Tạo hồ sơ để lưu lại những hành trình đáng nhớ.' : 'Đăng nhập để tiếp tục hành trình của bạn.'}</p>
        </div>
        <PreviewNotice />
        <button className="google-preview-button" type="button" onClick={() => setFeedback('Google OAuth chưa được kết nối. Bạn có thể xem trước bằng biểu mẫu email bên dưới.')}>
          <GoogleMark /> Tiếp tục với Google
        </button>
        <div className="auth-divider"><span>hoặc bằng email</span></div>
        <form className="user-form" onSubmit={onSubmitAuth}>
          {isRegister && (
            <>
              <label>Họ và tên
                <span className="input-with-icon"><UserRound size={16} /><input name="fullName" required maxLength={80} autoComplete="name" placeholder="Nguyễn Văn An" /></span>
              </label>
              <label>Số điện thoại <small>(không bắt buộc)</small>
                <span className="input-with-icon"><Phone size={16} /><input name="phone" type="tel" maxLength={20} autoComplete="tel" placeholder="+84" /></span>
              </label>
            </>
          )}
          <label>Email
            <span className="input-with-icon"><Mail size={16} /><input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="ban@example.com" /></span>
          </label>
          <label>Mật khẩu
            <input name="password" type="password" required minLength={8} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder="Ít nhất 8 ký tự" />
          </label>
          {isRegister && <label>Xác nhận mật khẩu
            <input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" placeholder="Nhập lại mật khẩu" />
          </label>}
          {feedback && <p className="user-feedback" role="status">{feedback}</p>}
          <button className="user-submit" type="submit">{isRegister ? 'Tạo tài khoản xem trước' : 'Đăng nhập xem trước'}</button>
        </form>
        <p className="auth-switch">
          {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
          <NavLink to={isRegister ? '/login' : '/register'}>{isRegister ? 'Đăng nhập' : 'Đăng ký'}</NavLink>
        </p>
      </div>
    </section>
  )
}

function PreviewNotice() {
  return <p className="preview-notice" role="note">{previewNotice}</p>
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 18 18" width="17" height="17">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.63Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.8.54-1.82.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.34A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.95a9 9 0 0 0 0 8.12l3.02-2.34Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.43 1.35L15 2.36A8.6 8.6 0 0 0 9 0a9 9 0 0 0-8.05 4.94l3.02 2.34c.71-2.12 2.69-3.7 5.03-3.7Z" />
  </svg>
}
