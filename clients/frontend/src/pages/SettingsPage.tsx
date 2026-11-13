// Cấu hình ngôn ngữ và cài đặt/xóa bản đồ, nội dung địa điểm ngoại tuyến.
import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, Check, FileUp, Globe2, HardDrive, Info, Languages, MapPinned, Radio, Trash2, WifiOff } from 'lucide-react'
import { PMTiles } from 'pmtiles'
import { languages } from '../data/places'
import { deleteOfflinePlacePack, getOfflinePlacePacks, saveOfflinePlacePack } from '../db'
import { translate } from '../i18n'
import { localeOf, ui } from '../uiText'
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
  useEffect(() => {
    void getOfflinePlacePacks().then(setOfflinePacks).catch(() => setMessage(ui(language, 'stReadPacksError')))
  }, [language])

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
      setMessage(ui(language, 'stPlaceNotFound'))
      return
    }
    setBusy(true)
    setMessage(ui(language, 'stPreparing'))
    try {
      const response = await fetch(place.detailImage.src)
      if (!response.ok) throw new Error(`Image request failed (${response.status}).`)
      const image = await response.blob()
      if (image.size === 0) throw new Error('The downloaded place image is empty.')
      const copy = place.copy[packageLanguage] ?? place.copy.vi
      const textBytes = new TextEncoder().encode([
        copy.title,
        copy.subtitle,
          getNarrationText(place, packageLanguage),
        ...place.detailSections.flatMap((section) => [section.heading, section.body]),
      ].join('\n')).byteLength
      const size = image.size + textBytes
      const estimate = await navigator.storage?.estimate()
      if (estimate?.quota && estimate.usage !== undefined && estimate.usage + size > estimate.quota * 0.95) {
        throw new Error(ui(language, 'stNoStorage'))
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
      setMessage(ui(language, 'stPackReady'))
    } catch (error) {
      setMessage(error instanceof Error
        ? `${ui(language, 'stPackError')}: ${error.message}`
        : `${ui(language, 'stPackError')}.`)
    } finally {
      setBusy(false)
    }
  }

  const removePlacePackage = async (id: string) => {
    try {
      await deleteOfflinePlacePack(id)
      setOfflinePacks(await getOfflinePlacePacks())
      setMessage(ui(language, 'stPackRemoved'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove the offline package.')
    }
  }

  const mapPage = window.location.pathname === `${import.meta.env.BASE_URL}offline`
  return (
    <div className="subpage settings-page">
      <div className="subpage-heading">
        <div className="eyebrow"><span className="eyebrow-line" /> {ui(language, mapPage ? 'stEyebrowMap' : 'stEyebrowSettings')}</div>
        <h1>{translate(language, mapPage ? 'offlineTitle' : 'settingsTitle')}</h1>
        <p>{mapPage ? translate(language, 'offlineDescription') : translate(language, 'introduction')}</p>
      </div>

      <div className="settings-grid">
        <section className="setting-card offline-card">
          <div className="setting-card-heading"><div className="setting-icon"><MapPinned size={20} /></div><span className="setting-tag"><WifiOff size={12} /> {ui(language, 'stOfflineReady')}</span></div>
          <h2>{translate(language, 'offlineTitle')}</h2>
          <p>{translate(language, 'offlineDescription')}</p>
          {offlineMap ? (
            <div className="installed-map">
              <span className="installed-check"><Check size={16} /></span>
              <span><strong>{offlineMap.filename}</strong><small>{formatBytes(offlineMap.size)} · {new Date(offlineMap.installedAt).toLocaleDateString(localeOf(language))}</small></span>
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
          <div className="setting-card-heading"><div className="setting-icon"><ArrowDownToLine size={20} /></div><span className="setting-tag">{ui(language, 'stSavedOnDevice')}</span></div>
          <h2>{ui(language, 'stPacksTitle')}</h2>
          <p>{ui(language, 'stPacksText')}</p>
          <div className="place-package-form">
            <label>
              <span>{ui(language, 'stPlace')}</span>
              <select value={packagePlaceId} onChange={(event) => setPackagePlaceId(event.target.value)}>
                {places.map((place) => <option key={place.id} value={place.id}>{place.copy[language].title}</option>)}
              </select>
            </label>
            <label>
              <span>{ui(language, 'stLanguage')}</span>
              <select value={packageLanguage} onChange={(event) => setPackageLanguage(event.target.value as Language)}>
                {languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
            <button className="setting-primary-button" type="button" onClick={() => void downloadPlacePackage()} disabled={busy || !packagePlaceId}>
              <ArrowDownToLine size={16} /> {ui(language, busy ? 'stDownloading' : 'stDownload')}
            </button>
          </div>
          <p className="experience-note">{ui(language, 'stVoiceNote')}</p>
          {offlinePacks.length > 0 && (
            <div className="offline-package-list">
              {offlinePacks.map((pack) => (
                <div className="installed-map" key={pack.id}>
                  <span className="installed-check"><Check size={16} /></span>
                  <span><strong>{pack.title}</strong><small>{pack.language} · {formatBytes(pack.size)} · {new Date(pack.savedAt).toLocaleDateString(localeOf(language))}</small></span>
                  <button type="button" onClick={() => void removePlacePackage(pack.id)} aria-label={ui(language, 'stRemovePack', { name: pack.title })}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
          {message && <p className="setting-feedback" role="status">{message}</p>}
        </section>

        <section className="setting-card">
          <div className="setting-card-heading"><div className="setting-icon"><Languages size={20} /></div><span className="setting-tag">{ui(language, 'stLanguagesTag', { n: languages.length })}</span></div>
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
          <div className="setting-card-heading"><div className="setting-icon"><HardDrive size={20} /></div><span className="setting-tag">{ui(language, 'stSavedOnDevice')}</span></div>
          <h2>{translate(language, 'cacheTitle')}</h2>
          <p>{translate(language, 'cacheDescription')}</p>
          <div className="offline-data-items">
            <div><span className="data-item-icon"><MapPinned size={16} /></span><span><strong>{ui(language, 'regionName')}</strong><small>{ui(language, 'stStoriesIn', { n: languages.length })}</small></span><span className="data-ready">{ui(language, 'stReady')}</span></div>
            <div><span className="data-item-icon"><ArrowDownToLine size={16} /></span><span><strong>{translate(language, 'saved')}</strong><small>{ui(language, 'stStoredPrivately')}</small></span><span className="data-ready">{ui(language, 'stReady')}</span></div>
            <div><span className="data-item-icon"><Radio size={16} /></span><span><strong>{ui(language, 'stVoiceNarration')}</strong><small>{translate(language, 'speechDescription')}</small></span><span className="data-optional">{ui(language, 'stDeviceVoice')}</span></div>
          </div>
        </section>

        <section className="setting-card device-note">
          <Globe2 size={20} />
          <div><strong>{ui(language, 'stTipTitle')}</strong><p>{ui(language, 'stTipText')}</p></div>
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
