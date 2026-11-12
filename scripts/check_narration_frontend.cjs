// Exercise the real speech helpers without needing a browser or a backend.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '..')
const frontendRequire = createRequire(path.join(root, 'clients/frontend/package.json'))
const ts = frontendRequire('typescript')
const scripts = require('../clients/frontend/src/data/narrationScripts.json')
const manifest = require('../clients/frontend/src/data/narrationAudio.json')
const places = require('../server/services/poi_service/data/places.json')
const locales = ['vi', 'en', 'ja', 'fr', 'zh-CN', 'ko-KR', 'es']
const defaultData = { exports: {} }
const compiledPlaces = ts.transpileModule(
  fs.readFileSync(path.join(root, 'clients/frontend/src/data/places.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText
new Function('require', 'module', 'exports', compiledPlaces)((name) => {
  if (name === './placeDetails') return {
    placeDetails: Object.fromEntries(places.map(place => [place.id, { sections: [], image: {} }])),
  }
  throw new Error(`Unexpected data dependency: ${name}`)
}, defaultData, defaultData.exports)
assert.deepEqual(new Set(defaultData.exports.languages.map(item => item.code)), new Set(locales))
for (const place of defaultData.exports.places) {
  for (const locale of locales) {
    assert.equal(place.copy[locale].narration, scripts[place.id][locale].originalNarration,
      `Bundled frontend copy must match the script baseline: ${place.id}/${locale}`)
  }
}
const source = fs.readFileSync(path.join(root, 'clients/frontend/src/speech.ts'), 'utf8')
  .replaceAll('import.meta.env.BASE_URL', "'/demo/'")
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText
const loaded = { exports: {} }
new Function('require', 'module', 'exports', compiled)((name) => {
  if (name.endsWith('narrationScripts.json')) return scripts
  if (name.endsWith('narrationAudio.json')) return manifest
  if (name === './data/places') return { languages: locales.map(code => ({ code, speech: code })) }
  throw new Error(`Unexpected dependency: ${name}`)
}, loaded, loaded.exports)
const speech = loaded.exports

for (const place of [...places, ...defaultData.exports.places]) {
  for (const locale of locales) {
    const metadata = manifest[place.id][locale]
    assert.equal(speech.getNarrationText(place, locale), scripts[place.id][locale].text)
    assert.equal(speech.getNarrationAudioLanguage(place, locale), locale)
    assert.equal(speech.getNarrationDurationSeconds(place, locale), metadata.durationSeconds)
    assert.equal(speech.getNarrationAudioUrl(place, locale), `/demo/audio/${place.id}/${locale}.mp3?v=${metadata.audioSha256.slice(0, 12)}`)
  }
}
const edited = structuredClone(places[0])
edited.copy.en.narration = 'A custom narration edited by the administrator.'
assert.equal(speech.getNarrationText(edited, 'en'), edited.copy.en.narration)
assert.equal(speech.getNarrationAudioUrl(edited, 'en'), undefined)
assert.equal(speech.getNarrationAudioLanguage(edited, 'en'), 'en')
assert.equal(speech.getNarrationDurationSeconds(edited, 'en'), undefined)
edited.copy.en.audioUrl = '/custom-audio.mp3'
assert.equal(speech.getNarrationAudioUrl(edited, 'en'), '/custom-audio.mp3')
edited.copy.vi.audioUrl = ''
assert.equal(speech.getNarrationAudioUrl(edited, 'vi'), undefined)
assert.equal(speech.getNarrationDurationSeconds(edited, 'vi'), undefined)
console.log('PASS: 98 locale selections, audio paths, transcripts, durations; admin overrides and TTS fallback.')
