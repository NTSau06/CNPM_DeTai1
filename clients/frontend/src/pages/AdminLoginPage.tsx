// Trang đăng nhập dành riêng cho quản trị viên hệ thống.
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, NavLink, useNavigate } from 'react-router-dom'
import { ArrowLeft, KeyRound, Mail, Map, Shield } from 'lucide-react'
import {
  fetchCurrentUser,
  getStoredAdminAuthToken,
  loginAccount,
  logoutAccount,
  storeAdminAuthToken,
} from '../api'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [checkingSession, setCheckingSession] = useState(true)
  const [alreadyAdmin, setAlreadyAdmin] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let active = true
    const token = getStoredAdminAuthToken()
    if (!token) {
      setCheckingSession(false)
      return
    }
    fetchCurrentUser(token)
      .then((user) => {
        if (!active) return
        if (user.isAdmin) {
          setAlreadyAdmin(true)
        } else {
          storeAdminAuthToken(null)
        }
      })
      .catch(() => {
        if (active) storeAdminAuthToken(null)
      })
      .finally(() => {
        if (active) setCheckingSession(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (checkingSession) return null
  if (alreadyAdmin) return <Navigate to="/admin" replace />

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback('')
    const values = new FormData(event.currentTarget)
    const email = String(values.get('email') ?? '').trim().toLowerCase()
    const password = String(values.get('password') ?? '')
    if (password.length < 8) {
      setFeedback('Mật khẩu cần có ít nhất 8 ký tự.')
      return
    }

    setSubmitting(true)
    try {
      const result = await loginAccount(email, password)
      if (!result.user.isAdmin) {
        void logoutAccount(result.token).catch(() => undefined)
        setFeedback('Tài khoản này không có quyền truy cập trang quản trị.')
        return
      }
      storeAdminAuthToken(result.token)
      navigate('/admin', { replace: true })
    } catch (error) {
      setFeedback(getAdminLoginError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-standalone">
      <header className="topbar admin-topbar">
        <div className="brand">
          <span className="brand-mark"><Map size={19} strokeWidth={1.8} /></span>
          <span className="brand-name">Quảng Trị · Quản trị</span>
        </div>
        <div className="topbar-right">
          <NavLink to="/explore" className="device-picker-link">
            <ArrowLeft size={14} />
            <span>Trang người dùng</span>
          </NavLink>
        </div>
      </header>

      <main className="main-content">
        <section className="user-page">
          <div className="user-card auth-card">
            <div className="auth-heading">
              <span className="user-avatar-large"><Shield size={22} /></span>
              <span className="user-eyebrow">CỔNG QUẢN TRỊ HỆ THỐNG</span>
              <h1>Đăng nhập Quản trị</h1>
              <p>Chỉ dành cho tài khoản đã được cấp quyền quản trị viên.</p>
            </div>
            <div className="auth-divider"><span>xác thực quản trị</span></div>
            <form className="user-form" onSubmit={(event) => { void onSubmit(event) }}>
              <label>Email quản trị
                <span className="input-with-icon">
                  <Mail size={16} />
                  <input name="email" type="email" required maxLength={254} autoComplete="username" placeholder="admin@example.com" />
                </span>
              </label>
              <label>Mật khẩu
                <span className="input-with-icon">
                  <KeyRound size={16} />
                  <input name="password" type="password" required minLength={8} autoComplete="current-password" placeholder="Nhập mật khẩu quản trị" />
                </span>
              </label>
              {feedback && <p className="user-feedback" role="alert">{feedback}</p>}
              <button className="user-submit" type="submit" disabled={submitting}>
                {submitting ? 'Đang xác thực…' : 'Đăng nhập quản trị'}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  )
}

function getAdminLoginError(error: unknown) {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return 'Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng và thử lại.'
  }
  const status = error.status
  if (status === 401) return 'Email hoặc mật khẩu quản trị không chính xác.'
  if (status === 0) return 'Không kết nối được máy chủ. Hãy kiểm tra backend và thử lại.'
  return 'Không thể xác thực tài khoản quản trị. Vui lòng thử lại.'
}
