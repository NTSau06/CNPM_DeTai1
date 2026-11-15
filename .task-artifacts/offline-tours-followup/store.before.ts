// Quản lý trạng thái chung và khởi tạo/đồng bộ dữ liệu với IndexedDB, backend.
import { create } from 'zustand'
import { cachePlaces, replaceCachedPlaces, replaceUserTours, getSavedTours, deleteSetting, deleteOfflineMap, deleteTour, getCachedPlaces, getOfflineMap, readSetting, saveOfflineMap, saveTour, writeSetting } from './db'
import { BackendApiError, createTour, deleteRemoteTour, fetchCurrentUser, fetchPlaces, fetchTours, generateId, getStoredAuthToken, logoutAccount, mergeRemotePlaces, storeAuthToken, updateProfile } from './api'
import { languages, places as bundledPlaces } from './data/places'
import type { Language, OfflineMapPack, Place, SavedTour, UserProfile } from './types'

const placeOrder = new Map(bundledPlaces.map((place, index) => [place.id, index]))

function cacheCurrentUser(authToken: string, user: UserProfile) {
  // Gắn hồ sơ với phiên để không khôi phục nhầm tài khoản.
  return writeSetting('currentUser', JSON.stringify({ authToken, user }))
}

function routeFailure(error: unknown): AppErrorKey {
  return !navigator.onLine || (error instanceof BackendApiError && error.status === 0)
    ? 'routeOffline' : 'backendUnavailable'
}

function draftTourStorageKey(userId: string) {
  return `quang-tri:draft-tour:${userId}`
}

function getDraftTourId(userId: string, tours: SavedTour[]) {
  const storedId = localStorage.getItem(draftTourStorageKey(userId))
  return storedId && tours.some((tour) => tour.id === storedId) ? storedId : null
}

export type AppErrorKey = 'savingError' | 'offlinePackError' | 'backendUnavailable' | 'routeOffline'

