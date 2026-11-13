// Đăng ký, đăng nhập và quản lý hồ sơ tài khoản.
import { useState, type FormEvent } from 'react'
import { Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, KeyRound, LogOut, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { changePassword, loginAccount, registerAccount } from '../api'
import { translate } from '../i18n'
import { useAppStore } from '../store'
import type { Language, UserProfile } from '../types'
import { ui } from '../uiText'

export function UserPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const language = useAppStore((state) => state.language)
  const currentUser = useAppStore((state) => state.currentUser)
  const authReady = useAppStore((state) => state.authReady)
  const signIn = useAppStore((state) => state.signIn)
  const updateCurrentUser = useAppStore((state) => state.updateCurrentUser)
  const signOut = useAppStore((state) => state.signOut)
  const setRoutePlace = useAppStore((state) => state.setRoutePlace)
  const isProfile = location.pathname === '/profile'
  const isRegister = location.pathname === '/register'
  const [feedback, setFeedback] = useState('')
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const replaceSession = useAppStore((state) => state.replaceSession)

  if (isProfile && !currentUser) return authReady ? <Navigate to="/login" replace /> : null
  if (!isProfile && currentUser) return <Navigate to="/profile" replace />

  const onSubmitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback('')
    const values = new FormData(event.currentTarget)
    const email = String(values.get('email') ?? '').trim().toLowerCase()
    const password = String(values.get('password') ?? '')
    if (password.length < 8) {
      setFeedback(ui(language, 'usPwShort'))
      return
    }

    if (isRegister && password !== values.get('confirmPassword')) {
      setFeedback(ui(language, 'usPwMismatch'))
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
        const returnTo = typeof navigationState?.returnTo === 'string'
          && navigationState.returnTo.startsWith('/')
          && !navigationState.returnTo.startsWith('//')
          ? navigationState.returnTo
          : '/profile'
        navigate(returnTo, { replace: true })
      }
    } catch (error) {
      setFeedback(getAuthErrorMessage(error, language))
    } finally {
      setSubmitting(false)
    }
  }

  const onSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentUser) return
    const values = new FormData(event.currentTarget)
    setProfileError('')
    try {
      await updateCurrentUser({
        ...currentUser,
        fullName: String(values.get('fullName') ?? '').trim(),
        phone: String(values.get('phone') ?? '').trim(),
        birthDate: String(values.get('birthDate') ?? ''),
        gender: values.get('gender') as UserProfile['gender'],
        address: String(values.get('address') ?? '').trim(),
      })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch {
      setProfileError(ui(language, 'usProfileSaveError'))
    }
  }

  const onChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const currentPassword = String(values.get('currentPassword') ?? '')
    const newPassword = String(values.get('newPassword') ?? '')
    if (newPassword.length < 8) {
      setPasswordMessage({ ok: false, text: ui(language, 'usNewPwShort') })
      return
    }
    if (newPassword !== values.get('confirmNewPassword')) {
      setPasswordMessage({ ok: false, text: ui(language, 'usPwMismatch') })
      return
    }
    const token = useAppStore.getState().authToken
    if (!token) return
    try {
      const result = await changePassword(token, currentPassword, newPassword)
      replaceSession(result.token)
      form.reset()
      setPasswordMessage({ ok: true, text: ui(language, 'usPwChanged') })
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined
      setPasswordMessage({
        ok: false,
        text: status === 403 ? ui(language, 'usPwWrong')
          : status === 422 ? ui(language, 'usPwSame')
          : ui(language, 'usPwChangeFailed'),
      })
    }
  }

  if (isProfile && currentUser) {
    return (
      <section className="user-page">
        <NavLink to="/explore" className="user-back"><ArrowLeft size={15} /> {ui(language, 'backToExplore')}</NavLink>
        <div className="user-card profile-card">
          <div className="user-page-heading">
            <span className="user-avatar-large">{getInitials(currentUser.fullName)}</span>
            <div>
              <span className="user-eyebrow">{ui(language, 'usAccountEyebrow')}</span>
              <h1>{ui(language, 'usProfileTitle')}</h1>
              <p>{ui(language, 'usProfileIntro')}</p>
            </div>
            <button className="signout-button" onClick={() => { void signOut().then(() => navigate('/login', { replace: true })) }}>
              <LogOut size={15} /> {ui(language, 'usSignOut')}
            </button>
          </div>
          <form className="user-form profile-form" onSubmit={(event) => { void onSaveProfile(event) }}>
            <label>{ui(language, 'usFullName')}
              <span className="input-with-icon"><UserRound size={16} /><input name="fullName" required maxLength={80} defaultValue={currentUser.fullName} autoComplete="name" /></span>
            </label>
            <label>{ui(language, 'usEmail')}
              <span className="input-with-icon"><Mail size={16} /><input type="email" value={currentUser.email} readOnly /></span>
            </label>
            <label>{ui(language, 'usPhone')}
              <span className="input-with-icon"><Phone size={16} /><input name="phone" type="tel" maxLength={20} defaultValue={currentUser.phone} autoComplete="tel" /></span>
            </label>
            <label>{ui(language, 'usBirthDate')}
              <input name="birthDate" type="date" defaultValue={currentUser.birthDate} />
            </label>
            <label>{ui(language, 'usGender')}
              <select name="gender" defaultValue={currentUser.gender}>
                <option value="">{ui(language, 'usGenderChoose')}</option>
                <option value="female">{ui(language, 'usFemale')}</option>
                <option value="male">{ui(language, 'usMale')}</option>
                <option value="other">{ui(language, 'usOther')}</option>
                <option value="prefer-not-to-say">{ui(language, 'usNoAnswer')}</option>
              </select>
            </label>
            <label className="profile-address">{ui(language, 'usAddress')}
              <span className="input-with-icon"><MapPin size={16} /><input name="address" maxLength={160} defaultValue={currentUser.address} autoComplete="street-address" placeholder={ui(language, 'usAddressPh')} /></span>
            </label>
            <div className="profile-actions">
              {saved && <span className="profile-saved" role="status"><Check size={15} /> {ui(language, 'usSaved')}</span>}
              <button className="user-submit" type="submit">{ui(language, 'usSave')}</button>
            </div>
            {profileError && <p className="user-feedback" role="alert">{profileError}</p>}
          </form>
          <form className="user-form profile-form" onSubmit={(event) => { void onChangePassword(event) }}>
            <h2 className="profile-address"><KeyRound size={16} /> {ui(language, 'usChangePw')}</h2>
            <label>{ui(language, 'usCurrentPw')}
              <input name="currentPassword" type="password" required minLength={8} autoComplete="current-password" />
            </label>
            <label>{ui(language, 'usNewPw')}
              <input name="newPassword" type="password" required minLength={8} autoComplete="new-password" placeholder={ui(language, 'usMin8')} />
            </label>
            <label>{ui(language, 'usConfirmNewPw')}
              <input name="confirmNewPassword" type="password" required minLength={8} autoComplete="new-password" />
            </label>
            <div className="profile-actions">
              {passwordMessage && <p className="user-feedback" role="status">{passwordMessage.text}</p>}
              <button className="user-submit" type="submit">{ui(language, 'usChangePw')}</button>
            </div>
          </form>
        </div>
      </section>
    )
  }

  return (
    <section className="user-page">
      <NavLink to="/explore" className="user-back"><ArrowLeft size={15} /> {ui(language, 'backToExplore')}</NavLink>
      <div className="user-card auth-card">
        <div className="auth-heading">
          <span className="user-avatar-large"><UserRound size={24} /></span>
          <span className="user-eyebrow">{ui(language, 'regionName').toLocaleUpperCase(language)}</span>
          <h1>{ui(language, isRegister ? 'usRegisterTitle' : 'usLoginTitle')}</h1>
          <p>{ui(language, isRegister ? 'usRegisterIntro' : 'usLoginIntro')}</p>
        </div>
        <div className="auth-divider"><span>{ui(language, 'usByEmail')}</span></div>
        <form className="user-form" onSubmit={onSubmitAuth}>
          {isRegister && (
            <>
              <label>{ui(language, 'usFullName')}
                <span className="input-with-icon"><UserRound size={16} /><input name="fullName" required maxLength={80} autoComplete="name" placeholder={ui(language, 'usNamePh')} /></span>
              </label>
              <label>{ui(language, 'usPhone')} <small>{ui(language, 'usOptional')}</small>
                <span className="input-with-icon"><Phone size={16} /><input name="phone" type="tel" maxLength={20} autoComplete="tel" placeholder="+84" /></span>
              </label>
            </>
          )}
          <label>{ui(language, 'usEmail')}
            <span className="input-with-icon"><Mail size={16} /><input name="email" type="email" required maxLength={254} autoComplete="email" placeholder={ui(language, 'usEmailPh')} /></span>
          </label>
          <label>{ui(language, 'usPassword')}
            <input name="password" type="password" required minLength={8} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={ui(language, 'usMin8')} />
          </label>
          {isRegister && <label>{ui(language, 'usConfirmPw')}
            <input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" placeholder={ui(language, 'usRetypePw')} />
          </label>}
          {feedback && <p className="user-feedback" role="status">{feedback}</p>}
          <button className="user-submit" type="submit" disabled={submitting}>
            {submitting ? ui(language, 'usProcessing') : ui(language, isRegister ? 'usRegisterTitle' : 'signIn')}
          </button>
        </form>
        <p className="auth-switch">
          {ui(language, isRegister ? 'usHaveAccount' : 'usNoAccount')}{' '}
          <NavLink to={isRegister ? '/login' : '/register'} state={location.state}>
            {ui(language, isRegister ? 'signIn' : 'usRegister')}
          </NavLink>
        </p>
      </div>
    </section>
  )
}

function getAuthErrorMessage(error: unknown, language: Language) {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return translate(language, 'apiNetworkError')
  }
  const status = error.status
  if (status === 401) return ui(language, 'usErr401')
  if (status === 409) return ui(language, 'usErr409')
  if (status === 422) return ui(language, 'usErr422')
  if (status === 404) return ui(language, 'usErr404')
  if (status === 0) return translate(language, 'apiNetworkError')
  return ui(language, 'usErrAuth')
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}
