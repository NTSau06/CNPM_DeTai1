// Chọn gợi ý ứng xử tại Thành cổ theo giờ Việt Nam và ngôn ngữ giao diện.
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
  ja: {
    title: '時間帯別の参拝マナー',
    morning: '朝：史跡の案内をゆっくり読み、静かに歩いて落ち着いた雰囲気を保ちましょう。',
    afternoon: '午後：指定の順路に沿って見学し、追悼している人の妨げにならないようにしましょう。',
    evening: '夜：開場している場合は厳粛な態度を保ち、現地の案内に従いましょう。',
    note: '一般的なマナーの目安であり、式典の予定表ではありません。開場時間や行事は管理者にご確認ください。',
  },
  fr: {
    title: 'Conseils de visite selon l’heure',
    morning: 'Matin : prenez le temps de lire les informations du site, marchez calmement et préservez le silence.',
    afternoon: 'Après-midi : suivez les chemins balisés et ne dérangez pas les personnes qui se recueillent.',
    evening: 'Soir : si le site est ouvert, restez respectueux et suivez les consignes sur place.',
    note: 'Conseils généraux, pas un programme de cérémonies. Vérifiez les horaires et les événements auprès du gestionnaire du site.',
  },
  'zh-CN': {
    title: '分时段参观礼仪',
    morning: '上午：请花时间阅读遗址介绍，轻声慢行，保持环境安静。',
    afternoon: '下午：请沿规定路线参观，避免打扰正在悼念的人。',
    evening: '晚上：如遗址仍开放，请保持庄重并遵从现场指引。',
    note: '以上为一般礼仪建议，并非仪式日程。开放时间和活动请向管理单位确认。',
  },
  'ko-KR': {
    title: '시간대별 관람 예절',
    morning: '오전: 유적 안내문을 천천히 읽고 조용히 걸으며 차분한 분위기를 지켜 주세요.',
    afternoon: '오후: 지정된 관람로를 따르고 추모 중인 사람들을 방해하지 마세요.',
    evening: '저녁: 유적지가 개방되어 있다면 엄숙한 태도를 유지하고 현장 안내를 따르세요.',
    note: '일반적인 예절 안내이며 의식 일정이 아닙니다. 개방 시간과 행사는 관리 기관에 확인하세요.',
  },
  es: {
    title: 'Sugerencias de visita según la hora',
    morning: 'Mañana: tómate tiempo para leer la información del sitio, camina en silencio y mantén la calma del lugar.',
    afternoon: 'Tarde: sigue los caminos señalizados y no molestes a quienes rinden homenaje.',
    evening: 'Noche: si el sitio está abierto, mantén una actitud respetuosa y sigue las indicaciones del lugar.',
    note: 'Solo es una guía de etiqueta general, no un calendario de ceremonias. Confirma horarios y eventos con el gestor del sitio.',
  },
} satisfies Record<Language, Record<string, string>>

export function RitualGuidancePanel({ place, language }: { place: Place; language: Language }) {
  const [hour, setHour] = useState(getVietnamHour)

  useEffect(() => {
    const timer = window.setInterval(() => setHour(getVietnamHour()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  if (place.id !== 'quang-tri-citadel') return null
  const text = copy[language] ?? copy.vi
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
