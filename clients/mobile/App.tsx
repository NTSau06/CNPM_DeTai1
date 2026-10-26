// Màn hình chính React Native cho khám phá bản đồ, GPS và thuyết minh.
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import * as Location from 'expo-location'
import * as Speech from 'expo-speech'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PlaceInfoCard } from './PlaceInfo'
import { recordNearbyVisit } from './analytics'

type Language = 'vi' | 'en' | 'ja' | 'fr' | 'zh-CN' | 'ko-KR' | 'es'
type Category = 'landmark' | 'food' | 'craft' | 'rest'
type Copy = { title: string; subtitle: string; narration: string }
type Place = {
  id: string
  category: Category
  coordinates: [number, number]
  duration: number
  image: string
  copy: Record<Language, Copy>
}
type Tour = {
  id: string
  placeIds: string[]
  createdAt: number
  distanceKm: number
  durationMinutes: number
}
type Collection<T> = { items: T[]; total: number }

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const PLACES_KEY = 'quang-tri:places:v1'
const AUTH_KEY = 'quang-tri:auth-token:v1'
const TOURS_KEY = 'quang-tri:tours:v2'
const RETIRED_PLACE_IDS = new Set(['truong-son-cemetery'])
const locales: Language[] = ['vi', 'en', 'ja', 'fr', 'zh-CN', 'ko-KR', 'es']
const languages: { code: Language; label: string }[] = [
  { code: 'vi', label: 'VI' },
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日本語' },
  { code: 'fr', label: 'FR' },
  { code: 'zh-CN', label: '中文' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'es', label: 'ES' },
]
const speechLocales: Record<Language, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  ja: 'ja-JP',
  fr: 'fr-FR',
  'zh-CN': 'zh-CN',
  'ko-KR': 'ko-KR',
  es: 'es-ES',
}
const words: Record<Language, Record<string, string>> = {
  vi: { kicker: 'ĐI CHẬM, NGHE MIỀN ĐẤT KỂ', intro: 'Một hành trình nhỏ qua miền di sản và biển xanh.', search: 'Tìm danh lam, hang động…', places: 'Điểm dừng chân', listen: 'Nghe câu chuyện', stop: 'Dừng nghe', add: 'Thêm vào hành trình', added: 'Đã thêm', walk: 'Bắt đầu thuyết minh tự động', walking: 'Đang tự động kể chuyện', save: 'Lưu hành trình', saved: 'Hành trình đã lưu', empty: 'Chọn một vài điểm để bắt đầu chuyến đi.', offline: 'Đang dùng dữ liệu đã lưu trên thiết bị.', loading: 'Đang tải điểm đến…', error: 'Không kết nối được máy chủ; đang thử dùng nội dung đã lưu.' },
  en: { kicker: 'SLOW DOWN AND LISTEN', intro: 'A quiet journey through heritage and open shores.', search: 'Find a landmark or cave…', places: 'Places to pause', listen: 'Listen to the story', stop: 'Stop listening', add: 'Add to my walk', added: 'Added', walk: 'Start automatic guide', walking: 'Automatic guide is on', save: 'Save this walk', saved: 'Walk saved', empty: 'Choose a few stops to begin your walk.', offline: 'Using places saved on this device.', loading: 'Loading places…', error: 'Could not connect; showing saved places.' },
  ja: { kicker: 'ゆっくり歩いて、土地の物語を', intro: '歴史と海辺をめぐる小さな旅。', search: '史跡や洞窟を探す…', places: '立ち寄りスポット', listen: '物語を聞く', stop: '停止', add: '散歩に追加', added: '追加済み', walk: '自動案内を開始', walking: '自動案内中', save: '散歩を保存', saved: '散歩を保存しました', empty: '場所を選んで散歩を始めましょう。', offline: '端末に保存した場所を表示しています。', loading: '場所を読み込み中…', error: '接続できません。保存済みの場所を表示します。' },
  fr: { kicker: 'PRENEZ LE TEMPS D’ÉCOUTER', intro: 'Une escapade entre patrimoine et grands espaces.', search: 'Un site ou une grotte…', places: 'Haltes à découvrir', listen: 'Écouter le récit', stop: 'Arrêter', add: 'Ajouter à ma balade', added: 'Ajouté', walk: 'Activer le guide automatique', walking: 'Guide automatique activé', save: 'Enregistrer cette balade', saved: 'Balade enregistrée', empty: 'Choisissez quelques haltes pour commencer.', offline: 'Lieux enregistrés sur cet appareil.', loading: 'Chargement des lieux…', error: 'Connexion impossible ; affichage des lieux enregistrés.' },
  'zh-CN': { kicker: '慢慢走，听土地讲故事', intro: '一段穿越遗产与海岸的悠闲旅程。', search: '搜索古迹或洞穴…', places: '附近景点', listen: '听景点介绍', stop: '停止播放', add: '加入行程', added: '已加入', walk: '开启自动讲解', walking: '自动讲解已开启', save: '保存行程', saved: '行程已保存', empty: '选择几个地点，开始规划行程。', offline: '正在使用保存在设备上的地点。', loading: '正在加载景点…', error: '无法连接服务器，正在显示已保存的景点。' },
  'ko-KR': { kicker: '천천히 걸으며 이야기를 들어요', intro: '유산과 푸른 바다를 만나는 작은 여행.', search: '유적지와 동굴 찾기…', places: '들러 볼 장소', listen: '이야기 듣기', stop: '재생 중지', add: '산책에 추가', added: '추가됨', walk: '자동 안내 시작', walking: '자동 안내 중', save: '산책 저장', saved: '산책을 저장했습니다', empty: '장소를 골라 여행을 시작해 보세요.', offline: '기기에 저장된 장소를 사용하고 있습니다.', loading: '장소 불러오는 중…', error: '서버에 연결할 수 없어 저장된 장소를 표시합니다.' },
  es: { kicker: 'CAMINA DESPACIO Y ESCUCHA', intro: 'Un viaje tranquilo entre patrimonio y costa.', search: 'Busca un monumento o una cueva…', places: 'Lugares para descubrir', listen: 'Escuchar la historia', stop: 'Detener', add: 'Añadir a mi ruta', added: 'Añadido', walk: 'Activar guía automática', walking: 'Guía automática activada', save: 'Guardar este paseo', saved: 'Paseo guardado', empty: 'Elige algunas paradas para empezar.', offline: 'Usando los lugares guardados en este dispositivo.', loading: 'Cargando lugares…', error: 'Sin conexión; se muestran los lugares guardados.' },
}

