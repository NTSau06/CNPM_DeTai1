// Quản lý trạng thái chung và khởi tạo/đồng bộ dữ liệu với IndexedDB, backend.
import { create } from 'zustand'
import { cachePlaces, replaceCachedPlaces, replaceUserTours, sortTours, getSavedToursByUser, clearToursOfUser, deleteSetting, deleteOfflineMap, deleteTour, getCachedPlaces, getOfflineMap, readSetting, saveOfflineMap, saveTour, writeSetting } from './db'
import { BackendApiError, addFavorite, createTour, deleteRemoteTour, fetchCurrentUser, fetchFavorites, fetchPlaces, fetchTours, generateId, removeFavorite, getStoredAuthToken, logoutAccount, mergeRemotePlaces, storeAuthToken, updateProfile } from './api'
import { languages, places as bundledPlaces } from './data/places'
import type { Language, OfflineMapPack, Place, SavedTour, UserProfile } from './types'

const placeOrder = new Map(bundledPlaces.map((place, index) => [place.id, index]))
let toursRevision = 0
let pendingTourChanges = 0

function beginTourChange() {
  toursRevision += 1
  pendingTourChanges += 1
}

function endTourChange() {
  toursRevision += 1
  pendingTourChanges -= 1
}

function cacheCurrentUser(user: UserProfile) {
  return writeSetting('cachedUser', JSON.stringify(user)).then(() => deleteSetting('currentUser'))
}

function parseCachedUser(value: string | boolean | undefined): UserProfile | null {
  if (typeof value !== 'string') return null
  const parsed: unknown = JSON.parse(value)
  return typeof parsed === 'object' && parsed !== null
    && 'id' in parsed && typeof parsed.id === 'string'
    && 'fullName' in parsed && typeof parsed.fullName === 'string'
    && 'email' in parsed && typeof parsed.email === 'string'
    && 'phone' in parsed && typeof parsed.phone === 'string'
    && 'birthDate' in parsed && typeof parsed.birthDate === 'string'
    && 'address' in parsed && typeof parsed.address === 'string'
    ? parsed as UserProfile
    : null
}

