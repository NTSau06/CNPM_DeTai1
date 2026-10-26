// Cấu hình ngôn ngữ và cài đặt/xóa bản đồ, nội dung địa điểm ngoại tuyến.
import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, Check, FileUp, Globe2, HardDrive, Info, Languages, MapPinned, Radio, Trash2, WifiOff } from 'lucide-react'
import { PMTiles } from 'pmtiles'
import { languages } from '../data/places'
import { deleteOfflinePlacePack, getOfflinePlacePacks, saveOfflinePlacePack } from '../db'
import { translate } from '../i18n'
import { getNarrationText } from '../speech'
import { useAppStore } from '../store'
import type { Language, OfflineMapPack, OfflinePlacePack } from '../types'

export function SettingsPage() {
  const language = useAppStore((state) => state.language)
  const places = useAppStore((state) => state.places)
  const offlineMap = useAppStore((state) => state.offlineMap)
  const useOfflineMap = useAppStore((state) => state.useOfflineMap)
  const installOfflineMap = useAppStore((state) => state.installOfflineMap)
  const removeOfflineMap = useAppStore((state) => state.removeOfflineMap)
  const setUseOfflineMap = useAppStore((state) => state.setUseOfflineMap)
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [offlinePacks, setOfflinePacks] = useState<OfflinePlacePack[]>([])
  const [packagePlaceId, setPackagePlaceId] = useState(places[0]?.id ?? '')
  const [packageLanguage, setPackageLanguage] = useState<Language>(language)
  const isVietnamese = language === 'vi'

  useEffect(() => {
    void getOfflinePlacePacks().then(setOfflinePacks).catch(() => setMessage(isVietnamese
      ? 'Không thể đọc các gói ngoại tuyến đã lưu.'
      : 'Could not read saved offline packages.'))
  }, [isVietnamese])

  const importMap = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setMessage(translate(language, 'preparing'))
    try {
      if (!file.name.toLowerCase().endsWith('.pmtiles')) throw new Error('Choose a .pmtiles file.')
      const signature = new TextDecoder().decode(await file.slice(0, 7).arrayBuffer())
      if (signature !== 'PMTiles') throw new Error('This file does not have a PMTiles header.')
      const url = URL.createObjectURL(file)
      try {
        const metadata = await new PMTiles(url).getMetadata()
        if (!hasVectorLayers(metadata)) {
          throw new Error('The archive does not contain vector layers.')
        }
      } finally {
        URL.revokeObjectURL(url)
      }
      const pack: OfflineMapPack = { id: 'hoi-an', filename: file.name, blob: file, size: file.size, installedAt: Date.now() }
      await installOfflineMap(pack)
      setMessage(translate(language, 'mapInstalled'))
    } catch {
      setMessage(translate(language, 'offlinePackError'))
    } finally {
      setBusy(false)
    }
  }

  const downloadPlacePackage = async () => {
    const place = places.find((item) => item.id === packagePlaceId)
    if (!place) {
      setMessage(isVietnamese ? 'Không tìm thấy địa điểm cần tải.' : 'The selected place could not be found.')
      return
    }
    setBusy(true)
    setMessage(isVietnamese ? 'Đang tải ảnh và chuẩn bị nội dung…' : 'Downloading the image and preparing content…')
    try {
      const response = await fetch(place.detailImage.src)
      if (!response.ok) throw new Error(`Image request failed (${response.status}).`)
      const image = await response.blob()
      if (image.size === 0) throw new Error('The downloaded place image is empty.')
      const copy = place.copy[packageLanguage] ?? place.copy.vi
      const textBytes = new TextEncoder().encode([
        copy.title,
        copy.subtitle,
        copy.narration,
        ...place.detailSections.flatMap((section) => [section.heading, section.body]),
      ].join('\n')).byteLength
      const size = image.size + textBytes
      const estimate = await navigator.storage?.estimate()
      if (estimate?.quota && estimate.usage !== undefined && estimate.usage + size > estimate.quota * 0.95) {
        throw new Error(isVietnamese ? 'Thiết bị không còn đủ dung lượng lưu gói.' : 'There is not enough device storage for this package.')
      }
      const pack: OfflinePlacePack = {
        id: `${place.id}:${packageLanguage}`,
        placeId: place.id,
        language: packageLanguage,
        title: copy.title,
        subtitle: copy.subtitle,
        narration: getNarrationText(place, packageLanguage),
        sections: place.detailSections,
        image,
        imageType: image.type || 'application/octet-stream',
        size,
        savedAt: Date.now(),
      }
      await saveOfflinePlacePack(pack)
      setOfflinePacks(await getOfflinePlacePacks())
      setMessage(isVietnamese ? 'Gói địa điểm đã sẵn sàng khi ngoại tuyến.' : 'The place package is ready for offline use.')
    } catch (error) {
      setMessage(error instanceof Error
        ? `${isVietnamese ? 'Không tải được gói ngoại tuyến' : 'Could not download the offline package'}: ${error.message}`
        : isVietnamese ? 'Không tải được gói ngoại tuyến.' : 'Could not download the offline package.')
    } finally {
      setBusy(false)
    }
  }

  const removePlacePackage = async (id: string) => {
    try {
      await deleteOfflinePlacePack(id)
      setOfflinePacks(await getOfflinePlacePacks())
      setMessage(isVietnamese ? 'Đã gỡ gói ngoại tuyến.' : 'Offline package removed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove the offline package.')
    }
  }

  const mapPage = window.location.pathname === `${import.meta.env.BASE_URL}offline`
  return (
    <div className="subpage settings-page">
      <div className="subpage-heading">
        <div className="eyebrow"><span className="eyebrow-line" /> {mapPage ? 'PACK LIGHT, WANDER FAR' : 'A FEW THINGS BEFORE YOU GO'}</div>
        <h1>{translate(language, mapPage ? 'offlineTitle' : 'settingsTitle')}</h1>
        <p>{mapPage ? translate(language, 'offlineDescription') : translate(language, 'introduction')}</p>
      </div>

      <div className="settings-grid">
        <section className="setting-card offline-card">
          <div className="setting-card-heading"><div className="setting-icon"><MapPinned size={20} /></div><span className="setting-tag"><WifiOff size={12} /> OFFLINE READY</span></div>
          <h2>{translate(language, 'offlineTitle')}</h2>
          <p>{translate(language, 'offlineDescription')}</p>
          {offlineMap ? (
            <div className="installed-map">
              <span className="installed-check"><Check size={16} /></span>
              <span><strong>{offlineMap.filename}</strong><small>{formatBytes(offlineMap.size)} · {new Date(offlineMap.installedAt).toLocaleDateString()}</small></span>
              <button onClick={() => { void removeOfflineMap(); setMessage('') }} aria-label={translate(language, 'removeOfflineMap')}><Trash2 size={15} /></button>
            </div>
          ) : <div className="install-helper"><Info size={15} />{translate(language, 'installHelp')}</div>}
          <input ref={input} type="file" accept=".pmtiles,application/octet-stream" className="sr-only" onChange={(event) => { void importMap(event.target.files?.[0]); event.currentTarget.value = '' }} />
          <button className="setting-primary-button" onClick={() => input.current?.click()} disabled={busy}>
            <FileUp size={16} /> {translate(language, offlineMap ? 'chooseMap' : 'installMap')}
          </button>
          {offlineMap && <button className="setting-secondary-button" onClick={() => setUseOfflineMap(!useOfflineMap)}>{useOfflineMap ? translate(language, 'onlineMap') : translate(language, 'useOffline')}</button>}
          {message && <p className={`setting-feedback${message === translate(language, 'offlinePackError') ? ' error' : ''}`} role="status">{message}</p>}
        </section>

        <section className="setting-card setting-card-wide place-package-card">
          <div className="setting-card-heading"><div className="setting-icon"><ArrowDownToLine size={20} /></div><span className="setting-tag">{isVietnamese ? 'LƯU TRÊN THIẾT BỊ' : 'SAVED ON THIS DEVICE'}</span></div>
          <h2>{isVietnamese ? 'Gói địa điểm ngoại tuyến' : 'Offline place packages'}</h2>
          <p>{isVietnamese
            ? 'Tải nội dung thuyết minh, câu chuyện và ảnh của một điểm đến theo ngôn ngữ đã chọn. Khi mất mạng, dùng giọng đọc TTS có sẵn trên thiết bị.'
            : 'Download a place narration, story, and image for a selected language. Offline speech uses a voice already available on your device.'}</p>
          <div className="place-package-form">
            <label>
              <span>{isVietnamese ? 'Địa điểm' : 'Place'}</span>
              <select value={packagePlaceId} onChange={(event) => setPackagePlaceId(event.target.value)}>
                {places.map((place) => <option key={place.id} value={place.id}>{place.copy[language].title}</option>)}
              </select>
            </label>
            <label>
              <span>{isVietnamese ? 'Ngôn ngữ' : 'Language'}</span>
              <select value={packageLanguage} onChange={(event) => setPackageLanguage(event.target.value as Language)}>
                {languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
            <button className="setting-primary-button" type="button" onClick={() => void downloadPlacePackage()} disabled={busy || !packagePlaceId}>
              <ArrowDownToLine size={16} /> {busy ? (isVietnamese ? 'Đang tải…' : 'Downloading…') : (isVietnamese ? 'Tải gói ngoại tuyến' : 'Download package')}
            </button>
          </div>
          <p className="experience-note">{isVietnamese
            ? 'Giọng đọc là TTS của trình duyệt/thiết bị, không phải tệp MP3. Hãy kiểm tra trước rằng giọng và ngôn ngữ mong muốn đã có sẵn để dùng khi ngoại tuyến.'
            : 'Speech is generated by your browser/device, not stored as an MP3. Check that the required voice is installed for offline use.'}</p>
          {offlinePacks.length > 0 && (
            <div className="offline-package-list">
              {offlinePacks.map((pack) => (
                <div className="installed-map" key={pack.id}>
                  <span className="installed-check"><Check size={16} /></span>
                  <span><strong>{pack.title}</strong><small>{pack.language} · {formatBytes(pack.size)} · {new Date(pack.savedAt).toLocaleDateString()}</small></span>
                  <button type="button" onClick={() => void removePlacePackage(pack.id)} aria-label={isVietnamese ? `Gỡ gói ${pack.title}` : `Remove ${pack.title} package`}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
          {message && <p className="setting-feedback" role="status">{message}</p>}
        </section>

        <section className="setting-card">
          <div className="setting-card-heading"><div className="setting-icon"><Languages size={20} /></div><span className="setting-tag">{languages.length} LANGUAGES</span></div>
          <h2>{translate(language, 'language')}</h2>
          <p>{translate(language, 'speechDescription')}</p>
          <div className="language-cards">
            {languages.map((item) => (
              <button key={item.code} className={`language-card${language === item.code ? ' selected' : ''}`} onClick={() => useAppStore.getState().setLanguage(item.code)}>
                <span>{item.native}</span><strong>{item.label}</strong>{language === item.code && <Check size={14} />}
              </button>
            ))}
          </div>
        </section>

        <section className="setting-card setting-card-wide">
          <div className="setting-card-heading"><div className="setting-icon"><HardDrive size={20} /></div><span className="setting-tag">SAVED ON DEVICE</span></div>
          <h2>{translate(language, 'cacheTitle')}</h2>
          <p>{translate(language, 'cacheDescription')}</p>
          <div className="offline-data-items">
            <div><span className="data-item-icon"><MapPinned size={16} /></span><span><strong>Quang Tri &amp; Quang Binh</strong><small>Stories in {languages.length} languages</small></span><span className="data-ready">READY</span></div>
            <div><span className="data-item-icon"><ArrowDownToLine size={16} /></span><span><strong>Saved walks</strong><small>Stored privately on this device</small></span><span className="data-ready">READY</span></div>
            <div><span className="data-item-icon"><Radio size={16} /></span><span><strong>Voice narration</strong><small>{translate(language, 'speechDescription')}</small></span><span className="data-optional">DEVICE VOICE</span></div>
          </div>
        </section>

        <section className="setting-card device-note">
          <Globe2 size={20} />
          <div><strong>Đi nhẹ, ở lâu.</strong><p>Xin phép trước khi chụp ảnh, hỏi giá trước khi mua và mang rác theo mình.</p></div>
        </section>
      </div>
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function hasVectorLayers(metadata: unknown): boolean {
  if (typeof metadata !== 'object' || metadata === null || !('vector_layers' in metadata) || !Array.isArray(metadata.vector_layers)) return false
  return metadata.vector_layers.some(
    (layer) => typeof layer === 'object' && layer !== null && 'id' in layer && typeof layer.id === 'string',
  )
}
