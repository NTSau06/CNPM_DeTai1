// Kiểm tra dự phòng giọng đọc bằng mã thật và thiết bị mô phỏng.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const ts = require(path.join(root, 'clients/frontend/node_modules/typescript'))
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const languages = [{ code: 'vi', speech: 'vi-VN', label: 'Vietnamese' }, { code: 'ko-KR', speech: 'ko-KR', label: 'Korean' }]
const place = { id: 'test', copy: { vi: { narration: 'Nội dung tiếng Việt dài hơn bản gốc' }, 'ko-KR': { narration: '한국어', audioUrl: '/ko.mp3' } } }
const flush = () => new Promise(resolve => setImmediate(resolve))
function web({ voices = [{ lang: 'vi-VN' }], audio = 'ok', supported = true } = {}) {
  const spoken = [], audios = [], listeners = new Set(), timers = new Set()
  let currentVoices = voices
  const synth = { paused: false, cancelCalls: 0, getVoices: () => currentVoices, cancel() { this.cancelCalls++ }, speak: utterance => spoken.push(utterance),
    pause() { this.paused = true }, resume() { this.paused = false },
    addEventListener: (_, listener) => listeners.add(listener), removeEventListener: (_, listener) => listeners.delete(listener) }
  class Utterance { constructor(text) { this.text = text } }
  class Audio {
    constructor() { this.paused = true; this.currentTime = 0; audios.push(this) }
    play() {
      this.paused = false
      if (audio === 'error') return Promise.reject(new Error('Blocked'))
      if (audio === 'pending') return new Promise(() => {})
      queueMicrotask(() => this.onplaying?.())
      return Promise.resolve()
    }
    pause() { this.paused = true }
  }
  const exports = {}
  const window = supported ? { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance } : {}
  vm.runInNewContext(compile(read('clients/frontend/src/speech.ts').replaceAll('import.meta.env.BASE_URL', "'/'")),
    { exports, window, SpeechSynthesisUtterance: Utterance, Audio,
      require: name => name === './data/places' ? { languages } : { default: {} },
      setTimeout: (fn, delay) => { assert.equal(delay, 1000); timers.add(fn); return fn }, clearTimeout: fn => timers.delete(fn) })
  return { api: exports, spoken, audios, listeners, window, setVoices: voices => { currentVoices = voices },
    changed: () => [...listeners].forEach(fn => fn()), timeout: () => [...timers].forEach(fn => fn()) }
}
function arrow(source, componentName, name) {
  const tree = ts.createSourceFile('component.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let result
  function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) {
      result = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0].getText(tree) : node.initializer.getText(tree)
    }
    ts.forEachChild(node, find)
  }
  find(tree)
  assert.ok(result, `${componentName}.${name}`)
  return result
}
async function run() {
  let x = web()
  const exact = { lang: 'ko-KR' }, prefix = { lang: 'ko_KP' }
  assert.equal(x.api.pickVoice([prefix, exact], 'KO-kr'), exact)
  assert.equal(x.api.pickVoice([prefix], 'ko-KR'), prefix)
  assert.equal(x.api.pickVoice([{ lang: 'en-US' }], 'ko-KR'), undefined)
  console.log('PASS: pure voice selection matches exact locale, then prefix, never unrelated default')

  x = web({ voices: [] })
  const waiting = x.api.ensureVoicesLoaded()
  x.setVoices([exact]); x.changed()
  assert.equal((await waiting)[0], exact)
  assert.equal(x.listeners.size, 0)
  x.setVoices([])
  const timeout = x.api.ensureVoicesLoaded(); x.timeout()
  assert.equal((await timeout).length, 0)
  assert.equal(x.listeners.size, 0)
  console.log('PASS: waits for voiceschanged, times out at one second and removes listeners')

  x = web({ supported: false })
  let result = await x.api.playNarration(place, 'ko-KR')
  assert.equal(result.ok, true)
  assert.equal(result.fallback, false)
  assert.equal(x.spoken.length, 0)
  console.log('PASS: MP3 plays without Web Speech, without fallback')

  x = web({ audio: 'error', voices: [exact, { lang: 'vi-VN' }] })
  result = await x.api.playNarration(place, 'ko-KR')
  assert.equal(result.usedLanguage, 'ko-KR')
  assert.equal(result.fallback, false)
  assert.equal(x.spoken[0].text, place.copy['ko-KR'].narration)
  assert.equal(x.spoken[0].voice, exact)
  x = web({ audio: 'error' })
  result = await x.api.playNarration(place, 'ko-KR')
  assert.equal(result.usedLanguage, 'vi')
  assert.equal(result.fallback, true)
  assert.equal(x.spoken[0].text, place.copy.vi.narration)
  assert.equal(x.spoken[0].voice.lang, 'vi-VN')
  console.log('PASS: blocked MP3 uses requested speech voice, otherwise Vietnamese content and voice')

  x = web({ audio: 'error', voices: [{ lang: 'en-US' }] })
  result = await x.api.playNarration(place, 'ko-KR')
  assert.equal(result.ok, false); assert.equal(result.reason, 'no-voice'); assert.equal(x.spoken.length, 0)
  x = web({ audio: 'error', supported: false })
  result = await x.api.playNarration(place, 'ko-KR')
  assert.equal(result.reason, 'unsupported')
  console.log('PASS: missing requested/Vietnamese voices stays silent; unsupported browser is distinguished')

  x = web({ audio: 'pending' })
  const cancelled = x.api.playNarration(place, 'ko-KR')
  x.api.stopSpeaking()
  result = await cancelled
  assert.equal(result.ok, false); assert.equal(x.spoken.length, 0)
  console.log('PASS: stop while MP3 loads settles request without starting fallback later')

  x = web()
  const updates = []
  await x.api.playNarration(place, 'ko-KR', result => updates.push(result))
  const lateError = x.audios[0].onerror
  lateError(); lateError(); await flush()
  assert.equal(x.spoken.length, 1)
  assert.equal(x.audios[0].paused, true)
  assert.equal(updates.length, 2)
  assert.equal(updates[1].fallback, true)
  x.spoken[0].onerror()
  assert.equal(updates[2].reason, 'no-voice')
  console.log('PASS: MP3 error after playback starts triggers one fallback and updates the warning')

  x = web()
  const player = read('clients/frontend/src/components/AudioPlayer.tsx')
  let position = 0, message = ''
  const ref = current => ({ current })
  const context = { originalText: '한국어', vietnameseText: place.copy.vi.narration, text: '한국어', language: 'vi', speechLanguage: 'ko-KR', languages,
    resolvedSpeech: ref(null), generation: ref(0), playbackToken: ref(null), audioFailed: ref(false), baseCharacter: ref(0), segmentStartedAt: ref(0), utteranceActive: ref(false),
    characterIndexRef: ref(0), rateRef: ref(1), playingRef: ref(false), useAudioFile: false, estimatedCharactersPerSecond: 14,
    setPreparedSpeech() {}, setVoiceMessage: text => { message = text }, setPlaying() {}, onPlayingChange() {},
    setCharacterIndex: value => { position = value }, ui: (_, key) => key, performance: { now: () => 0 },
    prepareSpeech: x.api.prepareSpeech, speakFrom: x.api.speakFrom, window: x.window,
    beginPlayback: x.api.beginPlayback, claimAudioPlayback: x.api.claimAudioPlayback, isPlaybackCurrent: x.api.isPlaybackCurrent,
    stopSpeaking: x.api.stopSpeaking, audioRef: ref(null), audioSrc: '/ko.mp3', setAudioFileFailed() {} }
  vm.createContext(context)
  for (const name of ['onPlaybackStopped', 'updateCharacterIndex', 'startAt', 'pause', 'play', 'stop', 'playAudioFile', 'handleAudioError']) vm.runInContext(compile(`globalThis.${name} = ${arrow(player, 'AudioPlayer', name)}`), context)
  await context.startAt(2)
  assert.equal(message, 'voiceFallback')
  assert.equal(x.spoken[0].text, place.copy.vi.narration)
  x.spoken[0].onboundary({ charIndex: 12 })
  assert.equal(position, 12)
  context.pause(); assert.equal(x.window.speechSynthesis.paused, true)
  context.play(); assert.equal(x.window.speechSynthesis.paused, false)
  await context.startAt(12)
  assert.equal(x.spoken[1].text, place.copy.vi.narration.slice(12))
  x.spoken[1].onerror()
  assert.equal(message, 'voiceMissing')
  console.log('PASS: AudioPlayer uses Vietnamese character offsets, pauses/resumes and reports speech errors')
  await context.startAt(0)
  context.pause(); context.stop()
  await context.startAt(12)
  assert.equal(x.window.speechSynthesis.paused, false)
  assert.equal(x.spoken[x.spoken.length - 1].text, place.copy.vi.narration.slice(12))
  console.log('PASS: pause then stop does not leave a new speech request stuck in paused state')

  let rejectAudio
  const localAudio = { ended: false, currentTime: 12, paused: true, pause() { this.paused = true },
    play() { this.paused = false; return new Promise((_, reject) => { rejectAudio = reject }) } }
  context.audioRef.current = localAudio
  context.useAudioFile = true
  let speechCount = x.spoken.length
  context.playAudioFile(); context.stop(); rejectAudio(new Error('Cancelled'))
  await flush()
  assert.equal(x.spoken.length, speechCount)
  assert.equal(localAudio.paused, true)
  assert.equal(context.playingRef.current, false)
  console.log('PASS: stopping pending AudioPlayer MP3 ignores delayed rejection, with no surprise TTS')

  context.playAudioFile(); context.pause(); rejectAudio(new Error('Paused'))
  await flush()
  assert.equal(x.spoken.length, speechCount)
  localAudio.currentTime = 12
  context.playAudioFile()
  assert.equal(localAudio.currentTime, 12)
  context.handleAudioError(); rejectAudio(new Error('Blocked'))
  await flush()
  assert.equal(x.spoken.length, speechCount + 1)
  assert.equal(localAudio.paused, true)
  console.log('PASS: pause/resume preserves MP3 position; error event plus rejection starts only one fallback')

  speechCount = x.spoken.length
  let resolvePreparation
  context.prepareSpeech = () => new Promise(resolve => { resolvePreparation = resolve })
  context.resolvedSpeech.current = null
  const preparing = context.startAt(0)
  const latest = x.api.playNarration(place, 'ko-KR')
  await latest
  resolvePreparation({ text: 'old', language: 'vi', fallback: true }); await preparing
  assert.equal(x.spoken.length, speechCount)
  assert.equal(context.playingRef.current, false)
  const lastAudio = x.audios[x.audios.length - 1]
  const playerTree = ts.createSourceFile('AudioPlayer.tsx', player, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let cleanupEffect
  const findCleanup = node => {
    if (ts.isCallExpression(node) && node.expression.getText(playerTree) === 'useEffect' && node.arguments[0].getText(playerTree).includes('generation.current += 1')) cleanupEffect = node.arguments[0].getText(playerTree)
    ts.forEachChild(node, findCleanup)
  }
  findCleanup(playerTree)
  vm.runInContext(compile(`globalThis.cleanup = (${cleanupEffect})()`), context)
  context.cleanup()
  assert.equal(lastAudio.paused, false)
  console.log('PASS: new playback invalidates pending speech; old component cleanup does not stop newer GPS audio')

  x.api.claimAudioPlayback(localAudio)
  localAudio.paused = false
  assert.equal(lastAudio.paused, true)
  await x.api.playNarration(place, 'ko-KR')
  assert.equal(localAudio.paused, true)
  await x.api.playNarration(place, 'vi')
  assert.equal(x.spoken[x.spoken.length - 1].text, place.copy.vi.narration)
  assert.equal(x.audios.every(audio => audio.paused), true)
  const cancellations = x.window.speechSynthesis.cancelCalls
  x.api.claimAudioPlayback(localAudio)
  assert.ok(x.window.speechSynthesis.cancelCalls > cancellations)
  console.log('PASS: manual MP3, GPS MP3 and language change share one playback owner')

  const mobileSource = read('clients/mobile/App.tsx')
  const tree = ts.createSourceFile('App.tsx', mobileSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const picker = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'pickMobileVoice').getText(tree)
  const texts = {}
  vm.runInNewContext(compile(read('clients/mobile/uiText.ts')), { exports: texts })
  function mobile(voices, cached = null) {
    let output, message, playing = false, calls = 0
    const context = { language: 'ko-KR', languages, speechLocales: { vi: 'vi-VN', 'ko-KR': 'ko-KR' },
      narrationGeneration: ref(0), currentLanguage: { offline: 'offline' },
      Speech: { stop: async () => {}, getAvailableVoicesAsync: async () => voices, speak: (text, options) => { output = { text, options } } },
      AsyncStorage: { getItem: async key => key.endsWith(':vi') ? cached : null },
      api: async url => { calls++; return { text: url.endsWith('=vi') ? 'Vietnamese from API' : 'Korean from API' } },
      setPlaying: value => { playing = value }, setMessage: value => { message = value }, setSelectedId() {}, mt: texts.mt }
    vm.createContext(context)
    vm.runInContext(compile(`${picker}; globalThis.play = ${arrow(mobileSource, 'App', 'playPlace')}`), context)
    return { context, output: () => output, message: () => message, playing: () => playing, calls: () => calls }
  }
  let m = mobile([{ identifier: 'vi', language: 'vi-VN' }])
  await m.context.play(place)
  assert.equal(m.output().text, 'Vietnamese from API')
  assert.equal(m.output().options.voice, 'vi')
  assert.equal(m.message(), texts.mt('ko-KR', 'voiceFallback', { name: 'Korean' }))
  m = mobile([{ identifier: 'ko', language: 'ko_KR' }])
  await m.context.play(place)
  assert.equal(m.output().text, 'Korean from API'); assert.equal(m.message(), '')
  m = mobile([])
  await m.context.play(place)
  assert.equal(m.output(), undefined); assert.equal(m.playing(), false); assert.equal(m.calls(), 0)
  assert.equal(m.message(), texts.mt('ko-KR', 'voiceMissing'))
  console.log('PASS: mobile selects explicit voice, uses Vietnamese content on fallback and stays silent with no voice')

  m = mobile([{ identifier: 'vi', language: 'vi-VN' }], JSON.stringify({ narration: 'Vietnamese offline' }))
  await m.context.play(place)
  assert.equal(m.output().text, 'Vietnamese offline'); assert.equal(m.calls(), 0)
  let release
  m.context.Speech.getAvailableVoicesAsync = () => new Promise(resolve => { release = resolve })
  const pending = m.context.play(place)
  await flush()
  m.context.narrationGeneration.current++
  release([{ identifier: 'ko', language: 'ko-KR' }]); await pending
  assert.equal(m.output().text, 'Vietnamese offline')
  console.log('PASS: mobile uses cached Vietnamese narration and ignores cancelled voice lookup')

  m = mobile([{ identifier: 'ko', language: 'ko-KR' }])
  await m.context.play(place)
  const oldOptions = m.output().options
  await m.context.play(place)
  oldOptions.onDone()
  assert.equal(m.playing(), true)
  m.context.setLanguage = () => {}
  m.context.LANGUAGE_KEY = 'language'
  m.context.AsyncStorage.setItem = async () => {}
  vm.runInContext(compile(`globalThis.chooseLanguage = ${arrow(mobileSource, 'App', 'chooseLanguage')}`), m.context)
  m.context.chooseLanguage('vi')
  assert.equal(m.playing(), false)
  oldOptions.onError()
  assert.equal(m.message(), '')
  console.log('PASS: mobile ignores old speech callbacks and stops on language change')

  const webTexts = {}
  vm.runInNewContext(compile(read('clients/frontend/src/uiText.ts')), { exports: webTexts, require: () => ({}) })
  for (const key of ['voiceFallback', 'voiceMissing']) for (const lang of ['vi', 'en', 'ja', 'fr', 'zh-CN', 'ko-KR', 'es']) {
    assert.ok(texts.mobileText[key][lang]); assert.equal(texts.mobileText[key][lang].includes('?'), false)
    assert.ok(webTexts.uiText[key][lang]); assert.equal(webTexts.uiText[key][lang].includes('?'), false)
  }
  console.log('PASS: web and mobile voice messages contain intact translations in all seven languages')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
