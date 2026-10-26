// Đăng ký, đăng nhập và quản lý hồ sơ tài khoản.
import { useState, type FormEvent } from 'react'
import { Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, LogOut, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { loginAccount, registerAccount } from '../api'
import { useAppStore } from '../store'
import type { UserProfile } from '../types'

export function UserPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentUser = useAppStore((state) => state.currentUser)
  const signIn = useAppStore((state) => state.signIn)
  const updateCurrentUser = useAppStore((state) => state.updateCurrentUser)
  const signOut = useAppStore((state) => state.signOut)
  const setRoutePlace = useAppStore((state) => state.setRoutePlace)
  const isProfile = location.pathname === '/profile'
  const isRegister = location.pathname === '/register'
  const [feedback, setFeedback] = useState('')
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (isProfile && !currentUser) return <Navigate to="/login" replace />
  if (!isProfile && currentUser) return <Navigate to="/profile" replace />

  const onSubmitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback('')
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

    setSubmitting(true)
    try {
      const result = isRegister
        ? await registerAccount(
          String(values.get('fullName') ?? '').trim(),
          email,
          String(values.get('phone') ?? '').trim(),
          password,
        )
        : await loginAccount(email, password)
      await signIn(result.token, result.user)
      const navigationState = location.state as { returnTo?: unknown; pendingPlaceId?: unknown } | null
      if (typeof navigationState?.pendingPlaceId === 'string') {
        if (!useAppStore.getState().routeIds.includes(navigationState.pendingPlaceId)) {
          await setRoutePlace(navigationState.pendingPlaceId)
        }
        const returnTo = typeof navigationState.returnTo === 'string' && navigationState.returnTo.startsWith('/') && !navigationState.returnTo.startsWith('//')
          ? navigationState.returnTo
          : '/explore'
        navigate(returnTo, { replace: true })
      } else {
        navigate('/profile', { replace: true })
      }
    } catch (error) {
      setFeedback(getAuthErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
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
        <NavLink to="/explore" className="user-back"><ArrowLeft size={15} /> Trở về khám phá</NavLink>
        <div className="user-card profile-card">
          <div className="user-page-heading">
            <span className="user-avatar-large">{getInitials(currentUser.fullName)}</span>
            <div>
              <span className="user-eyebrow">TÀI KHOẢN CỦA BẠN</span>
              <h1>Hồ sơ cá nhân</h1>
              <p>Cập nhật thông tin để cá nhân hóa hành trình của bạn.</p>
            </div>
            <button className="signout-button" onClick={() => { void signOut().then(() => navigate('/login', { replace: true })) }}>
              <LogOut size={15} /> Đăng xuất
            </button>
          </div>
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
      <NavLink to="/explore" className="user-back"><ArrowLeft size={15} /> Trở về khám phá</NavLink>
      <div className="user-card auth-card">
        <div className="auth-heading">
          <span className="user-avatar-large"><UserRound size={24} /></span>
          <span className="user-eyebrow">QUẢNG TRỊ · QUẢNG BÌNH</span>
          <h1>{isRegister ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</h1>
          <p>{isRegister ? 'Tạo hồ sơ để lưu lại những hành trình đáng nhớ.' : 'Đăng nhập để tiếp tục hành trình của bạn.'}</p>
        </div>
        <div className="auth-divider"><span>bằng email</span></div>
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
          <button className="user-submit" type="submit" disabled={submitting}>
            {submitting ? 'Đang xử lý…' : isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
          </button>
        </form>
        <p className="auth-switch">
          {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
          <NavLink to={isRegister ? '/login' : '/register'} state={location.state}>
            {isRegister ? 'Đăng nhập' : 'Đăng ký'}
          </NavLink>
        </p>
      </div>
    </section>
  )
}

function getAuthErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return 'Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng và thử lại.'
  }
  const status = error.status
  if (status === 401) return 'Email hoặc mật khẩu không chính xác.'
  if (status === 409) return 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.'
  if (status === 422) return 'Thông tin đăng ký chưa hợp lệ. Hãy kiểm tra email và mật khẩu.'
  if (status === 404) return 'Máy chủ đang chạy phiên bản cũ, chưa có API tài khoản. Hãy khởi động lại backend rồi thử lại.'
  if (status === 0) return 'Không kết nối được máy chủ. Hãy kiểm tra backend và thử lại.'
  return 'Không thể xác thực tài khoản. Vui lòng thử lại.'
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}
