// Kiểm tra lưu gợi ý bằng store thật, API và bộ nhớ mô phỏng.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { setup, BackendApiError, tour } = require('./offline-tours.cjs')
const root = path.resolve(__dirname, '../..')
const ts = require(path.join(root, 'clients/frontend/node_modules/typescript'))
const React = require(path.join(root, 'clients/frontend/node_modules/react'))
const { renderToStaticMarkup } = require(path.join(root, 'clients/frontend/node_modules/react-dom/server'))
const jsx = require(path.join(root, 'clients/frontend/node_modules/react/jsx-runtime'))
const plannerSource = fs.readFileSync(path.join(root, 'clients/frontend/src/components/ItineraryPlanner.tsx'), 'utf8')
const compiled = ts.transpileModule(plannerSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
const places = [
  { id: 'one', coordinates: [106, 17], duration: 10, copy: { vi: { title: 'One' } } },
  { id: 'two', coordinates: [106.01, 17], duration: 20, copy: { vi: { title: 'Two' } } },
]
const plan = { days: [{ places, lodging: null }], ticketTotal: 100000, unpricedCount: 0 }
function render({ signedIn = true, online = true, saving = false, choose = false, saved = false, message = '' } = {}) {
  const values = [choose, message, saved, 2, '1000000', [], plan, false, '']
  let index = 0
  const state = { language: 'vi', currentUser: signedIn ? { id: 'a' } : null, routeIds: ['old'], online, isSavingRoute: saving }
  const exports = {}
  const dependencies = {
    react: { useState: initial => [index < values.length ? values[index++] : initial, () => {}] },
    'react/jsx-runtime': jsx,
    'react-router-dom': { Link: ({ to, children }) => React.createElement('a', { href: to }, children) },
    'lucide-react': { LoaderCircle: () => null, MapPinned: () => null, Sparkles: () => null },
    '../api': {}, '../routeOptimization': {}, '@turf/turf': {},
    '../data/places': { categoryKeys: [], categoryLabels: { vi: {} } },
    '../store': { useAppStore: selector => selector(state) },
    '../uiText': { ui: (_, key) => key, localeOf: () => 'vi-VN' },
  }
  vm.runInNewContext(compiled, { exports, require: name => dependencies[name] })
  return renderToStaticMarkup(exports.ItineraryPlanner({ places }))
}
async function run() {
  for (const mode of ['replace', 'new']) {
    const x = setup({ online: true })
    await x.store.getState().bootstrap()
    const untouched = { ...tour, id: 'untouched', placeIds: ['one'] }
    await x.db.saveTour(untouched, 'a')
    x.store.setState({ savedTours: [...x.store.getState().savedTours, untouched] })
    x.store.setState({ places })
    x.store.getState().setSuggestedRoute(['two', 'one'])
    let sent, token
    x.api.createTour = async (item, auth) => { sent = item; token = auth; return item }
    assert.equal(await x.store.getState().applySuggestedRoute(mode), true)
    assert.equal(sent.id, mode === 'replace' ? tour.id : 'new-tour')
    assert.equal(token, 'token-a')
    assert.deepEqual(Array.from(sent.placeIds), ['two', 'one'])
    assert.equal(sent.durationMinutes, 30)
    assert.ok(sent.distanceKm > 1 && sent.distanceKm < 1.1)
    assert.equal(x.store.getState().suggestedRouteIds.length, 0)
    assert.equal(x.store.getState().activeTourId, sent.id)
    assert.equal(x.tours().find(t => t.id === sent.id).ownerId, 'a')
    assert.equal(JSON.stringify(x.store.getState().savedTours.find(t => t.id === 'untouched')), JSON.stringify(untouched))
    assert.equal(JSON.stringify(x.tours().find(t => t.id === 'untouched')), JSON.stringify(untouched))
    if (mode === 'new') assert.equal(x.store.getState().savedTours.some(t => t.id === tour.id), true)
    x.navigator.onLine = false
    await x.store.getState().bootstrap()
    assert.deepEqual(Array.from(x.store.getState().routeIds), ['two', 'one'])
    assert.equal(x.store.getState().activeTourId, sent.id)
    x.remote(x.store.getState().savedTours)
    x.navigator.onLine = true
    await x.store.getState().bootstrap()
    assert.equal(x.store.getState().activeTourId, sent.id)
    assert.deepEqual(Array.from(x.store.getState().routeIds), ['two', 'one'])
  }
  console.log('PASS: replace/new persist correct ID, order, metrics, owner and restore on reload')

  let x = setup()
  x.store.getState().setSuggestedRoute(['one'])
  await assert.rejects(x.store.getState().applySuggestedRoute('new'), error => error.status === 401)
  await x.store.getState().bootstrap()
  assert.equal(await x.store.getState().applySuggestedRoute('new'), false)
  assert.equal(x.store.getState().storageError, 'routeOffline')
  console.log('PASS: signed out returns authentication error; offline is blocked')

  x = setup({ online: true })
  await x.store.getState().bootstrap()
  x.store.setState({ places })
  x.store.getState().setSuggestedRoute(['one', 'two'])
  const before = JSON.stringify(x.store.getState().savedTours)
  x.api.createTour = async () => { throw new BackendApiError(503) }
  assert.equal(await x.store.getState().applySuggestedRoute('new'), false)
  assert.equal(JSON.stringify(x.store.getState().savedTours), before)
  assert.equal(x.store.getState().suggestedRouteIds.length, 2)
  assert.equal(x.store.getState().isSavingRoute, false)
  console.log('PASS: server failure retains prior tours and suggestion for retry')
  x.api.createTour = async () => { throw new BackendApiError(0) }
  assert.equal(await x.store.getState().applySuggestedRoute('new'), false)
  assert.equal(x.store.getState().storageError, 'routeOffline')
  assert.equal(JSON.stringify(x.store.getState().savedTours), before)
  assert.equal(x.store.getState().suggestedRouteIds.length, 2)
  console.log('PASS: network error with navigator online retains data and reports connection requirement')

  let finish, calls = 0
  x.api.createTour = item => { calls++; return new Promise(resolve => { finish = () => resolve(item) }) }
  const pending = x.store.getState().applySuggestedRoute('new')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(x.store.getState().isSavingRoute, true)
  assert.equal(await x.store.getState().applySuggestedRoute('new'), false)
  finish(); assert.equal(await pending, true)
  assert.equal(calls, 1)
  console.log('PASS: saving state prevents duplicate requests')

  x.store.getState().setSuggestedRoute(['one'])
  x.api.createTour = async item => item
  x.db.saveTour = async () => { throw new Error('Storage unavailable') }
  assert.equal(await x.store.getState().applySuggestedRoute('new'), true)
  assert.equal(x.store.getState().storageError, 'savingError')
  console.log('PASS: successful server save with cache failure reports storage warning, avoiding duplicate retry')

  x = setup({ online: true, draftWriteFails: true })
  await x.store.getState().bootstrap()
  x.store.getState().setSuggestedRoute(['one'])
  assert.equal(await x.store.getState().applySuggestedRoute('new'), true)
  assert.equal(x.tours().some(t => t.id === 'new-tour'), true)
  assert.equal(x.store.getState().storageError, 'savingError')
  console.log('PASS: localStorage failure after server save still caches tour and avoids duplicate retry')

  x = setup({ online: true })
  await x.store.getState().bootstrap()
  x.store.getState().setSuggestedRoute(['one'])
  x.api.createTour = async () => { throw new BackendApiError(401) }
  const unchanged = JSON.stringify(x.store.getState().savedTours)
  await assert.rejects(x.store.getState().applySuggestedRoute('replace'), error => error.status === 401)
  assert.equal(JSON.stringify(x.store.getState().savedTours), unchanged)
  assert.equal(x.store.getState().suggestedRouteIds.length, 1)
  assert.equal(x.store.getState().isSavingRoute, false)
  console.log('PASS: API 401 reaches UI while preserving existing tours and suggestion')

  x = setup({ online: true })
  await x.store.getState().bootstrap()
  x.store.setState({ activeTourId: null, routeIds: [] })
  x.store.getState().setSuggestedRoute(['one'])
  assert.equal(await x.store.getState().applySuggestedRoute('replace'), true)
  assert.equal(x.store.getState().activeTourId, 'new-tour')
  assert.equal(x.store.getState().savedTours.some(t => t.id === tour.id), true)
  console.log('PASS: replace without active tour creates a new ID and preserves prior tours')

  const tree = ts.createSourceFile('ItineraryPlanner.tsx', plannerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const component = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'ItineraryPlanner')
  const handler = component.body.statements.flatMap(n => ts.isVariableStatement(n) ? Array.from(n.declarationList.declarations) : []).find(n => n.name.getText(tree) === 'savePlan').initializer.getText(tree)
  let restored, successMessage, savedFlag
  const context = { plan, saving: false, loading: false, language: 'vi', Error, navigator: { onLine: true },
    setSaveMessage: text => { successMessage = text }, setSaveChoice() {}, setPlanSaved: saved => { savedFlag = saved },
    setSuggestedRoute: ids => { restored = Array.from(ids) }, applySuggestedRoute: async () => true,
    ui: (_, key) => key,
  }
  vm.createContext(context)
  vm.runInContext(ts.transpileModule(`globalThis.savePlan = ${handler}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
  await context.savePlan('new')
  assert.deepEqual(restored, ['one', 'two'])
  assert.equal(successMessage, 'suggestionSaved')
  assert.equal(savedFlag, true)
  console.log('PASS: actual UI handler restores displayed plan after map suggestion was cleared')
  context.applySuggestedRoute = async () => { throw new BackendApiError(401) }
  await context.savePlan('new')
  assert.equal(successMessage, 'suggestionSignIn')
  assert.match(render({ message: 'suggestionSignIn' }), /href="\/login"/)
  console.log('PASS: API 401 displays sign-in message and login link')

  assert.match(render({ signedIn: false }), /suggestionSignIn/)
  assert.match(render({ signedIn: false }), /href="\/login"/)
  assert.match(render({ online: false }), /disabled=""[^>]*>saveSuggestion/)
  assert.match(render({ online: false }), /routeOffline/)
  assert.match(render({ choose: true }), /replaceRoute/)
  assert.match(render({ choose: true }), /newRoute/)
  assert.match(render({ saving: true }), /suggestionSaving/)
  assert.doesNotMatch(render({ saved: true }), />saveSuggestion/)
  console.log('PASS: rendered UI shows login, offline hint, mode choices and saving state')

  const uiSource = fs.readFileSync(path.join(root, 'clients/frontend/src/uiText.ts'), 'utf8')
  const uiExports = {}
  vm.runInNewContext(ts.transpileModule(uiSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports: uiExports, require: () => ({}) })
  for (const key of ['suggestionSaving', 'suggestionSignIn']) {
    assert.equal(Object.keys(uiExports.uiText[key]).length, 7)
    for (const lang of ['vi', 'en', 'ja', 'fr', 'zh-CN', 'ko-KR', 'es']) assert.ok(uiExports.uiText[key][lang])
  }
  console.log('PASS: new interface strings cover all seven languages')

  const apiSource = fs.readFileSync(path.join(root, 'clients/frontend/src/api.ts'), 'utf8').replaceAll('import.meta.env.VITE_API_BASE_URL', "''")
  const apiExports = {}
  let request
  vm.runInNewContext(ts.transpileModule(apiSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports: apiExports, fetch: async (url, init) => { request = { url, init }; return { ok: true, status: 201, json: async () => tour } } })
  await apiExports.createTour({ ...tour, unknownField: 'excluded' }, 'token-a')
  assert.equal(request.url, '/api/v1/tours')
  assert.equal(request.init.method, 'POST')
  assert.equal(request.init.headers.Authorization, 'Bearer token-a')
  assert.deepEqual(Object.keys(JSON.parse(request.init.body)).sort(), ['createdAt', 'id', 'placeIds'])
  assert.deepEqual(JSON.parse(request.init.body).placeIds, tour.placeIds)
  console.log('PASS: actual API serializes only id/placeIds/createdAt and preserves point order')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
