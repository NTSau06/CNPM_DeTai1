// Kiểm tra luồng store với API và bộ nhớ mô phỏng, không cần tài khoản thật.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const ts = require(path.join(root, 'clients/frontend/node_modules/typescript'))
const create = require(path.join(root, 'clients/frontend/node_modules/zustand/vanilla')).createStore
const turf = require(path.join(root, 'clients/frontend/node_modules/@turf/turf'))
const source = fs.readFileSync(path.join(root, 'clients/frontend/src/store.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const dbCompiled = ts.transpileModule(fs.readFileSync(path.join(root, 'clients/frontend/src/db.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const user = { id: 'a', fullName: 'A' }
const tour = { id: 'tour-a', ownerId: 'a', placeIds: ['one', 'two'], createdAt: 1, distanceKm: 2, durationMinutes: 3 }
class BackendApiError extends Error { constructor(status) { super('API'); this.status = status } }
function tourCache(initial) {
  const items = new Map(initial.map(t => [t.id, t]))
  let pauseRead = false, resumeRead
  const put = async (_, tour) => { items.set(tour.id, tour) }
  const remove = async (_, id) => { items.delete(id) }
  const database = {
    getAllFromIndex: async () => [...items.values()].sort((a, b) => a.createdAt - b.createdAt),
    put, delete: remove,
    transaction: () => ({ done: Promise.resolve(), store: {
      getAll: async () => {
        const snapshot = [...items.values()]
        if (pauseRead) { pauseRead = false; await new Promise(resolve => { resumeRead = resolve }) }
        return snapshot
      },
      put: tour => put('tours', tour), delete: id => remove('tours', id),
    } }),
  }
  const exports = {}
  vm.runInNewContext(dbCompiled, { exports, require: () => ({ openDB: async () => database }) })
  return { api: exports, items: () => [...items.values()], pause: () => { pauseRead = true }, resume: () => resumeRead() }
}
function setup({ online = false, status, cachedToken = 'token-a' } = {}) {
  const local = new Map([['token', 'token-a'], ['quang-tri:draft-tour:a', tour.id]])
  const settings = new Map([['currentUser', JSON.stringify({ authToken: cachedToken, user })]])
  const cache = tourCache([tour, { ...tour, id: 'tour-b', ownerId: 'b' }, { ...tour, id: 'legacy', ownerId: undefined }])
  let remote = [tour]
  const navigator = { onLine: online }
  const db = {
    ...cache.api,
    readSetting: async key => settings.has(key) ? { value: settings.get(key) } : undefined,
    writeSetting: async (key, value) => { settings.set(key, value) },
    deleteSetting: async key => { settings.delete(key) },
    getCachedPlaces: async () => [], getOfflineMap: async () => null,
    cachePlaces: async () => {}, replaceCachedPlaces: async () => {},
  }
  const api = {
    BackendApiError, getStoredAuthToken: () => local.get('token') ?? null,
    storeAuthToken: token => token ? local.set('token', token) : local.delete('token'),
    fetchPlaces: async () => { if (status !== undefined) throw new BackendApiError(status); return [] },
    fetchCurrentUser: async () => { if (status !== undefined) throw new BackendApiError(status); return user },
    fetchTours: async () => remote, mergeRemotePlaces: local => local,
    logoutAccount: async () => {}, updateProfile: async (_, profile) => profile,
    generateId: () => 'new-tour', createTour: async item => item,
    deleteRemoteTour: async () => { if (status !== undefined) throw new BackendApiError(status) },
  }
  const exports = {}
  const context = { exports, navigator, localStorage: { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key) },
    require: name => ({ zustand: { create }, './db': db, './api': api, '@turf/turf': turf, './data/places': { places: [], languages: [{ code: 'vi' }] } })[name] }
  vm.runInNewContext(compiled, context)
  return { store: exports.useAppStore, settings, local, navigator, api, cache, tours: cache.items, remote: items => { remote = items } }
}
async function run() {
  let x = setup()
  await x.store.getState().bootstrap()
  assert.equal(x.store.getState().currentUser.id, 'a')
  assert.equal(x.store.getState().savedTours.length, 1)
  assert.equal(x.store.getState().activeTourId, tour.id)
  assert.deepEqual(Array.from(x.store.getState().routeIds), ['one', 'two'])
  await x.store.getState().setRoutePlace('three')
  assert.equal(x.store.getState().storageError, 'routeOffline')
  await x.store.getState().setRouteOrder(['two', 'one'])
  assert.equal(x.store.getState().storageError, 'routeOffline')
  await x.store.getState().removeTour(tour.id)
  assert.equal(x.store.getState().savedTours.length, 1)
  assert.equal(x.store.getState().storageError, 'routeOffline')
  console.log('PASS: offline reload, owner filtering, draft and blocked edits/deletion')

  x = setup({ online: true, status: 0 })
  await x.store.getState().bootstrap()
  assert.equal(x.local.get('token'), 'token-a')
  assert.equal(x.store.getState().savedTours.length, 1)
  await x.store.getState().removeTour(tour.id)
  assert.equal(x.store.getState().storageError, 'routeOffline')
  console.log('PASS: network failure with navigator online retains session/cache')

  x = setup({ online: true, status: 401 })
  await x.store.getState().bootstrap()
  assert.equal(x.local.has('token'), false)
  assert.equal(x.settings.has('currentUser'), false)
  assert.equal(x.store.getState().savedTours.length, 0)
  console.log('PASS: 401 clears session/profile/tours')

  x = setup({ cachedToken: 'other-token' })
  await x.store.getState().bootstrap()
  assert.equal(x.store.getState().currentUser, null)
  assert.equal(x.store.getState().savedTours.length, 0)
  console.log('PASS: mismatched cached session is ignored')

  x = setup()
  await x.store.getState().bootstrap()
  x.navigator.onLine = true
  x.remote([])
  x.store.getState().setOnline(true)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(x.store.getState().savedTours.length, 0)
  assert.equal(x.tours().some(t => t.ownerId === 'a'), false)
  assert.equal(x.tours().some(t => t.ownerId === 'b'), true)
  console.log('PASS: reconnect replaces only current owner cache')

  x = setup()
  await x.store.getState().bootstrap()
  await x.store.getState().signOut()
  assert.equal(x.settings.has('currentUser'), false)
  assert.equal(x.store.getState().savedTours.length, 0)
  await x.store.getState().signIn('token-b', { id: 'b', fullName: 'B' })
  await x.store.getState().bootstrap()
  assert.equal(x.store.getState().savedTours.length, 1)
  assert.equal(x.store.getState().savedTours[0].ownerId, 'b')
  console.log('PASS: sign out and switch account cannot expose prior tours')

  x = setup({ online: true })
  await x.store.getState().bootstrap()
  let finish
  x.api.deleteRemoteTour = () => new Promise(resolve => { finish = resolve })
  const pending = x.store.getState().removeTour(tour.id)
  await x.store.getState().signOut()
  x.navigator.onLine = false
  await x.store.getState().signIn('token-b', { id: 'b' })
  x.store.setState({ savedTours: [{ ...tour, id: 'tour-b', ownerId: 'b' }], activeTourId: 'tour-b', routeIds: ['b'] })
  finish()
  await pending
  assert.equal(x.store.getState().activeTourId, 'tour-b')
  assert.equal(x.store.getState().savedTours[0].ownerId, 'b')
  console.log('PASS: delayed delete cannot change the next account state')

  x = setup({ online: true })
  await x.store.getState().bootstrap()
  x.api.fetchTours = () => new Promise(resolve => { finish = resolve })
  const staleSync = x.store.getState().syncTours()
  await x.store.getState().removeTour(tour.id)
  finish([tour])
  await staleSync
  assert.equal(x.store.getState().savedTours.length, 0)
  assert.equal(x.tours().some(t => t.id === tour.id), false)
  console.log('PASS: delayed sync cannot resurrect a deleted tour in state or cache')

  x = setup({ online: true })
  await x.store.getState().bootstrap()
  const responses = []
  x.api.fetchTours = () => new Promise(resolve => responses.push(resolve))
  const first = x.store.getState().syncTours()
  const second = x.store.getState().syncTours()
  responses[1]([]); await second
  responses[0]([tour]); await first
  assert.equal(x.store.getState().savedTours.length, 0)
  assert.equal(x.tours().some(t => t.ownerId === 'a'), false)
  console.log('PASS: overlapping sync responses keep only the latest request')

  x = setup({ online: true })
  await x.store.getState().bootstrap()
  x.cache.pause()
  const writing = x.store.getState().syncTours()
  await new Promise(resolve => setImmediate(resolve))
  await x.store.getState().removeTour(tour.id)
  x.cache.resume(); await writing
  assert.equal(x.store.getState().savedTours.length, 0)
  assert.equal(x.tours().some(t => t.id === tour.id), false)
  console.log('PASS: sync invalidated while awaiting cache cannot write stale records')

  x = setup({ online: true })
  await x.store.getState().bootstrap()
  let calls = 0
  x.api.fetchTours = async () => { calls++; return [tour] }
  x.api.deleteRemoteTour = () => new Promise(resolve => { finish = resolve })
  const removing = x.store.getState().removeTour(tour.id)
  await x.store.getState().syncTours()
  assert.equal(calls, 0)
  finish(); await removing
  await x.store.getState().syncTours()
  assert.equal(calls, 1)
  console.log('PASS: sync is blocked during mutation and enabled after completion')

  for (const change of [s => s.setRoutePlace('three'), s => s.setRouteOrder(['two', 'one']), s => s.applySuggestedRoute('new')]) {
    x = setup({ online: true })
    await x.store.getState().bootstrap()
    x.store.setState({ suggestedRouteIds: ['one', 'three'] })
    x.api.fetchTours = () => new Promise(resolve => { finish = resolve })
    const pendingSync = x.store.getState().syncTours()
    assert.equal(await change(x.store.getState()), true)
    const changed = JSON.stringify(x.store.getState().savedTours)
    const cached = JSON.stringify(x.tours())
    finish([tour]); await pendingSync
    assert.equal(JSON.stringify(x.store.getState().savedTours), changed)
    assert.equal(JSON.stringify(x.tours()), cached)
  }
  console.log('PASS: stale sync cannot overwrite add, reorder or suggested tour creation')

  x = setup({ online: true })
  await x.store.getState().bootstrap()
  let rejectSync
  x.api.fetchTours = () => new Promise((_, reject) => { rejectSync = reject })
  const failingSync = x.store.getState().syncTours()
  await x.store.getState().removeTour(tour.id)
  rejectSync(new BackendApiError(401)); await failingSync
  assert.equal(x.local.get('token'), 'token-a')
  assert.equal(x.store.getState().currentUser.id, 'a')
  console.log('PASS: invalidated sync error cannot clear the current session')

  x = setup({ online: true })
  const ordered = [{ ...tour, id: 'a', createdAt: 2 }, { ...tour, id: 'z', createdAt: 2 }, { ...tour, id: 'old', createdAt: 1 }]
  x.remote(ordered)
  await x.store.getState().bootstrap()
  const onlineOrder = Array.from(x.store.getState().savedTours, t => t.id)
  assert.deepEqual(onlineOrder, ['z', 'a', 'old'])
  x.navigator.onLine = false
  await x.store.getState().bootstrap()
  assert.deepEqual(Array.from(x.store.getState().savedTours, t => t.id), onlineOrder)
  console.log('PASS: online/offline order matches, including equal createdAt')

  x = setup()
  await x.store.getState().bootstrap()
  assert.equal(x.store.getState().savedTours.some(t => t.id === 'legacy'), false)
  assert.equal(x.tours().find(t => t.id === 'legacy').ownerId, undefined)
  x.navigator.onLine = true
  x.remote([{ ...tour, id: 'legacy', ownerId: undefined }])
  await x.store.getState().syncTours()
  assert.equal(x.tours().find(t => t.id === 'legacy').ownerId, 'a')
  assert.equal(x.tours().find(t => t.id === 'tour-b').ownerId, 'b')
  x.navigator.onLine = false
  await x.store.getState().bootstrap()
  assert.equal(x.store.getState().savedTours[0].id, 'legacy')
  console.log('PASS: legacy owner assigned only after authenticated server confirmation; then works offline')

  x = setup({ online: true })
  x.remote([])
  await x.store.getState().bootstrap()
  assert.equal(x.tours().find(t => t.id === 'legacy').ownerId, undefined)
  assert.equal(x.tours().some(t => t.id === 'tour-b'), true)
  console.log('PASS: unverified legacy and other account data remain intact')

  const routes = []
  const sw = fs.readFileSync(path.join(root, 'clients/frontend/src/sw.ts'), 'utf8')
  const swCode = ts.transpileModule(sw, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  class NavigationRoute { constructor(handler, options) { this.handler = handler; this.options = options } }
  const workbox = {
    clientsClaim() {}, cleanupOutdatedCaches() {}, precacheAndRoute() {},
    createHandlerBoundToURL: url => url, NavigationRoute,
    registerRoute: (...args) => routes.push(args),
    ExpirationPlugin: class {}, CacheFirst: class {}, NetworkFirst: class {},
  }
  vm.runInNewContext(swCode, { exports: {}, require: () => workbox, self: { skipWaiting() {}, __WB_MANIFEST: [] } })
  assert.equal(routes[0][0].handler, 'index.html')
  const cacheApi = routes[2][0]
  const accepts = (pathname, authorized = false) => cacheApi({ url: { pathname }, request: { headers: { has: () => authorized } } })
  assert.equal(accepts('/api/v1/places'), true)
  assert.equal(accepts('/api/v1/tours', true), false)
  assert.equal(accepts('/api/v1/auth/me', true), false)
  assert.equal(accepts('/api/v1/tours'), false)
  console.log('PASS: service worker navigation fallback and private API cache exclusion')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