async function api<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Backend connection failed.')
  }
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Request failed (${response.status}): ${detail}`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function tourStorageKey(userId: string) {
  return `${TOURS_KEY}:${userId}`
}

function draftTourStorageKey(userId: string) {
  return `quang-tri:draft-tour:${userId}`
}

function distanceMeters(
  first: [number, number],
  second: [number, number],
): number {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDelta = radians(second[1] - first[1])
  const longitudeDelta = radians(second[0] - first[0])
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first[1])) * Math.cos(radians(second[1]))
    * Math.sin(longitudeDelta / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

export default function App() {
  const [language, setLanguage] = useState<Language>('vi')
  const [places, setPlaces] = useState<Place[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [routeIds, setRouteIds] = useState<string[]>([])
  const [activeRouteTourId, setActiveRouteTourId] = useState<string | null>(null)
  const [routeSaving, setRouteSaving] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [account, setAccount] = useState<{ id: string; fullName: string; email: string } | null>(null)
  const [authVisible, setAuthVisible] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [pendingPlaceId, setPendingPlaceId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')
  const [walking, setWalking] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [offlineGuideSaved, setOfflineGuideSaved] = useState(false)
  const [vietnamHour, setVietnamHour] = useState(getVietnamHour)
  const watcher = useRef<Location.LocationSubscription | null>(null)
  const routeSavingRef = useRef(false)
  const spokenPlaces = useRef(new Set<string>())
  const recordedVisits = useRef(new Set<string>())
  const languageRef = useRef(language)
  const playPlaceRef = useRef<((place: Place) => Promise<void>) | null>(null)
  languageRef.current = language
  const currentLanguage = words[language]

  const filteredPlaces = useMemo(() => {
    const value = query.trim().toLocaleLowerCase()
    return places.filter((place) => {
      const copy = place.copy[language] ?? place.copy.vi
      return !value || copy.title.toLocaleLowerCase().includes(value)
        || place.copy.vi.title.toLocaleLowerCase().includes(value)
    })
  }, [language, places, query])
  const selectedPlace = places.find((place) => place.id === selectedId) ?? filteredPlaces[0]

  useEffect(() => {
    let active = true
    setOfflineGuideSaved(false)
    if (!selectedPlace) return
    void AsyncStorage.getItem(`quang-tri:offline-guide:${selectedPlace.id}:${language}`)
      .then((saved) => { if (active) setOfflineGuideSaved(Boolean(saved)) })
      .catch(() => { if (active) setMessage(words[languageRef.current].error) })
    return () => { active = false }
  }, [language, selectedPlace?.id])

  useEffect(() => {
    const timer = setInterval(() => setVietnamHour(getVietnamHour()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const refreshPlaces = useCallback(async () => {
    setBusy(true)
    try {
      const cached = await AsyncStorage.getItem(PLACES_KEY)
      if (cached) {
        const cachedPlaces = JSON.parse(cached) as Place[]
        setPlaces(cachedPlaces.filter((place) => !RETIRED_PLACE_IDS.has(place.id)))
      }
      const result = await api<Collection<Place>>('/places')
      const activePlaces = result.items.filter((place) => !RETIRED_PLACE_IDS.has(place.id))
      setPlaces(activePlaces)
      await AsyncStorage.setItem(PLACES_KEY, JSON.stringify(activePlaces))
      setMessage('')
    } catch {
      setMessage(currentLanguage.error)
    } finally {
      setBusy(false)
    }
  }, [currentLanguage.error])

  useEffect(() => {
    void refreshPlaces()
    let active = true
    void AsyncStorage.getItem(AUTH_KEY).then(async (token) => {
      if (!token) return
      try {
        const user = await api<{ id: string; fullName: string; email: string }>('/auth/me', undefined, token)
        const result = await api<Collection<Tour>>('/tours', undefined, token)
        if (!active) return
        const draftId = await AsyncStorage.getItem(draftTourStorageKey(user.id))
        const activeDraft = result.items.find((tour) => tour.id === draftId)
        setAuthToken(token)
        setAccount(user)
        setTours(result.items)
        setActiveRouteTourId(activeDraft?.id ?? null)
        setRouteIds(activeDraft?.placeIds ?? [])
        await AsyncStorage.setItem(tourStorageKey(user.id), JSON.stringify(result.items))
      } catch (error) {
        if (!active) return
        if (error instanceof Error && error.message.includes('(401)')) {
          await AsyncStorage.removeItem(AUTH_KEY)
          setAuthToken(null)
          setAccount(null)
          setTours([])
          setActiveRouteTourId(null)
          setRouteIds([])
        }
        setMessage(words[languageRef.current].error)
      }
    }).catch(() => setMessage(words[languageRef.current].error))
    return () => {
      active = false
      watcher.current?.remove()
      Speech.stop()
    }
  }, [refreshPlaces])

  const playPlace = useCallback(async (place: Place) => {
    const fallback = place.copy[language] ?? place.copy.vi
    let text = fallback.narration
    let voice = speechLocales[language]
    try {
      const offlineGuide = await AsyncStorage.getItem(`quang-tri:offline-guide:${place.id}:${language}`)
      if (offlineGuide) {
        const cached = JSON.parse(offlineGuide) as { narration?: unknown }
        if (typeof cached.narration !== 'string' || !cached.narration.trim()) {
          throw new Error('Saved narration is invalid.')
        }
        text = cached.narration
      } else {
        const narration = await api<{ text: string; speechLocale: string }>(
          `/narrations/${encodeURIComponent(place.id)}?locale=${encodeURIComponent(language)}`,
        )
        text = narration.text
        voice = narration.speechLocale
      }
    } catch {
      setMessage(currentLanguage.offline)
    }
    Speech.stop()
    Speech.speak(text, {
      language: voice,
      rate: 0.92,
      onDone: () => setPlaying(false),
      onStopped: () => setPlaying(false),
      onError: () => {
        setPlaying(false)
        setMessage(currentLanguage.error)
      },
    })
    setSelectedId(place.id)
    setPlaying(true)
  }, [currentLanguage.error, currentLanguage.offline, language])
  playPlaceRef.current = playPlace

  const stopWalk = useCallback(() => {
    watcher.current?.remove()
    watcher.current = null
    spokenPlaces.current.clear()
    Speech.stop()
    setPlaying(false)
    setWalking(false)
  }, [])

  const beginWalk = useCallback(async () => {
    if (!selectedPlace) return
    let granted = false
    try {
      granted = (await Location.requestForegroundPermissionsAsync()).granted
    } catch {
      setMessage(currentLanguage.error)
      return
    }
    if (!granted) {
      setMessage(currentLanguage.error)
      return
    }
    spokenPlaces.current.clear()
    spokenPlaces.current.add(selectedPlace.id)
    setWalking(true)
    await playPlace(selectedPlace)
    try {
      watcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 5000 },
        (position) => {
          const user: [number, number] = [position.coords.longitude, position.coords.latitude]
          const day = new Date().toISOString().slice(0, 10)
          for (const place of places) {
            if (distanceMeters(user, place.coordinates) > 85) continue
            const visitKey = `${day}:${place.id}`
            if (recordedVisits.current.has(visitKey)) continue
            recordedVisits.current.add(visitKey)
            void recordNearbyVisit(place.id, user).catch(() => {
              recordedVisits.current.delete(visitKey)
              setMessage('Không ghi nhận được lượt ghé. Kiểm tra kết nối máy chủ.')
            })
          }
          const nearby = places.find((place) =>
            !spokenPlaces.current.has(place.id)
            && distanceMeters(user, place.coordinates) <= 85,
          )
          if (nearby) {
            spokenPlaces.current.add(nearby.id)
            void playPlaceRef.current?.(nearby)
          }
        },
      )
    } catch {
      stopWalk()
      setMessage(currentLanguage.error)
    }
  }, [currentLanguage.error, places, playPlace, selectedPlace, stopWalk])

  const startWalk = useCallback(async () => {
    if (walking) {
      stopWalk()
      return
    }
    Alert.alert(
      'Ghi nhận lượt ghé bằng GPS',
      'Khi bật hướng dẫn, ứng dụng gửi vị trí gần điểm dừng để ghi nhận tối đa một lượt ghé ẩn danh cho mỗi thiết bị, mỗi điểm mỗi ngày.',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đồng ý', onPress: () => { void beginWalk() } },
      ],
    )
  }, [beginWalk, stopWalk, walking])

  const toggleRoute = (placeId: string) => {
    if (!account) {
      setPendingPlaceId(placeId)
      setAuthMode('login')
      setAuthVisible(true)
      return
    }
    const nextRouteIds = routeIds.includes(placeId)
      ? routeIds.filter((id) => id !== placeId)
      : [...routeIds, placeId]
    void persistRoute(nextRouteIds)
  }

  const persistRoute = async (
    nextRouteIds: string[],
    owner = account,
    token = authToken,
    existingTours = tours,
    draftId = activeRouteTourId,
  ) => {
    if (!owner || !token || routeSavingRef.current) return false
    routeSavingRef.current = true
    setRouteSaving(true)
    try {
      if (nextRouteIds.length === 0) {
        if (draftId) {
          await api<void>(`/tours/${encodeURIComponent(draftId)}`, { method: 'DELETE' }, token)
          const updated = existingTours.filter((tour) => tour.id !== draftId)
          setTours(updated)
          setActiveRouteTourId(null)
          setRouteIds([])
          await AsyncStorage.setItem(tourStorageKey(owner.id), JSON.stringify(updated))
          await AsyncStorage.removeItem(draftTourStorageKey(owner.id))
        }
        if (!draftId) setRouteIds([])
        setMessage(language === 'vi' ? 'Đã cập nhật hành trình đã lưu.' : 'Saved walk updated.')
        return true
      }
      const tour: Tour = {
        id: draftId ?? Crypto.randomUUID(),
        placeIds: nextRouteIds,
        createdAt: existingTours.find((item) => item.id === draftId)?.createdAt ?? Date.now(),
        distanceKm: nextRouteIds.slice(1).reduce((total, id, index) => {
          const first = places.find((place) => place.id === nextRouteIds[index])
          const second = places.find((place) => place.id === id)
          return first && second ? total + distanceMeters(first.coordinates, second.coordinates) / 1000 : total
        }, 0),
        durationMinutes: nextRouteIds.reduce((total, id) =>
          total + (places.find((place) => place.id === id)?.duration ?? 0), 0),
      }
      const saved = await api<Tour>('/tours', {
        method: 'POST',
        body: JSON.stringify({ id: tour.id, placeIds: tour.placeIds, createdAt: tour.createdAt }),
      }, token)
      const updated = [saved, ...existingTours.filter((item) => item.id !== saved.id)]
      setTours(updated)
      setRouteIds(nextRouteIds)
      setActiveRouteTourId(saved.id)
      await AsyncStorage.setItem(tourStorageKey(owner.id), JSON.stringify(updated))
      await AsyncStorage.setItem(draftTourStorageKey(owner.id), saved.id)
      setMessage(language === 'vi' ? 'Đã tự lưu vào hành trình của bạn.' : 'Automatically saved to your walk.')
      return true
    } catch {
      setMessage(currentLanguage.offline)
      return false
    } finally {
      routeSavingRef.current = false
      setRouteSaving(false)
    }
  }

  const authenticate = async () => {
    setAuthError('')
    if (authMode === 'register' && !authName.trim()) {
      setAuthError(language === 'vi' ? 'Vui lòng nhập họ và tên.' : 'Enter your name.')
      return
    }
    if (authPassword.length < 8) {
      setAuthError(language === 'vi' ? 'Mật khẩu cần có ít nhất 8 ký tự.' : 'Password must be at least 8 characters.')
      return
    }
    if (authMode === 'register' && authPassword !== authConfirmPassword) {
      setAuthError(language === 'vi' ? 'Mật khẩu xác nhận chưa khớp.' : 'Passwords do not match.')
      return
    }
    setAuthBusy(true)
    try {
      const result = await api<{
        token: string
        user: { id: string; fullName: string; email: string }
      }>(`/auth/${authMode}`, {
        method: 'POST',
        body: JSON.stringify({
          ...(authMode === 'register' ? { fullName: authName.trim() } : {}),
          email: authEmail.trim().toLowerCase(),
          password: authPassword,
        }),
      })
      const tourResult = await api<Collection<Tour>>('/tours', undefined, result.token)
      setAuthToken(result.token)
      setAccount(result.user)
      setTours(tourResult.items)
      await AsyncStorage.setItem(AUTH_KEY, result.token)
      await AsyncStorage.setItem(tourStorageKey(result.user.id), JSON.stringify(tourResult.items))
      const draftId = await AsyncStorage.getItem(draftTourStorageKey(result.user.id))
      const activeDraft = tourResult.items.find((tour) => tour.id === draftId)
      setActiveRouteTourId(activeDraft?.id ?? null)
      setRouteIds(activeDraft?.placeIds ?? [])
      if (pendingPlaceId) {
        const nextRouteIds = (activeDraft?.placeIds ?? []).includes(pendingPlaceId)
          ? activeDraft?.placeIds ?? []
          : [...(activeDraft?.placeIds ?? []), pendingPlaceId]
        await persistRoute(nextRouteIds, result.user, result.token, tourResult.items, activeDraft?.id ?? null)
      }
      setPendingPlaceId(null)
      setAuthVisible(false)
      setAuthPassword('')
      setAuthConfirmPassword('')
      setMessage('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : currentLanguage.error)
    } finally {
      setAuthBusy(false)
    }
  }

  const signOut = async () => {
    const token = authToken
    setAuthToken(null)
    setAccount(null)
    setTours([])
    setRouteIds([])
    setActiveRouteTourId(null)
    try {
      await AsyncStorage.removeItem(AUTH_KEY)
      if (token) await api<void>('/auth/logout', { method: 'POST' }, token)
    } catch {
      setMessage(currentLanguage.error)
    }
  }

  const deleteTour = async (id: string) => {
    if (!account || !authToken) return
    const updated = tours.filter((tour) => tour.id !== id)
    try {
      await api<void>(`/tours/${encodeURIComponent(id)}`, { method: 'DELETE' }, authToken)
      setTours(updated)
      if (activeRouteTourId === id) {
        setActiveRouteTourId(null)
        setRouteIds([])
        await AsyncStorage.removeItem(draftTourStorageKey(account.id))
      }
      await AsyncStorage.setItem(tourStorageKey(account.id), JSON.stringify(updated))
    } catch {
      setMessage(currentLanguage.error)
    }
  }

  const saveOfflineGuide = async () => {
    if (!selectedPlace) return
    const key = `quang-tri:offline-guide:${selectedPlace.id}:${language}`
    if (offlineGuideSaved) {
      try {
        await AsyncStorage.removeItem(key)
        setOfflineGuideSaved(false)
        setMessage(language === 'vi' ? 'Đã gỡ lời thuyết minh ngoại tuyến.' : 'Offline narration removed.')
      } catch {
        setMessage(currentLanguage.error)
      }
      return
    }
    const copy = selectedPlace.copy[language] ?? selectedPlace.copy.vi
    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({ placeId: selectedPlace.id, language, ...copy, savedAt: Date.now() }),
      )
      setOfflineGuideSaved(true)
      setMessage(language === 'vi' ? 'Đã lưu lời thuyết minh để dùng ngoại tuyến.' : 'Narration saved for offline use.')
    } catch {
      setMessage(currentLanguage.error)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.topbar}>
          <Text style={styles.brand}>QUẢNG TRỊ</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (account) {
                Alert.alert(
                  language === 'vi' ? 'Tài khoản' : 'Account',
                  account.fullName,
                  [
                    { text: language === 'vi' ? 'Hủy' : 'Cancel', style: 'cancel' },
                    { text: language === 'vi' ? 'Đăng xuất' : 'Sign out', onPress: () => { void signOut() } },
                  ],
                )
              } else {
                setAuthMode('login')
                setAuthVisible(true)
              }
            }}
            style={styles.accountButton}
          >
            <Text style={styles.accountButtonText}>
              {account ? account.fullName : language === 'vi' ? 'Đăng nhập' : 'Sign in'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{currentLanguage.kicker}</Text>
          <Text style={styles.heroTitle}>Quảng Trị</Text>
          <Text style={styles.heroBody}>{currentLanguage.intro}</Text>
          <View style={styles.regionPill}><Text style={styles.regionText}>QUẢNG TRỊ · QUẢNG BÌNH</Text></View>
          <View style={styles.landscape}><View style={styles.sun} /><View style={styles.hillBack} /><View style={styles.hillFront} /></View>
        </View>

        <View style={styles.languageRow} accessibilityLabel="Narration language">
          {languages.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: language === item.code }}
              key={item.code}
              onPress={() => setLanguage(item.code)}
              style={[styles.languageChip, language === item.code && styles.languageChipActive]}
            >
              <Text style={[styles.languageText, language === item.code && styles.languageTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel={currentLanguage.search}
            onChangeText={setQuery}
            placeholder={currentLanguage.search}
            placeholderTextColor="#7D897F"
            style={styles.searchInput}
            value={query}
          />
        </View>

        <View style={styles.sectionHeading}>
          <View><Text style={styles.eyebrowDark}>YOUR LITTLE GUIDE</Text><Text style={styles.sectionTitle}>{currentLanguage.places}</Text></View>
          <Text style={styles.count}>{filteredPlaces.length.toString().padStart(2, '0')}</Text>
        </View>

        {busy && places.length === 0 ? (
          <View style={styles.loading}><ActivityIndicator color="#28483A" /><Text style={styles.bodyText}>{currentLanguage.loading}</Text></View>
        ) : filteredPlaces.length === 0 ? (
          <Text style={styles.emptySearch}>{currentLanguage.empty}</Text>
        ) : filteredPlaces.map((place, index) => {
          const copy = place.copy[language] ?? place.copy.vi
          const inRoute = routeIds.includes(place.id)
          const active = selectedPlace?.id === place.id
          return (
            <Pressable key={place.id} onPress={() => setSelectedId(place.id)} style={[styles.placeCard, active && styles.placeCardActive]}>
              <View style={[styles.placeNumber, active && styles.placeNumberActive]}><Text style={[styles.placeNumberText, active && styles.placeNumberTextActive]}>{String(index + 1).padStart(2, '0')}</Text></View>
              <View style={styles.placeCopy}>
                <Text style={styles.placeTitle}>{copy.title}</Text>
                <Text style={styles.placeSubtitle}>{copy.subtitle}</Text>
                <Text style={styles.placeMeta}>{place.duration} min · {place.category.toUpperCase()}</Text>
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" onPress={() => playing && active ? (Speech.stop(), setPlaying(false)) : void playPlace(place)} style={styles.listenButton}>
                    <Text style={styles.listenButtonText}>{playing && active ? `■ ${currentLanguage.stop}` : `▶ ${currentLanguage.listen}`}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={routeSaving} onPress={() => toggleRoute(place.id)} style={styles.addButton}>
                    <Text style={styles.addButtonText}>{inRoute ? `✓ ${currentLanguage.added}` : `+ ${currentLanguage.add}`}</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          )
        })}

        {selectedPlace && <PlaceInfoCard key={selectedPlace.id} placeId={selectedPlace.id} placeTitle={selectedPlace.copy[language]?.title ?? selectedPlace.copy.vi.title} />}

        {selectedPlace && (
          <View style={styles.experienceCard}>
            <Text style={styles.experienceTitle}>{language === 'vi' ? 'Thuyết minh ngoại tuyến' : 'Offline narration'}</Text>
            <Text style={styles.experienceHint}>{language === 'vi'
              ? 'Lưu lời đọc để nghe khi mất mạng. Giọng đọc dùng TTS đã cài trên thiết bị, không phải tệp MP3.'
              : 'Save narration for offline listening. Speech uses a voice installed on your device, not an MP3 file.'}</Text>
            <Pressable accessibilityRole="button" onPress={() => void saveOfflineGuide()} style={styles.experienceSecondaryButton}>
              <Text style={styles.experienceSecondaryText}>{offlineGuideSaved ? (language === 'vi' ? 'Gỡ gói ngoại tuyến' : 'Remove offline package') : (language === 'vi' ? 'Lưu lời đọc ngoại tuyến' : 'Save offline narration')}</Text>
            </Pressable>
          </View>
        )}

        {selectedPlace?.id === 'quang-tri-citadel' && (
          <View style={styles.experienceCard}>
            <Text style={styles.experienceTitle}>{language === 'vi' ? 'Gợi ý ứng xử theo thời điểm' : 'Respectful visit suggestions'}</Text>
            <Text style={styles.ritualBody}>{vietnamHour < 11
              ? (language === 'vi' ? 'Buổi sáng: dành thời gian đọc thông tin tại di tích, đi nhẹ và giữ không gian yên tĩnh.' : 'Morning: read the site information, walk quietly, and keep the space peaceful.')
              : vietnamHour < 17
                ? (language === 'vi' ? 'Buổi chiều: tham quan theo lối quy định, tránh làm ảnh hưởng người đang tưởng niệm.' : 'Afternoon: follow marked paths and avoid disturbing people paying their respects.')
                : (language === 'vi' ? 'Buổi tối: nếu di tích còn mở cửa, giữ thái độ trang nghiêm và làm theo hướng dẫn tại chỗ.' : 'Evening: if the site is open, remain respectful and follow on-site guidance.')}</Text>
            <Text style={styles.experienceHint}>{language === 'vi'
              ? 'Đây là gợi ý chung, không phải lịch tổ chức nghi lễ. Hãy xác nhận giờ mở cửa và sự kiện với đơn vị quản lý.'
              : 'General etiquette only, not a ceremony schedule. Confirm opening hours and events with the site operator.'}</Text>
          </View>
        )}

        <View style={styles.walkCard}>
          <View style={styles.walkCopy}>
            <Text style={styles.walkTitle}>{walking ? currentLanguage.walking : currentLanguage.walk}</Text>
            <Text style={styles.walkSubtitle}>GPS · 85 m</Text>
          </View>
          <Switch accessibilityLabel={currentLanguage.walk} onValueChange={() => void startWalk()} value={walking} trackColor={{ false: '#CBD4C8', true: '#719078' }} thumbColor="#fffdf7" />
        </View>

        {routeIds.length > 0 && (
          <View style={styles.tourCard}>
            <Text style={styles.tourTitle}>{routeIds.length} {currentLanguage.places.toLocaleLowerCase()}</Text>
            <Text style={styles.tourSavedText}>{language === 'vi' ? 'Đã tự lưu vào hành trình đã lưu.' : 'Automatically saved to your saved walks.'}</Text>
          </View>
        )}

        {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}

        <View style={styles.savedHeading}>
          <Text style={styles.sectionTitle}>{currentLanguage.saved} · {tours.length}</Text>
        </View>
        {tours.map((tour) => (
          <View key={tour.id} style={styles.savedCard}>
            <Text style={styles.savedNames}>{tour.placeIds.map((id) => places.find((place) => place.id === id)?.copy[language]?.title ?? id).join(' · ')}</Text>
            <Text style={styles.placeMeta}>{tour.placeIds.length} stops · {tour.distanceKm.toFixed(1)} km</Text>
            <Pressable accessibilityRole="button" onPress={() => void deleteTour(tour.id)}><Text style={styles.removeText}>Remove</Text></Pressable>
          </View>
        ))}
        <Text style={styles.footer}>QUẢNG TRỊ · QUẢNG BÌNH{'\n'}A SMALL GUIDE TO SLOW TRAVEL</Text>
      </ScrollView>
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setAuthVisible(false)
          setPendingPlaceId(null)
        }}
        transparent
        visible={authVisible}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.authOverlay}
        >
          <View style={styles.authCard}>
            <View style={styles.authHeader}>
              <Text style={styles.authTitle}>
                {authMode === 'register'
                  ? language === 'vi' ? 'Tạo tài khoản' : 'Create account'
                  : language === 'vi' ? 'Đăng nhập để thêm hành trình' : 'Sign in to add a walk'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setAuthVisible(false)
                  setPendingPlaceId(null)
                }}
              >
                <Text style={styles.authClose}>×</Text>
              </Pressable>
            </View>
            {authMode === 'register' && (
              <TextInput
                autoComplete="name"
                autoCapitalize="words"
                onChangeText={setAuthName}
                placeholder={language === 'vi' ? 'Họ và tên' : 'Full name'}
                style={styles.authInput}
                value={authName}
              />
            )}
            <TextInput
              autoComplete="email"
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setAuthEmail}
              placeholder="Email"
              style={styles.authInput}
              value={authEmail}
            />
            <TextInput
              autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
              onChangeText={setAuthPassword}
              placeholder={language === 'vi' ? 'Mật khẩu (ít nhất 8 ký tự)' : 'Password (at least 8 characters)'}
              secureTextEntry
              style={styles.authInput}
              value={authPassword}
            />
            {authMode === 'register' && (
              <TextInput
                autoComplete="new-password"
                onChangeText={setAuthConfirmPassword}
                placeholder={language === 'vi' ? 'Xác nhận mật khẩu' : 'Confirm password'}
                secureTextEntry
                style={styles.authInput}
                value={authConfirmPassword}
              />
            )}
            {authError ? <Text accessibilityRole="alert" style={styles.authError}>{authError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={authBusy}
              onPress={() => void authenticate()}
              style={[styles.authSubmit, authBusy && styles.authSubmitDisabled]}
            >
              <Text style={styles.authSubmitText}>
                {authBusy
                  ? language === 'vi' ? 'Đang xử lý…' : 'Please wait…'
                  : authMode === 'register'
                    ? language === 'vi' ? 'Tạo tài khoản' : 'Create account'
                    : language === 'vi' ? 'Đăng nhập' : 'Sign in'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAuthMode((mode) => mode === 'login' ? 'register' : 'login')
                setAuthError('')
              }}
            >
              <Text style={styles.authSwitch}>
                {authMode === 'register'
                  ? language === 'vi' ? 'Đã có tài khoản? Đăng nhập' : 'Already registered? Sign in'
                  : language === 'vi' ? 'Chưa có tài khoản? Đăng ký' : 'New here? Create an account'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F0E6' },
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 48 },
  topbar: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#28483A', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  accountButton: { maxWidth: 190, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 99, backgroundColor: '#E6EDE3' },
  accountButtonText: { color: '#28483A', fontSize: 11, fontWeight: '800' },
  authOverlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#14231DB8' },
  authCard: { width: '100%', maxWidth: 460, alignSelf: 'center', padding: 22, borderRadius: 22, backgroundColor: '#FFFDF7' },
  authHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  authTitle: { flex: 1, color: '#28483A', fontSize: 19, fontWeight: '800' },
  authClose: { color: '#68776D', fontSize: 28, lineHeight: 30, paddingHorizontal: 6 },
  authInput: { height: 48, marginTop: 10, paddingHorizontal: 13, borderWidth: 1, borderColor: '#D7DED3', borderRadius: 12, color: '#24352D', backgroundColor: '#FFFFFF' },
  authError: { color: '#9B3F32', fontSize: 12, marginTop: 11 },
  authSubmit: { marginTop: 15, padding: 13, borderRadius: 12, alignItems: 'center', backgroundColor: '#28483A' },
  authSubmitDisabled: { opacity: 0.6 },
  authSubmitText: { color: '#FFFDF7', fontSize: 13, fontWeight: '800' },
  authSwitch: { marginTop: 16, textAlign: 'center', color: '#40584A', fontSize: 12, fontWeight: '700' },
  hero: { minHeight: 255, overflow: 'hidden', borderRadius: 26, backgroundColor: '#28483A', padding: 24, position: 'relative', justifyContent: 'flex-start' },
  eyebrow: { color: '#DDBA96', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  heroTitle: { color: '#FFFDF7', fontSize: 43, fontWeight: '800', letterSpacing: -1.5, marginTop: 15 },
  heroBody: { color: '#E1E8DD', fontSize: 14, lineHeight: 21, maxWidth: 265, marginTop: 6 },
  regionPill: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF20', borderRadius: 99, marginTop: 17, paddingHorizontal: 11, paddingVertical: 7 },
  regionText: { color: '#F3E9D8', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  landscape: { position: 'absolute', width: 180, height: 145, right: -12, bottom: -12 },
  sun: { position: 'absolute', width: 40, height: 40, backgroundColor: '#DDBA96', borderRadius: 20, right: 44, top: 12 },
  hillBack: { position: 'absolute', width: 180, height: 105, backgroundColor: '#667C60', borderTopLeftRadius: 100, borderTopRightRadius: 90, transform: [{ rotate: '-13deg' }], right: -20, bottom: -10 },
  hillFront: { position: 'absolute', width: 170, height: 88, backgroundColor: '#A9AA7E', borderTopLeftRadius: 90, borderTopRightRadius: 90, transform: [{ rotate: '12deg' }], right: 44, bottom: -35 },
  languageRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 5, marginTop: 18 },
  languageChip: { minWidth: 39, height: 36, paddingHorizontal: 8, borderRadius: 99, backgroundColor: '#FFFDF7', borderWidth: 1, borderColor: '#E3E0D5', alignItems: 'center', justifyContent: 'center' },
  languageChipActive: { backgroundColor: '#28483A', borderColor: '#28483A' },
  languageText: { color: '#506258', fontSize: 10, fontWeight: '800' },
  languageTextActive: { color: '#FFFDF7' },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginTop: 17, paddingHorizontal: 14, height: 48, borderRadius: 15, backgroundColor: '#FFFDF7', borderWidth: 1, borderColor: '#E3E0D5' },
  searchIcon: { fontSize: 24, color: '#68776D', marginRight: 8 },
  searchInput: { flex: 1, color: '#24352D', fontSize: 14 },
  sectionHeading: { marginTop: 26, marginBottom: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  eyebrowDark: { color: '#B96D4C', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  sectionTitle: { color: '#28483A', fontSize: 22, fontWeight: '800', marginTop: 3 },
  count: { color: '#B96D4C', fontSize: 18, fontWeight: '700' },
  placeCard: { flexDirection: 'row', marginBottom: 10, padding: 14, borderRadius: 18, backgroundColor: '#FFFDF7', borderWidth: 1, borderColor: '#E3E0D5' },
  placeCardActive: { borderColor: '#8BA18B', backgroundColor: '#FBFCF6' },
  placeNumber: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EDF0E7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  placeNumberActive: { backgroundColor: '#28483A' },
  placeNumberText: { color: '#68776D', fontSize: 11, fontWeight: '800' },
  placeNumberTextActive: { color: '#FFFDF7' },
  placeCopy: { flex: 1, minWidth: 0 },
  placeTitle: { color: '#24352D', fontSize: 16, fontWeight: '800' },
  placeSubtitle: { color: '#68776D', fontSize: 12, marginTop: 3 },
  placeMeta: { color: '#879187', fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 10, gap: 7 },
  listenButton: { backgroundColor: '#28483A', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  listenButtonText: { color: '#FFFDF7', fontSize: 10, fontWeight: '700' },
  addButton: { backgroundColor: '#EDF0E7', borderRadius: 99, paddingHorizontal: 11, paddingVertical: 8 },
  addButtonText: { color: '#40584A', fontSize: 10, fontWeight: '700' },
  walkCard: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#E6EDE3', borderRadius: 18 },
  walkCopy: { flex: 1, paddingRight: 12 },
  walkTitle: { color: '#28483A', fontSize: 14, fontWeight: '800' },
  walkSubtitle: { color: '#68776D', fontSize: 11, marginTop: 4 },
  tourCard: { marginTop: 12, padding: 17, borderRadius: 18, backgroundColor: '#F3E5D8' },
  tourTitle: { color: '#28483A', fontWeight: '800', fontSize: 14 },
  tourSavedText: { color: '#52685A', fontSize: 12, marginTop: 8 },
  saveButton: { marginTop: 11, padding: 12, borderRadius: 12, backgroundColor: '#28483A', alignItems: 'center' },
  saveButtonText: { color: '#FFFDF7', fontSize: 13, fontWeight: '800' },
  message: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#FFF4DC', color: '#765633', fontSize: 12 },
  savedHeading: { marginTop: 27, marginBottom: 9 },
  savedCard: { padding: 14, marginBottom: 8, borderRadius: 15, backgroundColor: '#FFFDF7', borderWidth: 1, borderColor: '#E3E0D5' },
  savedNames: { color: '#28483A', fontSize: 13, fontWeight: '700' },
  removeText: { color: '#A04F38', fontSize: 11, fontWeight: '700', marginTop: 8 },
  loading: { padding: 24, alignItems: 'center', gap: 10 },
  emptySearch: { padding: 18, color: '#68776D', textAlign: 'center', fontSize: 13 },
  bodyText: { color: '#68776D', fontSize: 12 },
  footer: { marginTop: 28, textAlign: 'center', color: '#8A9488', fontSize: 9, fontWeight: '700', letterSpacing: 1.2, lineHeight: 17 },
  experienceCard: { padding: 16, backgroundColor: '#FFFDF7', borderRadius: 18, borderWidth: 1, borderColor: '#E3E0D5', gap: 10, marginVertical: 7 },
  experienceTitle: { color: '#28483A', fontSize: 17, fontWeight: '800' },
  experienceHint: { color: '#7D897F', fontSize: 11, lineHeight: 16 },
  experienceSecondaryButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 99, backgroundColor: '#EDF0E7' },
  experienceSecondaryText: { color: '#40584A', fontSize: 11, fontWeight: '800' },
  ritualBody: { color: '#506258', fontSize: 13, lineHeight: 20 },
})

function getVietnamHour() {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date()))
}
