// Chọn thông tin tham quan của địa điểm theo ngôn ngữ; thiếu bản dịch thì dùng tiếng Việt.
import type { Language } from '../../types'
import { placeVisitorDetails, type PlaceVisitorDetails } from '../placeDetails'
import { en } from './en'
import { es } from './es'
import { fr } from './fr'
import { ja } from './ja'
import { ko } from './ko'
import { zh } from './zh'

const translations: Record<Language, Record<string, PlaceVisitorDetails>> = {
  vi: placeVisitorDetails,
  en,
  ja,
  fr,
  'zh-CN': zh,
  'ko-KR': ko,
  es,
}

export type LocalizedVisitorDetails = PlaceVisitorDetails & { language: Language }

export function getVisitorDetails(placeId: string, language: Language): LocalizedVisitorDetails | undefined {
  const localized = translations[language]?.[placeId]
  if (localized) return { ...localized, language }
  const fallback = placeVisitorDetails[placeId]
  return fallback ? { ...fallback, language: 'vi' } : undefined
}
