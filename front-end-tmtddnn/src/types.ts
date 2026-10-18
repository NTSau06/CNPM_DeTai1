export type Language = 'vi' | 'en' | 'ja' | 'fr' | 'zh-CN' | 'ko-KR' | 'es'
export type Category = 'landmark' | 'food' | 'craft' | 'rest'

export interface LocalizedCopy {
  title: string
  subtitle: string
  narration: string
}

export interface PlaceDetailSection {
  heading: string
  body: string
}

export interface PlaceDetailImage {
  src: string
  alt: string
  caption: string
}

export interface Place {
  id: string
  category: Category
  coordinates: [number, number]
  duration: number
  image: string
  copy: Record<Language, LocalizedCopy>
  detailSections: PlaceDetailSection[]
  detailImage: PlaceDetailImage
}

export interface SavedTour {
  id: string
  placeIds: string[]
  createdAt: number
  distanceKm: number
  durationMinutes: number
}

export interface UserProfile {
  fullName: string
  email: string
  phone: string
  birthDate: string
  gender: 'female' | 'male' | 'other' | 'prefer-not-to-say' | ''
  address: string
}

export interface OfflineMapPack {
  id: 'hoi-an'
  filename: string
  blob: Blob
  size: number
  installedAt: number
}
