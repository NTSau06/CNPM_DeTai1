// Kiểm tra luồng store với API và bộ nhớ mô phỏng, không cần tài khoản thật.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const ts = require(path.join(root, 'clients/frontend/node_modules/typescript'))
const create = require(path.join(root, 'clients/frontend/node_modules/zustand/vanilla')).createStore
const source = fs.readFileSync(path.join(root, 'clients/frontend/src/store.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const user = { id: 'a', fullName: 'A' }
const tour = { id: 'tour-a', ownerId: 'a', placeIds: ['one', 'two'], createdAt: 1, distanceKm: 2, durationMinutes: 3 }
class BackendApiError extends Error { constructor(status) { super('API'); this.status = status } }
function setup({ online = false, status, cachedToken = 'token-a' } = {}) {
  const local = new Map([['token', 'token-a'], ['quang-tri:draft-tour:a', tour.id]])
  const settings = new Map([['currentUser', JSON.stringify({ authToken: cachedToken, user })]])
  let tours = [tour, { ...tour, id: 'tour-b', ownerId: 'b' }, { ...tour, id: 'legacy', ownerId: undefined }]
  let remote = [tour]
  const navigator = { onLine: online }
  const db = {
    readSetting: async key => settings.has(key) ? { value: settings.get(key) } : undefined,
    writeSetting: async (key, value) => { settings.set(key, value) },
    deleteSetting: async key => { settings.delete(key) },
    getCachedPlaces: async () => [], getOfflineMap: async () => null,
    cachePlaces: async () => {}, replaceCachedPlaces: async () => {},
    getSavedTours: async () => tours,
    replaceUserTours: async (ownerId, items) => { tours = [...tours.filter(t => t.ownerId !== ownerId), ...items] },
    deleteTour: async id => { tours = tours.filter(t => t.id !== id) },
  }
  const api = {
    BackendApiError, getStoredAuthToken: () => local.get('token') ?? null,
    storeAuthToken: token => token ? local.set('token', token) : local.delete('token'),
    fetchPlaces: async () => { if (status !== undefined) throw new BackendApiError(status); return [] },
    fetchCurrentUser: async () => { if (status !== undefined) throw new BackendApiError(status); return user },
    fetchTours: async () => remote, mergeRemotePlaces: local => local,
    logoutAccount: async () => {}, updateProfile: async (_, profile) => profile,
    deleteRemoteTour: async () => { if (status !== undefined) throw new BackendApiError(status) },
  }
  const exports = {}
  const context = { exports, navigator, localStorage: { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key) },
    require: name => ({ zustand: { create }, './db': db, './api': api, './data/places': { places: [], languages: [{ code: 'vi' }] } })[name] }
  vm.runInNewContext(compiled, context)
  return { store: exports.useAppStore, settings, local, navigator, api, tours: () => tours, remote: items => { remote = items } }
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
