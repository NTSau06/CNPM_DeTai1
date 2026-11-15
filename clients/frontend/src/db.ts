// Đọc và ghi dữ liệu ứng dụng cục bộ bằng IndexedDB, kể cả gói ngoại tuyến.
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
  database ??= openDB<HoiAnDatabase>('cham-hoi-an', 3, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (!db.objectStoreNames.contains('places')) db.createObjectStore('places', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('tours')) {
        const tours = db.createObjectStore('tours', { keyPath: 'id' })
        tours.createIndex('by-created-at', 'createdAt')
      }
      if (oldVersion < 3 && db.objectStoreNames.contains('tours')) {
        void (async () => {
          let cursor = await transaction.objectStore('tours').openCursor()
          while (cursor) {
            const { ownerId, ...tour } = cursor.value as SavedTour & { ownerId?: string }
            await cursor.update({ ...tour, ...(!tour.userId && ownerId ? { userId: ownerId } : {}) })
            cursor = await cursor.continue()
          }
        })()
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
  const tx = db.transaction(['places', 'settings'], 'readwrite')
  const store = tx.objectStore('places')
  // Bỏ lần nạp mẫu cũ nếu danh mục server đã được ghi trước đó.
  if ((await tx.objectStore('settings').get('catalogSynced'))?.value) {
    await tx.done
    return
  }
  // Dữ liệu mẫu chỉ bổ sung ID thiếu, không ghi đè nội dung admin đã sửa.
  for (const place of places) {
    if (!await store.get(place.id)) await store.add(place)
  }
  await tx.done
}

export async function getCachedPlaces() {
  return (await getDatabase()).getAll('places')
}

export async function replaceCachedPlaces(places: Place[], isCurrent = () => true) {
  const tx = (await getDatabase()).transaction(['places', 'settings'], 'readwrite')
  const store = tx.objectStore('places')
  // Chờ transaction sẵn sàng rồi bỏ phản hồi đã bị thay thế.
  await tx.objectStore('settings').get('catalogSynced')
  if (!isCurrent()) {
    await tx.done
    return
  }
  try {
    await store.clear()
    await Promise.all(places.map((place) => store.put(place)))
    // Ghi cùng danh mục để lần khởi động sau không phục hồi điểm đã xoá.
    await tx.objectStore('settings').put({ key: 'catalogSynced', value: true })
    if (!isCurrent()) {
      tx.abort()
      await tx.done.catch(() => undefined)
      return
    }
    await tx.done
  } catch (error) {
    // Lỗi dữ liệu đồng bộ cũng phải huỷ clear, kể cả lỗi put đồng bộ.
    try { tx.abort() } catch { /* Transaction có thể đã tự huỷ. */ }
    await tx.done.catch(() => undefined)
    throw error
  }
}

export function sortTours(tours: SavedTour[]) {
  return [...tours].sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
}

export async function replaceUserTours(userId: string, tours: SavedTour[], isCurrent = () => true) {
  const tx = (await getDatabase()).transaction('tours', 'readwrite')
  const cachedTours = await tx.store.getAll()
  if (!isCurrent()) {
    await tx.done
    return
  }
  // Thay danh sách của đúng tài khoản, giữ nguyên hành trình của tài khoản khác.
  const tourIds = new Set(tours.map((tour) => tour.id))
  await Promise.all([
    ...cachedTours.filter((tour) => tour.userId === userId && !tourIds.has(tour.id))
      .map((tour) => tx.store.delete(tour.id)),
    ...tours.map((tour) => tx.store.put({ ...tour, userId })),
  ])
  await tx.done
}

export async function deleteSetting(key: string) {
  await (await getDatabase()).delete('settings', key)
}

export async function readSetting(key: string) {
  return (await getDatabase()).get('settings', key)
}

export async function writeSetting(key: string, value: string | boolean) {
  await (await getDatabase()).put('settings', { key, value })
}

export async function getSavedTours() {
  return sortTours(await (await getDatabase()).getAllFromIndex('tours', 'by-created-at'))
}

export async function getSavedToursByUser(userId: string) {
  return sortTours((await getSavedTours()).filter((tour) => tour.userId === userId))
}

export async function clearToursOfUser(userId: string) {
  const tx = (await getDatabase()).transaction('tours', 'readwrite')
  const tours = await tx.store.getAll()
  await Promise.all(tours.filter((tour) => tour.userId === userId).map((tour) => tx.store.delete(tour.id)))
  await tx.done
}

export async function saveTour(tour: SavedTour, userId: string) {
  await (await getDatabase()).put('tours', { ...tour, userId })
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
