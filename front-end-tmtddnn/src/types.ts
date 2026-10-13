export type Language = 'vi' | 'en' | 'ja' | 'fr'
export type Category = 'landmark' | 'food' | 'craft' | 'rest'

export interface LocalizedCopy {
  title: string
  subtitle: string
  narration: string
}

export interface Place {
  id: string
  category: Category
  coordinates: [number, number]
  duration: number
  image: string
  copy: Record<Language, LocalizedCopy>
}

export interface SavedTour {
  id: string
  placeIds: string[]
  createdAt: number
  distanceKm: number
  durationMinutes: number
}

export interface OfflineMapPack {
  id: 'hoi-an'
  filename: string
  blob: Blob
  size: number
  installedAt: number
}
