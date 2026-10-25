import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import type { Language, Place } from '../types'

const copy = {
  vi: {
    title: 'Gợi ý ứng xử theo thời điểm',
    morning: 'Buổi sáng: dành thời gian đọc thông tin tại di tích, đi nhẹ và giữ không gian yên tĩnh.',
    afternoon: 'Buổi chiều: tham quan theo lối quy định, tránh làm ảnh hưởng người đang tưởng niệm.',
    evening: 'Buổi tối: nếu khu di tích còn mở cửa, giữ thái độ trang nghiêm và làm theo hướng dẫn tại chỗ.',
    note: 'Đây là gợi ý ứng xử chung, không phải lịch tổ chức nghi lễ. Giờ mở cửa và sự kiện cần được xác nhận với đơn vị quản lý.',
  },
  en: {
    title: 'Respectful visit suggestions',
    morning: 'Morning: take time to read the site information, walk quietly, and keep the space peaceful.',
    afternoon: 'Afternoon: follow marked paths and avoid disturbing people who are paying their respects.',
    evening: 'Evening: if the site is open, remain respectful and follow on-site guidance.',
    note: 'General etiquette only—not a ceremony schedule. Confirm opening hours and events with the site operator.',
  },
} satisfies Record<'vi' | 'en', Record<string, string>>

export function RitualGuidancePanel({ place, language }: { place: Place; language: Language }) {
  const [hour, setHour] = useState(getVietnamHour)

  useEffect(() => {
    const timer = window.setInterval(() => setHour(getVietnamHour()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  if (place.id !== 'quang-tri-citadel') return null
  const text = copy[language === 'vi' ? 'vi' : 'en']
  const suggestion = hour < 11 ? text.morning : hour < 17 ? text.afternoon : text.evening

  return (
    <section className="experience-grid">
      <section className="experience-card ritual-card">
        <div className="experience-heading"><Clock3 size={17} /><h2>{text.title}</h2></div>
        <p>{suggestion}</p>
        <p className="experience-note">{text.note}</p>
      </section>
    </section>
  )
}

function getVietnamHour() {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date()))
}
