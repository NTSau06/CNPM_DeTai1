// Kiểm tra cache danh mục bằng mã thật với IndexedDB và API mô phỏng.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = path.resolve(__dirname, '../..')
const ts = require(path.join(root, 'clients/frontend/node_modules/typescript'))
const create = require(path.join(root, 'clients/frontend/node_modules/zustand/vanilla')).createStore
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const place = (id, title) => ({ id, category: 'landmark', coordinates: [106, 17], duration: 10, image: '', copy: { vi: { title, subtitle: '', narration: title } }, detailSections: [], detailImage: { src: '', alt: '', caption: '' } })
const bundled = [place('sample-1', 'Mẫu 1'), place('sample-2', 'Mẫu 2')]
const apiExports = {}
vm.runInNewContext(compile(read('clients/frontend/src/api.ts').replaceAll('import.meta.env.VITE_API_BASE_URL', "''")), { exports: apiExports })
function setup(initial = [], synced = false) {
  const data = { places: new Map(initial.map(p => [p.id, p])), settings: new Map() }
  if (synced) data.settings.set('catalogSynced', { key: 'catalogSynced', value: true })
  const transactions = []
  let failId
  const db = {
    getAll: async name => [...data[name].values()],
    get: async (name, key) => data[name].get(key),
    put: async (name, value) => { data[name].set(value.key ?? value.id, value) },
    delete: async (name, key) => { data[name].delete(key) },
    transaction: names => {
      names = Array.isArray(names) ? names : [names]
      transactions.push(names)
      const staged = Object.fromEntries(names.map(name => [name, new Map(data[name])]))
      let aborted = false
      const objectStore = name => ({
        get: async id => staged[name].get(id),
        clear: async () => { staged[name].clear() },
        put: value => {
          if (failId !== undefined && value.id === failId) throw new Error('Write failed')
          staged[name].set(value.id ?? value.key, value)
          return Promise.resolve()
        },
        add: async value => {
          assert.equal(staged[name].has(value.id), false)
          staged[name].set(value.id, value)
        },
      })
      return { store: objectStore(names[0]), objectStore, abort() { aborted = true }, get done() {
        if (aborted) return Promise.reject(new Error('Transaction aborted'))
        for (const name of names) data[name] = staged[name]
        return Promise.resolve()
      } }
    },
  }
  const dbExports = {}
  vm.runInNewContext(compile(read('clients/frontend/src/db.ts')), { exports: dbExports, require: () => ({ openDB: async () => db }) })
  const navigator = { onLine: false }
  let remote = []
  const exports = {}
  const dependencies = { zustand: { create }, './db': { ...dbExports, getOfflineMap: async () => null },
    './api': { ...apiExports, getStoredAuthToken: () => null, fetchPlaces: async () => remote },
    './data/places': { places: bundled, languages: [{ code: 'vi' }] } }
  vm.runInNewContext(compile(read('clients/frontend/src/store.ts')), { exports, navigator, require: name => dependencies[name] })
  return { store: exports.useAppStore, db: dbExports, api: dependencies['./api'], cacheApi: dependencies['./db'], data, navigator, transactions, remote: items => { remote = items }, fail: id => { failId = id } }
}
const ids = state => Array.from(state.places, p => p.id)
async function run() {
  let x = setup()
  await x.store.getState().bootstrap()
  assert.deepEqual(ids(x.store.getState()), ['sample-1', 'sample-2'])
  console.log('PASS: empty unsynced cache is seeded')

  const edited = place('sample-1', 'Tiêu đề admin')
  x = setup([edited, place('custom-z', 'Zebra'), place('custom-a', 'An'), place('truong-son-cemetery', 'Cũ')])
  await x.store.getState().bootstrap()
  assert.equal(x.store.getState().places[0].copy.vi.title, 'Tiêu đề admin')
  assert.deepEqual(ids(x.store.getState()), ['sample-1', 'sample-2', 'custom-a', 'custom-z'])
  await x.db.cachePlaces(bundled)
  assert.equal(x.data.places.get('sample-1').copy.vi.title, 'Tiêu đề admin')
  assert.equal(x.data.places.has('custom-a'), true)
  console.log('PASS: seeding never overwrites admin edits; custom places survive and sort after bundled IDs; retired ID hidden')

  x = setup(bundled)
  x.navigator.onLine = true
  x.remote([edited, place('custom', 'Điểm mới')])
  await x.store.getState().bootstrap()
  assert.equal(x.data.places.has('sample-2'), false)
  assert.equal(x.data.settings.get('catalogSynced').value, true)
  assert.equal(x.transactions.some(names => names.includes('places') && names.includes('settings')), true)
  x.navigator.onLine = false
  await x.store.getState().bootstrap()
  assert.deepEqual(ids(x.store.getState()), ['sample-1', 'custom'])
  assert.equal(x.store.getState().places[0].copy.vi.title, 'Tiêu đề admin')
  console.log('PASS: online edit/add/delete is persisted atomically and survives offline bootstrap')

  x = setup(bundled)
  x.store.getState().setPlaces([edited])
  await new Promise(resolve => setImmediate(resolve))
  await x.store.getState().bootstrap()
  assert.deepEqual(ids(x.store.getState()), ['sample-1'])
  assert.equal(x.data.settings.get('catalogSynced').value, true)
  console.log('PASS: admin setPlaces also marks authoritative cache, preventing deleted sample resurrection')

  await x.db.replaceCachedPlaces([])
  await x.db.cachePlaces(bundled)
  await x.store.getState().bootstrap()
  assert.deepEqual(ids(x.store.getState()), [])
  console.log('PASS: authoritative empty catalog remains empty offline, even after a stale seeding call')

  x = setup([edited])
  x.fail('bad')
  await assert.rejects(x.db.replaceCachedPlaces([place('bad', 'Bad')]))
  assert.equal(x.data.places.get('sample-1').copy.vi.title, 'Tiêu đề admin')
  assert.equal(x.data.settings.has('catalogSynced'), false)
  console.log('PASS: failed replacement preserves previous catalog and sync marker together')

  x = setup(bundled, true)
  x.navigator.onLine = true
  let respond
  x.api.fetchPlaces = () => new Promise(resolve => { respond = resolve })
  const oldBootstrap = x.store.getState().bootstrap()
  await new Promise(resolve => setImmediate(resolve))
  x.store.getState().setPlaces([edited])
  await new Promise(resolve => setImmediate(resolve))
  respond(bundled); await oldBootstrap
  assert.deepEqual(ids(x.store.getState()), ['sample-1'])
  assert.equal(x.data.places.has('sample-2'), false)
  assert.equal(x.data.places.get('sample-1').copy.vi.title, 'Tiêu đề admin')
  console.log('PASS: old bootstrap response cannot overwrite admin edits or restore deleted places')

  x = setup(bundled, true)
  x.navigator.onLine = true
  const responses = []
  x.api.fetchPlaces = () => new Promise(resolve => responses.push(resolve))
  const first = x.store.getState().bootstrap()
  await new Promise(resolve => setImmediate(resolve))
  const second = x.store.getState().bootstrap()
  await new Promise(resolve => setImmediate(resolve))
  responses[1]([edited]); await second
  responses[0](bundled); await first
  assert.deepEqual(ids(x.store.getState()), ['sample-1'])
  assert.equal(x.data.places.has('sample-2'), false)
  console.log('PASS: overlapping HTTP responses keep the newest requested catalog in state and cache')

  x = setup(bundled, true)
  const replace = x.db.replaceCachedPlaces
  let release
  x.cacheApi.replaceCachedPlaces = (items, isCurrent) => {
    if (!release) return new Promise(resolve => { release = () => resolve(replace(items, isCurrent)) })
    return replace(items, isCurrent)
  }
  x.store.getState().setPlaces(bundled)
  x.store.getState().setPlaces([edited])
  await new Promise(resolve => setImmediate(resolve))
  await release()
  assert.deepEqual(ids(x.store.getState()), ['sample-1'])
  assert.equal(x.data.places.has('sample-2'), false)
  console.log('PASS: stale queued IndexedDB replacement is discarded before clear/put')

  x = setup([edited], true)
  let validityChecks = 0
  await x.db.replaceCachedPlaces(bundled, () => ++validityChecks === 1)
  assert.equal(x.data.places.get('sample-1').copy.vi.title, 'Tiêu đề admin')
  assert.equal(x.data.places.has('sample-2'), false)
  console.log('PASS: revision invalidated during a transaction rolls back the entire replacement')

  x = setup(bundled, true)
  let reads = 0, releaseRead
  x.cacheApi.getCachedPlaces = async () => {
    const snapshot = await x.db.getCachedPlaces()
    if (++reads === 2) await new Promise(resolve => { releaseRead = resolve })
    return snapshot
  }
  const restoring = x.store.getState().bootstrap()
  await new Promise(resolve => setImmediate(resolve))
  x.store.getState().setPlaces([edited])
  await new Promise(resolve => setImmediate(resolve))
  releaseRead(); await restoring
  assert.deepEqual(ids(x.store.getState()), ['sample-1'])
  console.log('PASS: late offline restoration cannot overwrite a newer catalog')

  const adminSource = read('clients/frontend/src/pages/OnlineDashboardPage.tsx')
  const adminTree = ts.createSourceFile('OnlineDashboardPage.tsx', adminSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let adminRefresh
  const findRefresh = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(adminTree) === 'refresh') adminRefresh = node.initializer.arguments[0].getText(adminTree)
    ts.forEachChild(node, findRefresh)
  }
  findRefresh(adminTree)
  x = setup(bundled, true)
  const adminResponses = []
  let adminPlaces, loading
  const adminContext = { authToken: 'admin', refreshRevision: { current: 0 }, useAppStore: { getState: x.store.getState },
    period: 30, getAdminReviews: async () => [], setReviews() {},
    getAdminOverview: async () => ({}), getAdminUsers: async () => [], fetchTicketPrices: async () => [],
    fetchPlaces: () => new Promise(resolve => adminResponses.push(resolve)), mergeRemotePlaces: apiExports.mergeRemotePlaces,
    setLoading: value => { loading = value }, setMessage() {}, setOverview() {}, setUsers() {}, setPriceDrafts() {},
    setPlacesList: items => { adminPlaces = items }, setPlaces: (...args) => x.store.getState().setPlaces(...args),
  }
  vm.createContext(adminContext)
  vm.runInContext(compile(`globalThis.refresh = ${adminRefresh}`), adminContext)
  const adminFirst = adminContext.refresh()
  const adminSecond = adminContext.refresh()
  adminResponses[1]([edited]); await adminSecond
  adminResponses[0](bundled); await adminFirst
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(adminPlaces.length, 1)
  assert.deepEqual(ids(x.store.getState()), ['sample-1'])
  assert.equal(x.data.places.has('sample-2'), false)
  assert.equal(loading, false)
  console.log('PASS: actual admin refresh ignores stale results and finishes loading')

  const mobile = read('clients/mobile/App.tsx')
  const tree = ts.createSourceFile('App.tsx', mobile, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let refresh
  const find = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'refreshPlaces') refresh = node.initializer.arguments[0].getText(tree)
    ts.forEachChild(node, find)
  }
  find(tree)
  let cached = JSON.stringify([edited, place('custom', 'New')]), shown
  let online = false
  const context = { PLACES_KEY: 'places', RETIRED_PLACE_IDS: new Set(['truong-son-cemetery']),
    AsyncStorage: { getItem: async () => cached, setItem: async (_, value) => { cached = value } },
    api: async () => { if (!online) throw new Error('Offline'); return { items: [] } },
    setBusy() {}, setMessage() {}, setPlaces: items => { shown = items }, currentLanguage: { error: 'error' } }
  vm.createContext(context)
  vm.runInContext(compile(`globalThis.refresh = ${refresh}`), context)
  await context.refresh()
  assert.equal(shown[0].copy.vi.title, 'Tiêu đề admin')
  assert.equal(shown.length, 2)
  online = true; await context.refresh()
  assert.equal(cached, '[]')
  online = false; await context.refresh()
  assert.equal(shown.length, 0)
  console.log('PASS: actual mobile refresh preserves offline cache and replaces full server catalog; no mobile change needed')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
