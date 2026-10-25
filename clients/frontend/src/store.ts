import { create } from 'zustand'
import { cachePlaces, deleteOfflineMap, deleteTour, getCachedPlaces, getOfflineMap, getSavedTours, readSetting, saveOfflineMap, saveTour, writeSetting } from './db'
import { BackendApiError, createTour, deleteRemoteTour, fetchPlaces, fetchTours, mergeRemotePlaces } from './api'
import { languages, places as bundledPlaces } from './data/places'
import type { Language, OfflineMapPack, Place, SavedTour, UserProfile } from './types'

const placeOrder = new Map(bundledPlaces.map((place, index) => [place.id, index]))

export type AppErrorKey = 'savingError' | 'offlinePackError' | 'backendUnavailable'

interface AppState {
  language: Language
  places: Place[]
  selectedPlaceId: string
  routeIds: string[]
  savedTours: SavedTour[]
  offlineMap: OfflineMapPack | null
  useOfflineMap: boolean
  autoNarration: boolean
  location: [number, number] | null
  online: boolean
  currentUser: UserProfile | null
  storageError: AppErrorKey | null
  bootstrapped: boolean
  setLanguage: (language: Language) => void
  setSelectedPlace: (id: string) => void
  setLocation: (location: [number, number] | null) => void
  setOnline: (online: boolean) => void
  setCurrentUser: (user: UserProfile) => void
  updateCurrentUser: (user: UserProfile) => void
  signOut: () => void
  toggleRoutePlace: (id: string) => void
  saveCurrentTour: () => Promise<boolean>
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
  savedTours: [],
  offlineMap: null,
  useOfflineMap: false,
  autoNarration: false,
  location: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  currentUser: null,
  storageError: null,
  bootstrapped: false,
  setLanguage: (language) => {
    set({ language })
    void writeSetting('language', language).catch(() => set({ storageError: 'savingError' }))
  },
  setSelectedPlace: (selectedPlaceId) => set({ selectedPlaceId }),
  setLocation: (location) => set({ location }),
  setOnline: (online) => set({ online }),
  setCurrentUser: (currentUser) => set({ currentUser }),
  updateCurrentUser: (currentUser) => set({ currentUser }),
  signOut: () => set({ currentUser: null }),
  toggleRoutePlace: (id) => set((state) => ({
    routeIds: state.routeIds.includes(id)
      ? state.routeIds.filter((placeId) => placeId !== id)
      : [...state.routeIds, id],
  })),
  saveCurrentTour: async () => {
    const { routeIds, places: allPlaces } = get()
    if (routeIds.length === 0) return false
    const { length, lineString } = await import('@turf/turf')
    const coordinates = routeIds.map((id) => allPlaces.find((place) => place.id === id)?.coordinates).filter((coordinate): coordinate is [number, number] => Boolean(coordinate))
    const distanceKm = coordinates.length > 1 ? length(lineString(coordinates), { units: 'kilometers' }) : 0
    const tour: SavedTour = {
      id: crypto.randomUUID(),
      placeIds: routeIds,
      createdAt: Date.now(),
      distanceKm,
      durationMinutes: routeIds.reduce((total, id) => total + (allPlaces.find((place) => place.id === id)?.duration ?? 0), 0),
    }
    try {
      await saveTour(tour)
      set((state) => ({ savedTours: [tour, ...state.savedTours], routeIds: [], storageError: null }))
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const remoteTour = await createTour(tour)
          await saveTour(remoteTour)
          set((state) => ({
            savedTours: state.savedTours.map((item) => item.id === tour.id ? remoteTour : item),
            storageError: null,
          }))
        } catch {
          set({ storageError: 'backendUnavailable' })
        }
      }
      return true
    } catch {
      set({ storageError: 'savingError' })
      return false
    }
  },
  removeTour: async (id) => {
    try {
      await deleteTour(id)
      set((state) => ({ savedTours: state.savedTours.filter((tour) => tour.id !== id), storageError: null }))
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await deleteRemoteTour(id)
        } catch {
          set({ storageError: 'backendUnavailable' })
        }
      }
    } catch {
      set({ storageError: 'savingError' })
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
      const [cachedPlaces, tours, offlineMap, language, offlineMode] = await Promise.all([
        getCachedPlaces(),
        getSavedTours(),
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
        savedTours: tours.reverse(),
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

    try {
      const remoteTours = await fetchTours()
      const existingIds = new Set(get().savedTours.map((tour) => tour.id))
      const newTours = remoteTours.filter((tour) => !existingIds.has(tour.id))
      if (newTours.length > 0) {
        await Promise.all(newTours.map((tour) => saveTour(tour)))
        set((state) => ({
          savedTours: [...state.savedTours, ...newTours].sort((first, second) => second.createdAt - first.createdAt),
        }))
      }
    } catch (error) {
      set({ storageError: error instanceof BackendApiError ? 'backendUnavailable' : 'savingError' })
    }
  },
  clearStorageError: () => set({ storageError: null }),
}))