interface AppState {
  language: Language
  places: Place[]
  selectedPlaceId: string
  routeIds: string[]
  suggestedRouteIds: string[]
  activeTourId: string | null
  isSavingRoute: boolean
  savedTours: SavedTour[]
  offlineMap: OfflineMapPack | null
  useOfflineMap: boolean
  autoNarration: boolean
  location: [number, number] | null
  online: boolean
  currentUser: UserProfile | null
  authToken: string | null
  storageError: AppErrorKey | null
  bootstrapped: boolean
  authReady: boolean
  setLanguage: (language: Language) => void
  setPlaces: (places: Place[]) => void
  setSelectedPlace: (id: string) => void
  setLocation: (location: [number, number] | null) => void
  setOnline: (online: boolean) => void
  signIn: (token: string, user: UserProfile) => Promise<void>
  updateCurrentUser: (user: UserProfile) => Promise<void>
  replaceSession: (token: string) => void
  signOut: () => Promise<void>
  setRoutePlace: (id: string) => Promise<boolean>
  setRouteOrder: (placeIds: string[]) => Promise<boolean>
  setSuggestedRoute: (placeIds: string[]) => void
  syncTours: () => Promise<void>
  applySuggestedRoute: (mode: "replace" | "new") => Promise<boolean>
  removeTour: (id: string) => Promise<void>
  setAutoNarration: (enabled: boolean) => void
  setUseOfflineMap: (enabled: boolean) => void
  installOfflineMap: (pack: OfflineMapPack) => Promise<void>
  removeOfflineMap: () => Promise<void>
  bootstrap: () => Promise<void>
  bootstrapInner: () => Promise<void>
  clearStorageError: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  language: 'vi',
  places: bundledPlaces,
  selectedPlaceId: 'phong-nha-cave',
  routeIds: [],
  suggestedRouteIds: [],
  activeTourId: null,
  isSavingRoute: false,
  savedTours: [],
  offlineMap: null,
  useOfflineMap: false,
  autoNarration: false,
  location: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  currentUser: null,
  authToken: null,
  storageError: null,
  bootstrapped: false,
  authReady: false,
  setLanguage: (language) => {
    set({ language })
    void writeSetting('language', language).catch(() => set({ storageError: 'savingError' }))
  },
  setSelectedPlace: (selectedPlaceId) => set({ selectedPlaceId }),
  setPlaces: (places) => {
    set((state) => ({
      places,
      selectedPlaceId: places.some((place) => place.id === state.selectedPlaceId)
        ? state.selectedPlaceId
        : places[0]?.id ?? state.selectedPlaceId,
    }))
    void replaceCachedPlaces(places).catch(() => set({ storageError: 'savingError' }))
  },
  setLocation: (location) => set({ location }),
  setOnline: (online) => {
    set({ online })
    if (online) void get().syncTours()
  },
  signIn: async (authToken, currentUser) => {
    storeAuthToken(authToken)
    set({ authToken, currentUser, savedTours: [], routeIds: [], activeTourId: null, suggestedRouteIds: [], storageError: null })
    await cacheCurrentUser(authToken, currentUser)
    if (get().authToken !== authToken) return
    await get().syncTours()
  },
  syncTours: async () => {
    const { authToken, currentUser } = get()
    if (!authToken || !currentUser || !navigator.onLine) return
    try {
      const savedTours = (await fetchTours(authToken)).map((tour) => ({ ...tour, ownerId: currentUser.id }))
      if (get().authToken !== authToken) return
      const activeTourId = getDraftTourId(currentUser.id, savedTours)
      set({ savedTours, activeTourId, routeIds: savedTours.find((tour) => tour.id === activeTourId)?.placeIds ?? [] })
      await replaceUserTours(currentUser.id, savedTours)
    } catch (error) {
      if (get().authToken !== authToken) return
      if (error instanceof BackendApiError && error.status === 401) {
        storeAuthToken(null)
        set({ authToken: null, currentUser: null, savedTours: [], activeTourId: null, routeIds: [] })
        await deleteSetting('currentUser')
      } else set({ storageError: 'backendUnavailable' })
    }
  },
  updateCurrentUser: async (user) => {
    const { authToken } = get()
    if (!authToken) return
    const currentUser = await updateProfile(authToken, user)
    if (get().authToken !== authToken) return
    set({ currentUser })
    await cacheCurrentUser(authToken, currentUser)
  },
  replaceSession: (authToken) => {
    storeAuthToken(authToken)
    set({ authToken })
    const { currentUser } = get()
    if (currentUser) void cacheCurrentUser(authToken, currentUser).catch(() => set({ storageError: 'savingError' }))
  },
  signOut: async () => {
    const { authToken } = get()
    storeAuthToken(null)
    set({ currentUser: null, authToken: null, savedTours: [], routeIds: [], activeTourId: null, suggestedRouteIds: [] })
    await deleteSetting('currentUser')
    if (!authToken) return
    try {
      await logoutAccount(authToken)
    } catch {
      set({ storageError: 'backendUnavailable' })
    }
  },
  setRoutePlace: async (id) => {
    const { routeIds, places: allPlaces, authToken, currentUser, activeTourId, isSavingRoute } = get()
    if (!authToken || !currentUser || isSavingRoute) return false
    const nextRouteIds = routeIds.includes(id)
      ? routeIds.filter((placeId) => placeId !== id)
      : [...routeIds, id]
    set({ suggestedRouteIds: [] })
    set({ isSavingRoute: true })
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ isSavingRoute: false, storageError: 'routeOffline' })
      return false
    }
    try {
      if (nextRouteIds.length === 0) {
        if (activeTourId) {
          await deleteRemoteTour(activeTourId, authToken)
          if (get().authToken !== authToken) return false
          await deleteTour(activeTourId)
          if (get().authToken !== authToken) return false
          set((state) => ({
            routeIds: [],
            activeTourId: null,
            savedTours: state.savedTours.filter((tour) => tour.id !== activeTourId),
            storageError: null,
          }))
          localStorage.removeItem(draftTourStorageKey(currentUser.id))
        } else {
          set({ routeIds: [], storageError: null })
        }
        return true
      }

      const { length, lineString } = await import('@turf/turf')
      const coordinates = nextRouteIds
        .map((placeId) => allPlaces.find((place) => place.id === placeId)?.coordinates)
        .filter((coordinate): coordinate is [number, number] => Boolean(coordinate))
      const distanceKm = coordinates.length > 1
        ? length(lineString(coordinates), { units: 'kilometers' })
        : 0
      const tour: SavedTour = {
        id: activeTourId ?? generateId(),
        placeIds: nextRouteIds,
        createdAt: get().savedTours.find((item) => item.id === activeTourId)?.createdAt ?? Date.now(),
        distanceKm,
        durationMinutes: nextRouteIds.reduce(
          (total, placeId) => total + (allPlaces.find((place) => place.id === placeId)?.duration ?? 0),
          0,
        ),
      }
      const remoteTour = { ...await createTour(tour, authToken), ownerId: currentUser.id }
      if (get().authToken !== authToken) return false
      set((state) => ({
        routeIds: nextRouteIds,
        activeTourId: remoteTour.id,
        savedTours: [remoteTour, ...state.savedTours.filter((item) => item.id !== remoteTour.id)],
        storageError: null,
      }))
      localStorage.setItem(draftTourStorageKey(currentUser.id), remoteTour.id)
      try {
        await saveTour(remoteTour, currentUser.id)
      } catch {
        set({ storageError: 'savingError' })
      }
      return true
    } catch (error) {
      if (get().authToken !== authToken) return false
      set({ storageError: routeFailure(error) })
      return false
    } finally {
      set({ isSavingRoute: false })
    }
  },
  setRouteOrder: async (placeIds) => {
    const { routeIds, places: allPlaces, authToken, currentUser, activeTourId, isSavingRoute } = get()
    if (
      !authToken ||
      !currentUser ||
      isSavingRoute ||
      placeIds.length !== routeIds.length ||
      new Set(placeIds).size !== routeIds.length ||
      placeIds.some((id) => !routeIds.includes(id))
    ) return false
    if (placeIds.every((id, index) => id === routeIds[index])) return true

    set({ suggestedRouteIds: [] })
    set({ isSavingRoute: true })
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ isSavingRoute: false, storageError: 'routeOffline' })
      return false
    }
    try {
      const { length, lineString } = await import('@turf/turf')
      const coordinates = placeIds
        .map((placeId) => allPlaces.find((place) => place.id === placeId)?.coordinates)
        .filter((coordinate): coordinate is [number, number] => coordinate !== undefined)
      const tour: SavedTour = {
        id: activeTourId ?? generateId(),
        placeIds,
        createdAt: get().savedTours.find((item) => item.id === activeTourId)?.createdAt ?? Date.now(),
        distanceKm: coordinates.length > 1 ? length(lineString(coordinates), { units: 'kilometers' }) : 0,
        durationMinutes: placeIds.reduce(
          (total, placeId) => total + (allPlaces.find((place) => place.id === placeId)?.duration ?? 0),
          0,
        ),
      }
      const remoteTour = { ...await createTour(tour, authToken), ownerId: currentUser.id }
      if (get().authToken !== authToken) return false
      set((state) => ({
        routeIds: placeIds,
        activeTourId: remoteTour.id,
        savedTours: [remoteTour, ...state.savedTours.filter((item) => item.id !== remoteTour.id)],
        storageError: null,
      }))
      localStorage.setItem(draftTourStorageKey(currentUser.id), remoteTour.id)
      try {
        await saveTour(remoteTour, currentUser.id)
      } catch {
        set({ storageError: 'savingError' })
      }
      return true
    } catch (error) {
      if (get().authToken !== authToken) return false
      set({ storageError: routeFailure(error) })
      return false
    } finally {
      set({ isSavingRoute: false })
    }
  },
  setSuggestedRoute: (suggestedRouteIds) => set({ suggestedRouteIds }),
  applySuggestedRoute: async (mode) => {
    const { suggestedRouteIds: placeIds, places, currentUser, authToken, activeTourId, isSavingRoute, online } = get()
    if (!currentUser || !authToken || isSavingRoute || !placeIds.length) return false
    if (!online || !navigator.onLine) { set({ storageError: 'routeOffline' }); return false }
    set({ isSavingRoute: true })
    try {
      const { length, lineString } = await import('@turf/turf')
      const coordinates = placeIds.map((id) => places.find((place) => place.id === id)?.coordinates)
        .filter((item): item is [number, number] => Boolean(item))
      const id = mode === 'replace' ? activeTourId ?? generateId() : generateId()
      const tour = { id, placeIds, createdAt: get().savedTours.find((item) => item.id === id)?.createdAt ?? Date.now(),
        distanceKm: coordinates.length > 1 ? length(lineString(coordinates), { units: 'kilometers' }) : 0,
        durationMinutes: placeIds.reduce((sum, id) => sum + (places.find((place) => place.id === id)?.duration ?? 0), 0) }
      const saved = { ...await createTour(tour, authToken), ownerId: currentUser.id }
      if (get().authToken !== authToken) return false
      set((state) => ({ savedTours: [saved, ...state.savedTours.filter((item) => item.id !== saved.id)],
        activeTourId: saved.id, routeIds: saved.placeIds, suggestedRouteIds: [], storageError: null }))
      localStorage.setItem(draftTourStorageKey(currentUser.id), saved.id)
      await saveTour(saved, currentUser.id)
      return true
    } catch (error) {
      if (get().authToken === authToken) set({ storageError: routeFailure(error) })
      return false
    }
    finally { set({ isSavingRoute: false }) }
  },
  removeTour: async (id) => {
    const { authToken, activeTourId, currentUser } = get()
    try {
      if (!authToken) return
      if (!get().online || !navigator.onLine) { set({ storageError: 'routeOffline' }); return }
      await deleteRemoteTour(id, authToken)
      if (get().authToken !== authToken) return
      set((state) => ({
        savedTours: state.savedTours.filter((tour) => tour.id !== id),
        ...(activeTourId === id ? { activeTourId: null, routeIds: [] } : {}),
        storageError: null,
      }))
      if (activeTourId === id && currentUser) {
        localStorage.removeItem(draftTourStorageKey(currentUser.id))
      }
      try {
        await deleteTour(id)
      } catch {
        set({ storageError: 'savingError' })
      }
    } catch (error) {
      if (get().authToken === authToken) set({ storageError: routeFailure(error) })
    }
  },
  setAutoNarration: (autoNarration) => set({ autoNarration }),
  setUseOfflineMap: (useOfflineMap) => {
    set({ useOfflineMap })
    void writeSetting('useOfflineMap', useOfflineMap).catch(() => set({ storageError: 'savingError' }))
  },
  installOfflineMap: async (offlineMap) => {
    try {
      await saveOfflineMap(offlineMap)
      set({ offlineMap, useOfflineMap: true, storageError: null })
      void writeSetting('useOfflineMap', true).catch(() => set({ storageError: 'savingError' }))
    } catch {
      set({ storageError: 'savingError' })
      throw new Error('Could not save the offline map in IndexedDB.')
    }
  },
  removeOfflineMap: async () => {
    try {
      await deleteOfflineMap()
      set({ offlineMap: null, useOfflineMap: false, storageError: null })
      void writeSetting('useOfflineMap', false).catch(() => set({ storageError: 'savingError' }))
    } catch {
      set({ storageError: 'savingError' })
    }
  },
  bootstrap: async () => {
    try {
      await get().bootstrapInner()
    } finally {
      // Đã xác định xong trạng thái đăng nhập (kể cả khi không có phiên hoặc lỗi).
      set({ authReady: true })
    }
  },
  bootstrapInner: async () => {
    try {
      const [cachedPlaces, offlineMap, language, offlineMode, catalogSynced] = await Promise.all([
        getCachedPlaces(), getOfflineMap(), readSetting('language'), readSetting('useOfflineMap'), readSetting('catalogSynced'),
      ])
      // Sau l?n ??ng b? ??u, kh?ng h?i sinh ??a ?i?m m? qu?n tr? vi?n ?? x?a.
      const missing = catalogSynced?.value ? [] : bundledPlaces.filter((place) => !cachedPlaces.some((cached) => cached.id === place.id))
      if (missing.length) await cachePlaces(missing)
      const selectedLanguage = language?.value
      const localPlaces = [...cachedPlaces, ...missing].filter((place) => place.id !== 'truong-son-cemetery')
        .sort((a, b) => (placeOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (placeOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
          || a.copy.vi.title.localeCompare(b.copy.vi.title, 'vi'))
      set({
        places: localPlaces,
        savedTours: [],
        offlineMap: offlineMap ?? null,
        language: languages.find((item) => item.code === selectedLanguage)?.code ?? 'vi',
        useOfflineMap: Boolean(offlineMode?.value && offlineMap),
        bootstrapped: true,
      })
    } catch {
      set({ storageError: 'savingError', bootstrapped: true })
    }

    const authToken = getStoredAuthToken()
    if (authToken) {
      try {
        const cached = await readSetting('currentUser')
        const session = typeof cached?.value === 'string'
          ? JSON.parse(cached.value) as { authToken?: string; user?: UserProfile } : null
        const currentUser = session?.authToken === authToken ? session.user : null
        if (currentUser) {
          const savedTours = (await getSavedTours()).filter((tour) => tour.ownerId === currentUser.id)
          if (getStoredAuthToken() !== authToken) return
          const activeTourId = getDraftTourId(currentUser.id, savedTours)
          set({ authToken, currentUser, savedTours, activeTourId, routeIds: savedTours.find((tour) => tour.id === activeTourId)?.placeIds ?? [] })
        }
      } catch { set({ storageError: 'savingError' }) }
    }
    if (typeof navigator === 'undefined' || !navigator.onLine) return
    try {
      const places = mergeRemotePlaces(get().places, await fetchPlaces())
      set({ places })
      await replaceCachedPlaces(places)
      await writeSetting('catalogSynced', true)
    } catch { set({ storageError: 'backendUnavailable' }) }
    if (!authToken) return
    try {
      const currentUser = await fetchCurrentUser(authToken)
      if (getStoredAuthToken() !== authToken) return
      set({ authToken, currentUser })
      await cacheCurrentUser(authToken, currentUser)
      await get().syncTours()
    } catch (error) {
      if (getStoredAuthToken() !== authToken) return
      if (error instanceof BackendApiError && error.status === 401) {
        storeAuthToken(null)
        set({ authToken: null, currentUser: null, savedTours: [], activeTourId: null, routeIds: [] })
        await deleteSetting('currentUser')
      } else set({ storageError: 'backendUnavailable' })
    }
  },
  clearStorageError: () => set({ storageError: null }),
}))
