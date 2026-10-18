import { create } from 'zustand'
import { cachePlaces, deleteOfflineMap, deleteTour, getCachedPlaces, getOfflineMap, getSavedTours, readSetting, saveOfflineMap, saveTour, writeSetting } from './db'
import { languages, places as bundledPlaces } from './data/places'
import type { Language, OfflineMapPack, Place, SavedTour } from './types'

const placeOrder = new Map(bundledPlaces.map((place, index) => [place.id, index]))

export type AppErrorKey = 'savingError' | 'offlinePackError'

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
  storageError: AppErrorKey | null
  bootstrapped: boolean
  setLanguage: (language: Language) => void
  setSelectedPlace: (id: string) => void
  setLocation: (location: [number, number] | null) => void
  setOnline: (online: boolean) => void
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
  storageError: null,
  bootstrapped: false,
  setLanguage: (language) => {
    set({ language })
    void writeSetting('language', language).catch(() => set({ storageError: 'savingError' }))
  },
  setSelectedPlace: (selectedPlaceId) => set({ selectedPlaceId }),
  setLocation: (location) => set({ location }),
  setOnline: (online) => set({ online }),
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
      set({
        places: cachedPlaces.some((place) => placeOrder.has(place.id))
          ? cachedPlaces.filter((place) => placeOrder.has(place.id)).sort((first, second) => (placeOrder.get(first.id) ?? Number.MAX_SAFE_INTEGER) - (placeOrder.get(second.id) ?? Number.MAX_SAFE_INTEGER))
          : bundledPlaces,
        savedTours: tours.reverse(),
        offlineMap: offlineMap ?? null,
        language: languages.find((item) => item.code === selectedLanguage)?.code ?? 'vi',
        useOfflineMap: Boolean(offlineMode?.value && offlineMap),
        bootstrapped: true,
      })
    } catch {
      set({ storageError: 'savingError', bootstrapped: true })
    }
  },
  clearStorageError: () => set({ storageError: null }),
}))
