import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { OfflineMapPack, Place, SavedTour } from './types'

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
}

let database: Promise<IDBPDatabase<HoiAnDatabase>> | undefined

const getDatabase = () => {
  database ??= openDB<HoiAnDatabase>('cham-hoi-an', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('places')) db.createObjectStore('places', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('tours')) {
        const tours = db.createObjectStore('tours', { keyPath: 'id' })
        tours.createIndex('by-created-at', 'createdAt')
      }
      if (!db.objectStoreNames.contains('offlineMaps')) db.createObjectStore('offlineMaps', { keyPath: 'id' })
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