async function clearCachedUserData(userId: string | null) {
  const cleanup = [deleteSetting('cachedUser'), deleteSetting('currentUser')]
  if (userId) {
    cleanup.push(clearToursOfUser(userId))
  }
  await Promise.all(cleanup)
  if (userId) {
    localStorage.removeItem(draftTourStorageKey(userId))
  }
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
  placesRevision: number
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
  favoriteIds: string[]
  syncFavorites: () => Promise<void>
  toggleFavorite: (placeId: string) => Promise<boolean>
  setLanguage: (language: Language) => void
  beginPlacesSync: () => number
  setPlaces: (places: Place[], revision?: number) => void
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
  placesRevision: 0,
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
  favoriteIds: [],
  syncFavorites: async () => {
    const { authToken } = get()
    if (!authToken || !navigator.onLine) return
    try {
      const items = await fetchFavorites(authToken)
      if (get().authToken === authToken) set({ favoriteIds: items.map((item) => item.placeId) })
    } catch {
      // Danh sách yêu thích không quan trọng bằng hành trình: lỗi mạng thì giữ dữ liệu cũ.
    }
  },
  toggleFavorite: async (placeId) => {
    const { authToken, favoriteIds } = get()
    if (!authToken) return false
    const wasFavorite = favoriteIds.includes(placeId)
    // Cập nhật lạc quan để giao diện phản hồi ngay, hoàn tác nếu máy chủ báo lỗi.
    set({ favoriteIds: wasFavorite ? favoriteIds.filter((id) => id !== placeId) : [placeId, ...favoriteIds] })
    try {
      if (wasFavorite) await removeFavorite(placeId, authToken)
      else await addFavorite(placeId, authToken)
      return true
    } catch {
      if (get().authToken === authToken) set({ favoriteIds })
      return false
    }
  },
  setLanguage: (language) => {
    set({ language })
    void writeSetting('language', language).catch(() => set({ storageError: 'savingError' }))
  },
  setSelectedPlace: (selectedPlaceId) => set({ selectedPlaceId }),
  beginPlacesSync: () => {
    const revision = get().placesRevision + 1
    set({ placesRevision: revision })
    return revision
  },
  setPlaces: (places, revision = get().beginPlacesSync()) => {
    const isCurrent = () => get().placesRevision === revision
    if (!isCurrent()) return
    set((state) => ({
      places,
      selectedPlaceId: places.some((place) => place.id === state.selectedPlaceId)
        ? state.selectedPlaceId
        : places[0]?.id ?? state.selectedPlaceId,
    }))
    void replaceCachedPlaces(places, isCurrent).catch(() => {
      if (isCurrent()) set({ storageError: 'savingError' })
    })
  },
  setLocation: (location) => set({ location }),
  setOnline: (online) => {
    set({ online })
    if (online) {
      void get().syncTours()
      void get().syncFavorites()
    }
  },
  signIn: async (authToken, currentUser) => {
    toursRevision += 1
    storeAuthToken(authToken)
    set({ authToken, currentUser, savedTours: [], routeIds: [], activeTourId: null, suggestedRouteIds: [], favoriteIds: [], storageError: null })
    void get().syncFavorites()
    await cacheCurrentUser(currentUser)
    if (get().authToken !== authToken) return
    try {
      const savedTours = sortTours((await getSavedToursByUser(currentUser.id))
        .map((tour) => ({ ...tour, userId: currentUser.id })))
      if (get().authToken !== authToken) return
      await replaceUserTours(currentUser.id, savedTours, () => get().authToken === authToken)
      const activeTourId = getDraftTourId(currentUser.id, savedTours)
      set({
        savedTours,
        activeTourId,
        routeIds: savedTours.find((tour) => tour.id === activeTourId)?.placeIds ?? [],
      })
    } catch {
      set({ storageError: 'savingError' })
    }
    await get().syncTours()
  },
  syncTours: async () => {
    const { authToken, currentUser } = get()
    if (!authToken || !currentUser || !navigator.onLine || pendingTourChanges) return
    const revision = ++toursRevision
    const isCurrent = () => revision === toursRevision && get().authToken === authToken
      && getStoredAuthToken() === authToken && get().currentUser?.id === currentUser.id
    try {
      const savedTours = sortTours((await fetchTours(authToken)).map((tour) => ({ ...tour, userId: currentUser.id })))
      if (!isCurrent()) return
      await replaceUserTours(currentUser.id, savedTours, isCurrent)
      if (!isCurrent()) return
      const activeTourId = getDraftTourId(currentUser.id, savedTours)
      set({ savedTours, activeTourId, routeIds: savedTours.find((tour) => tour.id === activeTourId)?.placeIds ?? [] })
    } catch (error) {
      if (!isCurrent()) return
      if (error instanceof BackendApiError && error.status === 401) {
        storeAuthToken(null)
        toursRevision += 1
        set({ authToken: null, currentUser: null, savedTours: [], activeTourId: null, routeIds: [], favoriteIds: [] })
        try {
          await clearCachedUserData(currentUser.id)
        } catch {
          set({ storageError: 'savingError' })
        }
      } else set({ storageError: 'backendUnavailable' })
    }
  },
  updateCurrentUser: async (user) => {
    const { authToken } = get()
    if (!authToken) return
    const currentUser = await updateProfile(authToken, user)
    if (get().authToken !== authToken) return
    set({ currentUser })
    await cacheCurrentUser(currentUser)
  },
  replaceSession: (authToken) => {
    toursRevision += 1
    storeAuthToken(authToken)
    set({ authToken })
    const { currentUser } = get()
    if (currentUser) void cacheCurrentUser(currentUser).catch(() => set({ storageError: 'savingError' }))
  },
  signOut: async () => {
    toursRevision += 1
    const { authToken, currentUser } = get()
    storeAuthToken(null)
    set({ currentUser: null, authToken: null, savedTours: [], routeIds: [], activeTourId: null, suggestedRouteIds: [], favoriteIds: [] })
    try {
      await clearCachedUserData(currentUser?.id ?? null)
    } catch {
      set({ storageError: 'savingError' })
    }
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
    beginTourChange()
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
        userId: currentUser.id,
        id: activeTourId ?? generateId(),
        placeIds: nextRouteIds,
        createdAt: get().savedTours.find((item) => item.id === activeTourId)?.createdAt ?? Date.now(),
        distanceKm,
        durationMinutes: nextRouteIds.reduce(
          (total, placeId) => total + (allPlaces.find((place) => place.id === placeId)?.duration ?? 0),
          0,
        ),
      }
      const remoteTour = { ...await createTour(tour, authToken), userId: currentUser.id }
      if (get().authToken !== authToken) return false
      set((state) => ({
        routeIds: nextRouteIds,
        activeTourId: remoteTour.id,
        savedTours: sortTours([remoteTour, ...state.savedTours.filter((item) => item.id !== remoteTour.id)]),
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
      endTourChange()
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
    beginTourChange()
    try {
      const { length, lineString } = await import('@turf/turf')
      const coordinates = placeIds
        .map((placeId) => allPlaces.find((place) => place.id === placeId)?.coordinates)
        .filter((coordinate): coordinate is [number, number] => coordinate !== undefined)
      const tour: SavedTour = {
        userId: currentUser.id,
        id: activeTourId ?? generateId(),
        placeIds,
        createdAt: get().savedTours.find((item) => item.id === activeTourId)?.createdAt ?? Date.now(),
        distanceKm: coordinates.length > 1 ? length(lineString(coordinates), { units: 'kilometers' }) : 0,
        durationMinutes: placeIds.reduce(
          (total, placeId) => total + (allPlaces.find((place) => place.id === placeId)?.duration ?? 0),
          0,
        ),
      }
      const remoteTour = { ...await createTour(tour, authToken), userId: currentUser.id }
      if (get().authToken !== authToken) return false
      set((state) => ({
        routeIds: placeIds,
        activeTourId: remoteTour.id,
        savedTours: sortTours([remoteTour, ...state.savedTours.filter((item) => item.id !== remoteTour.id)]),
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
      endTourChange()
      set({ isSavingRoute: false })
    }
  },
  setSuggestedRoute: (suggestedRouteIds) => set({ suggestedRouteIds }),
  applySuggestedRoute: async (mode) => {
    const { suggestedRouteIds: placeIds, places, currentUser, authToken, activeTourId, isSavingRoute, online } = get()
    if (!currentUser || !authToken) throw new BackendApiError('Authentication required.', 401)
    if (isSavingRoute || !placeIds.length) return false
    if (!online || !navigator.onLine) { set({ storageError: 'routeOffline' }); return false }
    beginTourChange()
    set({ isSavingRoute: true })
    try {
      const { length, lineString } = await import('@turf/turf')
      const coordinates = placeIds.map((id) => places.find((place) => place.id === id)?.coordinates)
        .filter((item): item is [number, number] => Boolean(item))
      const id = mode === 'replace' ? activeTourId ?? generateId() : generateId()
      const tour = { id, placeIds, createdAt: get().savedTours.find((item) => item.id === id)?.createdAt ?? Date.now(),
        userId: currentUser.id,
        distanceKm: coordinates.length > 1 ? length(lineString(coordinates), { units: 'kilometers' }) : 0,
        durationMinutes: placeIds.reduce((sum, id) => sum + (places.find((place) => place.id === id)?.duration ?? 0), 0) }
      const saved = { ...await createTour(tour, authToken), userId: currentUser.id }
      if (get().authToken !== authToken) return false
      set((state) => ({ savedTours: sortTours([saved, ...state.savedTours.filter((item) => item.id !== saved.id)]),
        activeTourId: saved.id, routeIds: saved.placeIds, suggestedRouteIds: [], storageError: null }))
      try {
        await saveTour(saved, currentUser.id)
        localStorage.setItem(draftTourStorageKey(currentUser.id), saved.id)
      } catch {
        // Server đã lưu thành công; báo lỗi cache để tránh tạo trùng khi thử lại.
        if (get().authToken === authToken) set({ storageError: 'savingError' })
      }
      return get().authToken === authToken
    } catch (error) {
      if (get().authToken !== authToken) return false
      if (error instanceof BackendApiError && error.status === 401) throw error
      set({ storageError: routeFailure(error) })
      return false
    }
    finally { endTourChange(); set({ isSavingRoute: false }) }
  },
  removeTour: async (id) => {
    const { authToken, activeTourId, currentUser } = get()
    if (!authToken) return
    if (!get().online || !navigator.onLine) { set({ storageError: 'routeOffline' }); return }
    beginTourChange()
    try {
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
    } finally {
      endTourChange()
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
    const localRevision = get().placesRevision
    try {
      const [cachedPlaces, offlineMap, language, offlineMode, catalogSynced] = await Promise.all([
        getCachedPlaces(), getOfflineMap(), readSetting('language'), readSetting('useOfflineMap'), readSetting('catalogSynced'),
      ])
      // Sau lần đồng bộ đầu, không phục hồi địa điểm admin đã xoá.
      const missing = catalogSynced?.value ? [] : bundledPlaces.filter((place) => !cachedPlaces.some((cached) => cached.id === place.id))
      if (missing.length) await cachePlaces(missing)
      const selectedLanguage = language?.value
      const localPlaces = (await getCachedPlaces()).filter((place) => place.id !== 'truong-son-cemetery')
        .sort((a, b) => (placeOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (placeOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
          || a.copy.vi.title.localeCompare(b.copy.vi.title, 'vi'))
      set({
        ...(get().placesRevision === localRevision ? { places: localPlaces } : {}),
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
        const cached = await readSetting('cachedUser')
        let currentUser = parseCachedUser(cached?.value)
        if (!currentUser) {
          const legacy = await readSetting('currentUser')
          if (typeof legacy?.value === 'string') {
            const session: unknown = JSON.parse(legacy.value)
            if (typeof session === 'object' && session !== null && 'authToken' in session
              && session.authToken === authToken && 'user' in session) {
              currentUser = parseCachedUser(JSON.stringify(session.user))
              if (currentUser) await cacheCurrentUser(currentUser)
            }
          }
        }
        if (currentUser) {
          const savedTours = sortTours((await getSavedToursByUser(currentUser.id))
            .map((tour) => ({ ...tour, userId: currentUser.id })))
          if (getStoredAuthToken() !== authToken) return
          await replaceUserTours(currentUser.id, savedTours, () => getStoredAuthToken() === authToken)
          if (getStoredAuthToken() !== authToken) return
          const activeTourId = getDraftTourId(currentUser.id, savedTours)
          set({ authToken, currentUser, savedTours, activeTourId, routeIds: savedTours.find((tour) => tour.id === activeTourId)?.placeIds ?? [] })
        }
      } catch { set({ storageError: 'savingError' }) }
    }
    if (typeof navigator === 'undefined' || !navigator.onLine) return
    const revision = get().beginPlacesSync()
    try {
      const places = mergeRemotePlaces(get().places, await fetchPlaces())
      if (get().placesRevision === revision) {
        set({ places })
        await replaceCachedPlaces(places, () => get().placesRevision === revision)
      }
    } catch {
      if (get().placesRevision === revision) set({ storageError: 'backendUnavailable' })
    }
    if (!authToken) return
    try {
      const currentUser = await fetchCurrentUser(authToken)
      if (getStoredAuthToken() !== authToken) return
      set({ authToken, currentUser })
      await cacheCurrentUser(currentUser)
      void get().syncFavorites()
      await get().syncTours()
    } catch (error) {
      if (getStoredAuthToken() !== authToken) return
      if (error instanceof BackendApiError && error.status === 401) {
        const userId = get().currentUser?.id ?? null
        storeAuthToken(null)
        toursRevision += 1
        set({ authToken: null, currentUser: null, savedTours: [], activeTourId: null, routeIds: [], favoriteIds: [] })
        try {
          await clearCachedUserData(userId)
        } catch {
          set({ storageError: 'savingError' })
        }
      } else set({ storageError: 'backendUnavailable' })
    }
  },
  clearStorageError: () => set({ storageError: null }),
}))
