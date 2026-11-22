// Kiểm tra trực tiếp callback GPS và hiệu ứng tự phát với trình duyệt mô phỏng.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = path.resolve(__dirname, '../..')
const ts = require(path.join(root, 'clients/frontend/node_modules/typescript'))
const turf = require(path.join(root, 'clients/frontend/node_modules/@turf/turf'))
const source = fs.readFileSync(path.join(root, 'clients/frontend/src/pages/ExplorePage.tsx'), 'utf8')
const tree = ts.createSourceFile('ExplorePage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const component = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'ExplorePage')
const declaration = name => component.body.statements.flatMap(n => ts.isVariableStatement(n) ? Array.from(n.declarationList.declarations) : []).find(n => n.name.getText(tree) === name).initializer.getText(tree)
const effects = component.body.statements.filter(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && n.expression.expression.getText(tree) === 'useEffect').map(n => n.expression.arguments[0].getText(tree))
const autoEffect = effects.find(text => text.includes('const nearby'))
const stopEffect = effects.find(text => text.includes('!autoNarration && watchId'))
const constant = tree.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(tree) === 'AUTO_GUIDE_RADIUS_METERS')).getText(tree)
function setup() {
  const place = { id: 'test', coordinates: [106, 17], copy: { vi: { narration: 'Test', audioUrl: '/test.mp3' } } }
  const state = { autoNarration: false, location: [105, 16], gps: '', selected: null, plays: 0, visits: 0, stops: 0, cleared: [], audio: true, speech: false }
  let success, failure
  const context = { ...turf, language: 'vi', languages: [{ code: 'vi', label: 'Vietnamese' }], places: [place],
    spokenPlaces: { current: new Set(['old']) }, submittedVisits: { current: new Set() }, watchId: { current: null },
    ui: (_, key) => key, translate: (_, key) => key,
    setGpsMessage: text => { state.gps = text }, setNarrationMessage: text => { state.narration = text },
    setLocation: coordinates => { state.location = coordinates; context.location = coordinates },
    setAutoNarration: enabled => { state.autoNarration = enabled; context.autoNarration = enabled },
    setSelectedPlace: id => { state.selected = id }, stopSpeaking: () => { state.stops++ },
    getNarrationAudioUrl: () => state.audio ? '/test.mp3' : undefined, speechAvailable: () => state.speech,
    playNarration: async () => { state.plays++; return { ok: true, fallback: false } },
    getVisitorId: async () => 'visitor', recordVisit: async () => { state.visits++; return true },
    navigator: { geolocation: { watchPosition: (ok, error) => { success = ok; failure = error; return 7 }, clearWatch: id => { state.cleared.push(id) } } },
    window: { confirm: () => true, dispatchEvent() {} }, CustomEvent: class {},
    localStorage: { getItem: () => null, setItem() {} },
  }
  vm.createContext(context)
  const code = `${constant}; globalThis.start = ${declaration('startWalk')}; globalThis.stop = ${declaration('stopWalk')}; globalThis.autoEffect = ${autoEffect}; globalThis.stopEffect = ${stopEffect};`
  vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
  const position = meters => {
    const coordinates = turf.destination(turf.point(place.coordinates), meters / 1000, 0).geometry.coordinates
    success({ coords: { longitude: coordinates[0], latitude: coordinates[1] } })
    context.autoEffect()
  }
  const error = code => failure({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
  return { state, context, position, error }
}
async function run() {
  let x = setup()
  x.context.start()
  assert.equal(x.state.plays, 0)
  assert.equal(x.state.location, null)
  assert.equal(x.state.gps, 'gpsLocating')
  assert.equal(x.context.spokenPlaces.current.size, 0)
  x.position(200)
  assert.equal(x.state.plays, 0)
  assert.equal(x.state.gps, '')
  x.position(86)
  assert.equal(x.state.plays, 0)
  x.position(80)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(x.state.plays, 1)
  assert.equal(x.state.visits, 1)
  assert.equal(x.state.selected, 'test')
  x.position(80)
  assert.equal(x.state.plays, 1)
  console.log('PASS: no immediate play; 200/86 m silent, 80 m selects/plays/records once without Web Speech')
  x.context.stop(); x.context.stopEffect(); x.context.start(); x.position(80)
  assert.equal(x.state.plays, 2)
  console.log('PASS: new session resets spoken places')

  x = setup(); x.context.start(); x.error(1)
  assert.equal(x.state.autoNarration, false)
  assert.equal(x.state.gps, 'gpsDenied')
  assert.equal(x.context.watchId.current, null)
  assert.deepEqual(x.state.cleared, [7])
  assert.equal(x.state.stops, 1)
  console.log('PASS: permission denied clears watch, stops playback and disables guide')

  for (const code of [2, 3]) {
    x = setup(); x.context.start(); x.error(code)
    assert.equal(x.state.autoNarration, true)
    assert.equal(x.context.watchId.current, 7)
    assert.equal(x.state.gps, 'gpsError')
    x.position(200)
    assert.equal(x.state.gps, '')
  }
  console.log('PASS: unavailable/timeout retain guide and recover on next position')

  x = setup(); x.state.audio = false; x.context.start(); x.position(80)
  assert.equal(x.state.plays, 0)
  assert.equal(x.context.spokenPlaces.current.size, 0)
  assert.equal(x.state.narration, 'voiceMissing')
  x.state.speech = true; x.position(80)
  assert.equal(x.state.plays, 1)
  console.log('PASS: unsupported playback does not mark place; speech-only remains supported')

  const speechSource = fs.readFileSync(path.join(root, 'clients/frontend/src/speech.ts'), 'utf8').replaceAll('import.meta.env.BASE_URL', "'/'")
  let audioPlays = 0
  class Audio { play() { audioPlays++; queueMicrotask(() => this.onplaying?.()); return Promise.resolve() } pause() {} }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(speechSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => name === './data/places' ? { languages: [] } : {}, Audio, window: {} })
  const result = await exports.playNarration({ id: 'test', copy: { vi: { narration: 'Test', audioUrl: '/test.mp3' } } }, 'vi')
  assert.equal(result.ok, true)
  assert.equal(audioPlays, 1)
  console.log('PASS: actual playNarration starts MP3 when Web Speech is absent')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
