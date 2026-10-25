import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { OfflineMapPack, OfflinePlacePack, Place, SavedTour } from './types'

interface HoiAnDatabase extends DBSchema {
  places: {
    key: string
    value: Place
  }
  settings: {
    key: string
    value: { key: string; value: string | boolean }
  }
  tours: {
    key: string
    value: SavedTour
    indexes: { 'by-created-at': number }
  }
  offlineMaps: {
    key: 'hoi-an'
    value: OfflineMapPack
  }
  offlinePlacePacks: {
    key: string
    value: OfflinePlacePack
    indexes: { 'by-place': string }
  }
}

let database: Promise<IDBPDatabase<HoiAnDatabase>> | undefined

const getDatabase = () => {
  database ??= openDB<HoiAnDatabase>('cham-hoi-an', 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('places')) db.createObjectStore('places', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('tours')) {
        const tours = db.createObjectStore('tours', { keyPath: 'id' })
        tours.createIndex('by-created-at', 'createdAt')
      }
      if (!db.objectStoreNames.contains('offlineMaps')) db.createObjectStore('offlineMaps', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('offlinePlacePacks')) {
        const packs = db.createObjectStore('offlinePlacePacks', { keyPath: 'id' })
        packs.createIndex('by-place', 'placeId')
      }
    },
  })
  return database
}

export async function cachePlaces(places: Place[]) {
  const db = await getDatabase()
  const tx = db.transaction('places', 'readwrite')
  await Promise.all([...places.map((place) => tx.store.put(place)), tx.done])
}

export async function getCachedPlaces() {
  return (await getDatabase()).getAll('places')
}

export async function readSetting(key: string) {
  return (await getDatabase()).get('settings', key)
}

export async function writeSetting(key: string, value: string | boolean) {
  await (await getDatabase()).put('settings', { key, value })
}

export async function getSavedTours() {
  return (await getDatabase()).getAllFromIndex('tours', 'by-created-at')
}

export async function saveTour(tour: SavedTour) {
  await (await getDatabase()).put('tours', tour)
}

export async function deleteTour(id: string) {
  await (await getDatabase()).delete('tours', id)
}

export async function getOfflineMap() {
  return (await getDatabase()).get('offlineMaps', 'hoi-an')
}

export async function saveOfflineMap(pack: OfflineMapPack) {
  await (await getDatabase()).put('offlineMaps', pack)
}

export async function deleteOfflineMap() {
  await (await getDatabase()).delete('offlineMaps', 'hoi-an')
}

export async function getOfflinePlacePacks() {
  return (await getDatabase()).getAll('offlinePlacePacks')
}

export async function getOfflinePlacePack(placeId: string, language: OfflinePlacePack['language']) {
  return (await getDatabase()).get('offlinePlacePacks', `${placeId}:${language}`)
}

export async function saveOfflinePlacePack(pack: OfflinePlacePack) {
  await (await getDatabase()).put('offlinePlacePacks', pack)
}

export async function deleteOfflinePlacePack(id: string) {
  await (await getDatabase()).delete('offlinePlacePacks', id)
}
