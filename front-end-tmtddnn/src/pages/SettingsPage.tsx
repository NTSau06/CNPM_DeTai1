import { useRef, useState } from 'react'
import { ArrowDownToLine, Check, FileUp, Globe2, HardDrive, Info, Languages, MapPinned, Radio, Trash2, WifiOff } from 'lucide-react'
import { PMTiles } from 'pmtiles'
import { languages } from '../data/places'
import { translate } from '../i18n'
import { useAppStore } from '../store'
import type { OfflineMapPack } from '../types'

export function SettingsPage() {
  const language = useAppStore((state) => state.language)
  const offlineMap = useAppStore((state) => state.offlineMap)
  const useOfflineMap = useAppStore((state) => state.useOfflineMap)
  const installOfflineMap = useAppStore((state) => state.installOfflineMap)
  const removeOfflineMap = useAppStore((state) => state.removeOfflineMap)
  const setUseOfflineMap = useAppStore((state) => state.setUseOfflineMap)
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

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

  const mapPage = window.location.pathname === '/offline'
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
