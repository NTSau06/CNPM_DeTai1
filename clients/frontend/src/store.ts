// Quản lý trạng thái chung và khởi tạo/đồng bộ dữ liệu với IndexedDB, backend.
import { create } from 'zustand'
import { cachePlaces, deleteOfflineMap, deleteTour, getCachedPlaces, getOfflineMap, readSetting, saveOfflineMap, saveTour, writeSetting } from './db'
import { BackendApiError, createTour, deleteRemoteTour, fetchCurrentUser, fetchPlaces, fetchTours, getStoredAuthToken, logoutAccount, mergeRemotePlaces, storeAuthToken } from './api'
import { languages, places as bundledPlaces } from './data/places'
import type { Language, OfflineMapPack, Place, SavedTour, UserProfile } from './types'

const placeOrder = new Map(bundledPlaces.map((place, index) => [place.id, index]))

function draftTourStorageKey(userId: string) {
  return `quang-tri:draft-tour:${userId}`
}

function getDraftTourId(userId: string, tours: SavedTour[]) {
  const storedId = localStorage.getItem(draftTourStorageKey(userId))
  return storedId && tours.some((tour) => tour.id === storedId) ? storedId : null
}

export type AppErrorKey = 'savingError' | 'offlinePackError' | 'backendUnavailable'

interface AppState {
  language: Language
  places: Place[]
  selectedPlaceId: string
  routeIds: string[]
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
  setLanguage: (language: Language) => void
  setSelectedPlace: (id: string) => void
  setLocation: (location: [number, number] | null) => void
  setOnline: (online: boolean) => void
  signIn: (token: string, user: UserProfile) => Promise<void>
  updateCurrentUser: (user: UserProfile) => void
  signOut: () => Promise<void>
  setRoutePlace: (id: string) => Promise<boolean>
  removeTour: (id: string) => Promise<void>
  setAutoNarration: (enabled: boolean) => void
  setUseOfflineMap: (enabled: boolean) => void
  installOfflineMap: (pack: OfflineMapPack) => Promise<void>
  removeOfflineMap: () => Promise<void>
  bootstrap: () => Promise<void>
  clearStorageError: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  language: 'vi',
  places: bundledPlaces,
  selectedPlaceId: 'phong-nha-cave',
  routeIds: [],
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
  setLanguage: (language) => {
    set({ language })
    void writeSetting('language', language).catch(() => set({ storageError: 'savingError' }))
  },
  setSelectedPlace: (selectedPlaceId) => set({ selectedPlaceId }),
  setLocation: (location) => set({ location }),
  setOnline: (online) => set({ online }),
  signIn: async (authToken, currentUser) => {
    storeAuthToken(authToken)
    set({ authToken, currentUser, savedTours: [], routeIds: [], storageError: null })
    try {
      const savedTours = await fetchTours(authToken)
      const activeTourId = getDraftTourId(currentUser.id, savedTours)
      const activeTour = savedTours.find((tour) => tour.id === activeTourId)
      set({
        savedTours,
        activeTourId,
        routeIds: activeTour?.placeIds ?? [],
      })
      await Promise.all(savedTours.map((tour) => saveTour(tour)))
    } catch {
      set({ storageError: 'backendUnavailable' })
    }
  },
  updateCurrentUser: (currentUser) => set({ currentUser }),
  signOut: async () => {
    const { authToken } = get()
    storeAuthToken(null)
    set({ currentUser: null, authToken: null, savedTours: [], routeIds: [], activeTourId: null })
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
    set({ isSavingRoute: true })
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ isSavingRoute: false, storageError: 'backendUnavailable' })
      return false
    }
    try {
      if (nextRouteIds.length === 0) {
        if (activeTourId) {
          await deleteRemoteTour(activeTourId, authToken)
          await deleteTour(activeTourId)
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
        id: activeTourId ?? crypto.randomUUID(),
        placeIds: nextRouteIds,
        createdAt: get().savedTours.find((item) => item.id === activeTourId)?.createdAt ?? Date.now(),
        distanceKm,
        durationMinutes: nextRouteIds.reduce(
          (total, placeId) => total + (allPlaces.find((place) => place.id === placeId)?.duration ?? 0),
          0,
        ),
      }
      const remoteTour = await createTour(tour, authToken)
      set((state) => ({
        routeIds: nextRouteIds,
        activeTourId: remoteTour.id,
        savedTours: [remoteTour, ...state.savedTours.filter((item) => item.id !== remoteTour.id)],
        storageError: null,
      }))
      localStorage.setItem(draftTourStorageKey(currentUser.id), remoteTour.id)
      try {
        await saveTour(remoteTour)
      } catch {
        set({ storageError: 'savingError' })
      }
      return true
    } catch {
      set({ storageError: 'backendUnavailable' })
      return false
    } finally {
      set({ isSavingRoute: false })
    }
  },
  removeTour: async (id) => {
    try {
      const { authToken, activeTourId, currentUser } = get()
      if (!authToken) return
      await deleteRemoteTour(id, authToken)
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
    } catch {
      set({ storageError: 'backendUnavailable' })
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
      await cachePlaces(bundledPlaces)
      const [cachedPlaces, offlineMap, language, offlineMode] = await Promise.all([
        getCachedPlaces(),
        getOfflineMap(),
        readSetting('language'),
        readSetting('useOfflineMap'),
      ])
      const selectedLanguage = language?.value
      const localPlaces = cachedPlaces.some((place) => placeOrder.has(place.id))
          ? cachedPlaces.filter((place) => placeOrder.has(place.id)).sort((first, second) => (placeOrder.get(first.id) ?? Number.MAX_SAFE_INTEGER) - (placeOrder.get(second.id) ?? Number.MAX_SAFE_INTEGER))
          : bundledPlaces
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
      return
    }

    if (typeof navigator === 'undefined' || !navigator.onLine) return

    try {
      const remotePlaces = await fetchPlaces()
      const places = mergeRemotePlaces(get().places, remotePlaces)
      set({ places })
      await cachePlaces(places)
    } catch (error) {
      set({ storageError: error instanceof BackendApiError ? 'backendUnavailable' : 'savingError' })
      return
    }

    const authToken = getStoredAuthToken()
    if (!authToken) return
    let currentUser: UserProfile
    try {
      currentUser = await fetchCurrentUser(authToken)
      storeAuthToken(authToken)
      set({ authToken, currentUser })
    } catch (error) {
      storeAuthToken(null)
      set({
        authToken: null,
        currentUser: null,
        savedTours: [],
        storageError: error instanceof BackendApiError ? 'backendUnavailable' : 'savingError',
      })
      return
    }
    try {
      const remoteTours = await fetchTours(authToken)
      const activeTourId = getDraftTourId(currentUser.id, remoteTours)
      const activeTour = remoteTours.find((tour) => tour.id === activeTourId)
      set({
        savedTours: remoteTours,
        activeTourId,
        routeIds: activeTour?.placeIds ?? [],
      })
      await Promise.all(remoteTours.map((tour) => saveTour(tour)))
    } catch (error) {
      set({
        storageError: error instanceof BackendApiError ? 'backendUnavailable' : 'savingError',
      })
    }
  },
  clearStorageError: () => set({ storageError: null }),
}))
