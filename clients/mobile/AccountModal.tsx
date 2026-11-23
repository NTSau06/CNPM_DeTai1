// Màn hình tài khoản trên di động: hồ sơ, đổi mật khẩu, vé đã đặt, xóa tài khoản, đăng xuất.
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  ApiError,
  cancelTicketOrder,
  changePassword,
  deleteOwnAccount,
  fetchMyTicketOrders,
  fetchProfile,
  formatVnd,
  isValidEmail,
  normalizeEmail,
  updateProfile,
  type TicketOrder,
  type UserProfile,
} from './src/api'
import { localeOf, mt, type Language } from './uiText'

const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function AccountModal({
  visible,
  language,
  token,
  placeTitle,
  onClose,
  onSignOut,
  onSessionReplaced,
  onProfileUpdated,
  onAccountDeleted,
}: {
  visible: boolean
  language: Language
  token: string | null
  placeTitle: (placeId: string) => string
  onClose: () => void
  onSignOut: () => void
  onSessionReplaced: (token: string) => void
  onProfileUpdated: (user: UserProfile) => void
  onAccountDeleted: () => void
}) {
  const locale = localeOf(language)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [orders, setOrders] = useState<TicketOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteMessage, setDeleteMessage] = useState('')
  const [ticketMessage, setTicketMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [user, myOrders] = await Promise.all([
        fetchProfile(token),
        fetchMyTicketOrders(token).catch(() => [] as TicketOrder[]),
      ])
      setProfile(user)
      setOrders(myOrders)
    } catch {
      setProfileMessage(mt(language, 'acSaveError'))
    } finally {
      setLoading(false)
    }
  }, [language, token])

  useEffect(() => {
    if (!visible) return
    setProfileMessage('')
    setPasswordMessage('')
    setDeleteMessage('')
    setTicketMessage('')
    setCurrentPassword('')
    setNewPassword('')
    setDeletePassword('')
    void load()
  }, [load, visible])

  const statusMessage = (error: unknown, fallback: Parameters<typeof mt>[1]) => {
    if (error instanceof ApiError && error.status === 429) return mt(language, 'acTooMany')
    return mt(language, fallback)
  }

  const saveProfile = async () => {
    if (!token || !profile) return
    const normalizedEmail = normalizeEmail(profile.email)
    if (!isValidEmail(normalizedEmail)) {
      setProfileMessage(mt(language, 'emailInvalid'))
      return
    }
    if (profile.birthDate && !BIRTH_DATE_PATTERN.test(profile.birthDate)) {
      setProfileMessage(mt(language, 'acBirthInvalid'))
      return
    }
    if (!profile.fullName.trim()) {
      setProfileMessage(mt(language, 'nameRequired'))
      return
    }
    setBusy(true)
    try {
      const updated = await updateProfile(token, {
        ...profile,
        fullName: profile.fullName.trim(),
        email: normalizedEmail,
      })
      setProfile(updated)
      onProfileUpdated(updated)
      setProfileMessage(mt(language, 'acSaved'))
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setProfileMessage(mt(language, 'emailTaken'))
      } else if (error instanceof ApiError && error.status === 422) {
        setProfileMessage(mt(language, 'emailInvalid'))
      } else {
        setProfileMessage(mt(language, 'acSaveError'))
      }
    } finally {
      setBusy(false)
    }
  }

  const submitPasswordChange = async () => {
    if (!token) return
    if (newPassword.length < 8) {
      setPasswordMessage(mt(language, 'pwShort'))
      return
    }
    setBusy(true)
    try {
      const result = await changePassword(token, currentPassword, newPassword)
      onSessionReplaced(result.token)
      setCurrentPassword('')
      setNewPassword('')
      setPasswordMessage(mt(language, 'acPwChanged'))
    } catch (error) {
      setPasswordMessage(error instanceof ApiError && error.status === 403
        ? mt(language, 'acPwWrong')
        : statusMessage(error, 'acPwError'))
    } finally {
      setBusy(false)
    }
  }

  const cancelOrder = (order: TicketOrder) => {
    if (!token) return
    Alert.alert(mt(language, 'tkCancel'), mt(language, 'tkCancelAsk', { n: order.quantity }), [
      { text: mt(language, 'acClose'), style: 'cancel' },
      {
        text: mt(language, 'tkCancel'),
        style: 'destructive',
        onPress: () => {
          void cancelTicketOrder(order.id, token)
            .then((updated) => {
              setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)))
              setTicketMessage('')
            })
            .catch(() => setTicketMessage(mt(language, 'tkCancelError')))
        },
      },
    ])
  }

  const confirmDelete = () => {
    if (!token) return
    Alert.alert(mt(language, 'acDelete'), mt(language, 'acDeleteAsk'), [
      { text: mt(language, 'acClose'), style: 'cancel' },
      {
        text: mt(language, 'acDelete'),
        style: 'destructive',
        onPress: () => {
          setBusy(true)
          void deleteOwnAccount(token, deletePassword)
            .then(() => onAccountDeleted())
            .catch((error: unknown) => {
              setDeleteMessage(error instanceof ApiError && error.status === 403
                ? mt(language, 'acPwWrong')
                : statusMessage(error, 'acDeleteError'))
            })
            .finally(() => setBusy(false))
        },
      },
    ])
  }

  const update = (field: keyof UserProfile, value: string) => {
    setProfile((current) => (current ? { ...current, [field]: value } : current))
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{mt(language, 'acTitle')}</Text>
            <Pressable accessibilityLabel={mt(language, 'acClose')} accessibilityRole="button" onPress={onClose}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>
          {loading || !profile ? (
            <ActivityIndicator color="#28483A" style={styles.loading} />
          ) : (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.section}>{mt(language, 'acProfile')}</Text>
              <Text style={styles.label}>Email</Text>
              <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" maxLength={254} onChangeText={(value) => update('email', value)} placeholder="Email" style={styles.input} value={profile.email} />
              <TextInput onChangeText={(value) => update('fullName', value)} placeholder={mt(language, 'fullName')} style={styles.input} value={profile.fullName} maxLength={80} />
              <TextInput keyboardType="phone-pad" onChangeText={(value) => update('phone', value)} placeholder={mt(language, 'acPhone')} style={styles.input} value={profile.phone} maxLength={20} />
              <TextInput onChangeText={(value) => update('birthDate', value)} placeholder={mt(language, 'acBirthDate')} style={styles.input} value={profile.birthDate} maxLength={10} />
              <TextInput onChangeText={(value) => update('address', value)} placeholder={mt(language, 'acAddress')} style={styles.input} value={profile.address} maxLength={160} />
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void saveProfile()} style={[styles.primary, busy && styles.disabled]}>
                <Text style={styles.primaryText}>{mt(language, 'acSave')}</Text>
              </Pressable>
              {profileMessage ? <Text style={styles.feedback}>{profileMessage}</Text> : null}

              <Text style={styles.section}>{mt(language, 'tkMine')}</Text>
              {orders.length === 0 ? <Text style={styles.help}>{mt(language, 'tkNone')}</Text> : orders.map((order) => {
                const status = order.status ?? 'paid'
                const cancelled = status === 'cancelled' || status === 'expired'
                return (
                  <View key={order.id} style={[styles.ticket, cancelled && styles.disabled]}>
                    <Text style={styles.ticketTitle}>{placeTitle(order.placeId)}</Text>
                    <Text style={styles.help}>
                      {order.ticketCode ?? order.id} · {order.quantity} × {formatVnd(order.unitPriceVnd, locale)} = {formatVnd(order.totalPriceVnd, locale)}
                    </Text>
                    <Text style={styles.help}>{new Date(order.createdAt).toLocaleString(locale)}</Text>
                    <Text style={styles.cancelled}>
                      {mt(language, status === 'pending' ? 'tkStatusPending' : status === 'paid' ? 'tkStatusPaid' : status === 'expired' ? 'tkStatusExpired' : 'tkCancelled')}
                    </Text>
                    {!cancelled && (
                      <Pressable accessibilityRole="button" onPress={() => cancelOrder(order)}>
                        <Text style={styles.danger}>{mt(language, 'tkCancel')}</Text>
                      </Pressable>
                    )}
                  </View>
                )
              })}
              {ticketMessage ? <Text style={styles.feedback}>{ticketMessage}</Text> : null}

              <Text style={styles.section}>{mt(language, 'acPassword')}</Text>
              <TextInput autoComplete="current-password" onChangeText={setCurrentPassword} placeholder={mt(language, 'acCurrentPw')} secureTextEntry style={styles.input} value={currentPassword} />
              <TextInput autoComplete="new-password" onChangeText={setNewPassword} placeholder={mt(language, 'acNewPw')} secureTextEntry style={styles.input} value={newPassword} />
              <Pressable accessibilityRole="button" disabled={busy || !currentPassword} onPress={() => void submitPasswordChange()} style={[styles.secondary, (busy || !currentPassword) && styles.disabled]}>
                <Text style={styles.secondaryText}>{mt(language, 'acPassword')}</Text>
              </Pressable>
              {passwordMessage ? <Text style={styles.feedback}>{passwordMessage}</Text> : null}

              <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.secondary}>
                <Text style={styles.secondaryText}>{mt(language, 'signOut')}</Text>
              </Pressable>

              {!profile.isAdmin && (
                <>
                  <Text style={styles.section}>{mt(language, 'acDelete')}</Text>
                  <Text style={styles.help}>{mt(language, 'acDeleteHint')}</Text>
                  <TextInput autoComplete="current-password" onChangeText={setDeletePassword} placeholder={mt(language, 'acCurrentPw')} secureTextEntry style={styles.input} value={deletePassword} />
                  <Pressable accessibilityRole="button" disabled={busy || deletePassword.length < 8} onPress={confirmDelete} style={[styles.dangerButton, (busy || deletePassword.length < 8) && styles.disabled]}>
                    <Text style={styles.primaryText}>{mt(language, 'acDelete')}</Text>
                  </Pressable>
                  {deleteMessage ? <Text style={styles.feedback}>{deleteMessage}</Text> : null}
                </>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#14231DB8' },
  sheet: { maxHeight: '92%', width: '100%', maxWidth: 560, alignSelf: 'center', borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#FFFDF7', paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 6 },
  title: { color: '#28483A', fontSize: 19, fontWeight: '800' },
  close: { color: '#68776D', fontSize: 28, lineHeight: 30, paddingHorizontal: 6 },
  loading: { padding: 32 },
  body: { paddingHorizontal: 20, paddingBottom: 36, gap: 8 },
  section: { marginTop: 14, color: '#28483A', fontSize: 15, fontWeight: '800' },
  label: { color: '#7D897F', fontSize: 11, fontWeight: '700' },
  input: { height: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: '#D7DED3', borderRadius: 12, color: '#24352D', backgroundColor: '#FFFFFF' },
  primary: { padding: 13, borderRadius: 12, alignItems: 'center', backgroundColor: '#28483A' },
  primaryText: { color: '#FFFDF7', fontSize: 13, fontWeight: '800' },
  secondary: { padding: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#EDF0E7' },
  secondaryText: { color: '#40584A', fontSize: 13, fontWeight: '800' },
  dangerButton: { padding: 13, borderRadius: 12, alignItems: 'center', backgroundColor: '#9B3F32' },
  disabled: { opacity: 0.55 },
  help: { color: '#7D897F', fontSize: 11, lineHeight: 16 },
  feedback: { color: '#8B4D3B', fontSize: 12, lineHeight: 17 },
  ticket: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E3E0D5', backgroundColor: '#FFFFFF', gap: 3 },
  ticketTitle: { color: '#28483A', fontSize: 13, fontWeight: '800' },
  danger: { color: '#A04F38', fontSize: 12, fontWeight: '800', marginTop: 4 },
  cancelled: { color: '#7D897F', fontSize: 12, fontWeight: '700', marginTop: 4 },
})
