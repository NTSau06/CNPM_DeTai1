"""Build translated narration scripts and measured MP3 assets (no silence/loops).

Run with the optional dependencies in narration-requirements.txt. Translation and
speech generation send public tour scripts to Google or Microsoft. Existing successful
translations and recordings are reused; --verify performs an offline audit only.
"""
from __future__ import annotations

import argparse
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "server/services/poi_service/data/places.json"
SCRIPTS = ROOT / "clients/frontend/src/data/narrationScripts.json"
MANIFEST = ROOT / "clients/frontend/src/data/narrationAudio.json"
AUDIO = ROOT / "clients/frontend/public/audio"
WORK = ROOT / ".audio-work"
LOCALES = ("vi", "en", "ja", "fr", "zh-CN", "ko-KR", "es")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def save_google_audio(text, locale, target):
    """Use Google's audio endpoint with small cached chunks and a gentle pace."""
    import requests
    from gtts import gTTS
    language = {"ko-KR": "ko"}.get(locale, locale)
    tokenizer = gTTS(text, lang=language, lang_check=False)
    tokenizer.GOOGLE_TTS_MAX_CHARS = 180
    with requests.Session() as session, target.open("wb") as output:
        for chunk in tokenizer._tokenize(text):
            cache = WORK / "google-chunks" / locale / f"{digest(chunk)}.mp3"
            if not cache.exists():
                response = session.get("https://translate.googleapis.com/translate_tts",
                    params={"ie": "UTF-8", "client": "tw-ob", "tl": language, "q": chunk}, timeout=30)
                response.raise_for_status()
                if not response.headers.get("content-type", "").startswith("audio/"):
                    raise ValueError("Speech endpoint returned no audio")
                cache.parent.mkdir(parents=True, exist_ok=True)
                cache.write_bytes(response.content)
                time.sleep(0.3)
            output.write(cache.read_bytes())


def translate(text, locale):
    import requests

    target = {"ko-KR": "ko"}.get(locale, locale)
    # Paragraph boundaries keep each request small and preserve the tour structure.
    paragraphs = []
    for paragraph in text.split("\n\n"):
        for attempt in range(5):
            try:
                cache = WORK / "translations" / f"{locale}-{digest(paragraph)}.json"
                if cache.exists():
                    paragraphs.append(read_json(cache))
                    break
                payload = json.dumps([[['MkEWBc', json.dumps([[paragraph, 'vi', target, True], [None]]), None, 'generic']]])
                response = requests.post(
                    "https://translate.google.com/_/TranslateWebserverUi/data/batchexecute",
                    params={"rpcids": "MkEWBc"}, data={"f.req": payload}, timeout=45,
                )
                response.raise_for_status()
                envelope = json.loads(response.text.removeprefix(")]}'").strip())
                translated = json.loads(next(part[2] for part in envelope if part[0] == "wrb.fr" and part[1] == "MkEWBc"))
                result = " ".join(part[0] for part in translated[1][0][0][5] if part[0])
                if not result.strip():
                    raise ValueError("Empty translation")
                write_json(cache, result)
                paragraphs.append(result)
                break
            except Exception:
                if attempt == 4:
                    raise
                time.sleep(2 ** attempt)
    return "\n\n".join(paragraphs)


def prepare_scripts(workers):
    seed = read_json(SEED)
    extensions = read_json(ROOT / "scripts/narration-extensions.json")
    details = (ROOT / "clients/frontend/src/data/placeDetails.ts").read_text(encoding="utf-8")
    scripts = read_json(SCRIPTS) if SCRIPTS.exists() else {}
    jobs = []
    for place in seed:
        place_id = place["id"]
        # Keep the two detailed sections. The short opening sections repeat the
        # introduction, and the final visitor-tip summary repeats the safety text.
        block = details.split("'" + place_id + "': {", 1)[1].split("image:", 1)[0]
        sections = re.findall(r"heading: '([^']*)', body: '([^']*)'", block)[2:4]
        extension = extensions["places"][place_id]
        copy = place["copy"]["vi"]
        text = "\n\n".join([
            copy["title"] + ". " + copy["subtitle"] + ". " + copy["narration"],
            *[heading + ". " + body for heading, body in sections],
            extension["text"], extensions["themes"][extension["theme"]],
        ])
        entries = scripts.setdefault(place_id, {})
        for locale in LOCALES:
            baseline = place["copy"][locale]["narration"]
            source_hash = digest(text)
            if entries.get(locale, {}).get("sourceSha256") == source_hash:
                continue
            if locale == "vi":
                entries[locale] = {"originalNarration": baseline, "text": text, "sourceSha256": source_hash}
            else:
                jobs.append((place_id, locale, baseline, text, source_hash))
    write_json(SCRIPTS, scripts)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        pending = {pool.submit(translate, text, locale): (place_id, locale, baseline, source_hash)
                   for place_id, locale, baseline, text, source_hash in jobs}
        for future in as_completed(pending):
            place_id, locale, baseline, source_hash = pending[future]
            scripts[place_id][locale] = {
                "originalNarration": baseline, "text": future.result(), "sourceSha256": source_hash,
            }
            write_json(SCRIPTS, scripts)
            print(f"TEXT {place_id}/{locale}", flush=True)
    write_json(ROOT / "server/services/narration_service/data/narrationScripts.json", scripts)
    return scripts


def render_one(place_id, locale, entry, tts_domain="com", provider="gtts"):
    from gtts import gTTS
    from mutagen.mp3 import MP3
    import imageio_ffmpeg

    target = AUDIO / place_id / f"{locale}.mp3"
    target.parent.mkdir(parents=True, exist_ok=True)
    raw = WORK / provider / place_id / f"{locale}.mp3"
    raw.parent.mkdir(parents=True, exist_ok=True)
    checksum_path = raw.with_suffix(".sha256")
    text_hash = digest(entry["text"])
    if not (raw.exists() and checksum_path.exists() and checksum_path.read_text() == text_hash):
        for attempt in range(5):
            try:
                if provider == "edge" and locale == "vi":
                    save_google_audio(entry["text"], locale, raw)
                elif provider == "edge":
                    import edge_tts
                    voices = {
                        "vi": "vi-VN-NamMinhNeural", "en": "en-US-AriaNeural",
                        "ja": "ja-JP-NanamiNeural", "fr": "fr-FR-DeniseNeural",
                        "zh-CN": "zh-CN-XiaoxiaoNeural", "ko-KR": "ko-KR-SunHiNeural",
                        "es": "es-ES-ElviraNeural",
                    }
                    asyncio.run(edge_tts.Communicate(entry["text"], voices[locale], rate="-10%").save(str(raw)))
                else:
                    gTTS(entry["text"], tld=tts_domain, lang={"ko-KR": "ko"}.get(locale, locale),
                         lang_check=False, timeout=(15, 90)).save(str(raw))
                MP3(raw)
                checksum_path.write_text(text_hash)
                break
            except Exception as error:
                if "429" in str(error):
                    raise
                if attempt == 4:
                    raise
                time.sleep(2 ** attempt)
    seconds = MP3(raw).info.length
    # Aim for four minutes, with only modest pace correction. Never pad or loop.
    tempo = max(0.85, min(1.15, seconds / 240))
    if not 180 <= seconds / tempo <= 300:
        raise ValueError(f"Revise script length: {place_id}/{locale}: {seconds:.1f}s before pace correction")
    temporary = target.with_suffix(".tmp.mp3")
    subprocess.run([
        imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(raw), "-af", f"atempo={tempo:.6f}", "-codec:a", "libmp3lame",
        "-b:a", "64k", str(temporary),
    ], check=True)
    measured = MP3(temporary).info.length
    if not 180 <= measured <= 300:
        raise ValueError(f"Duration outside 3–5 minutes: {place_id}/{locale}: {measured}")
    temporary.replace(target)
    return {
        "durationSeconds": round(measured, 3), "textSha256": text_hash,
        "audioSha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "bytes": target.stat().st_size, "tempo": round(tempo, 6),
        "provider": "google" if provider == "edge" and locale == "vi" else provider,
    }


def verify():
    from mutagen.mp3 import MP3

    scripts, manifest = read_json(SCRIPTS), read_json(MANIFEST)
    assert scripts == read_json(ROOT / "server/services/narration_service/data/narrationScripts.json")
    places = read_json(SEED)
    durations = []
    assert len(places) == len(scripts) == len(manifest) == 14
    expected_files = {AUDIO / place["id"] / f"{locale}.mp3" for place in places for locale in LOCALES}
    assert set(AUDIO.glob("*/*.mp3")) == expected_files, "Unexpected or missing audio assets"
    for place in places:
        place_id = place["id"]
        assert set(scripts[place_id]) == set(manifest[place_id]) == set(LOCALES)
        for locale in LOCALES:
            entry, metadata = scripts[place_id][locale], manifest[place_id][locale]
            target = AUDIO / place_id / f"{locale}.mp3"
            seconds = MP3(target).info.length
            assert 180 <= seconds <= 300, (target, seconds)
            assert abs(seconds - metadata["durationSeconds"]) < 0.01
            assert digest(entry["text"]) == metadata["textSha256"]
            assert hashlib.sha256(target.read_bytes()).hexdigest() == metadata["audioSha256"]
            assert target.stat().st_size == metadata["bytes"]
            durations.append(seconds)
    print(f"PASS: {len(durations)} MP3s; {min(durations):.1f}–{max(durations):.1f} seconds; all transcripts/hashes match.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--texts-only", action="store_true")
    parser.add_argument("--audio-only", action="store_true")
    parser.add_argument("--place", help="Build one place only, for previewing")
    parser.add_argument("--tts-domain", default="com", help="Google regional domain supported by gTTS")
    parser.add_argument("--provider", choices=("gtts", "edge"), default="gtts")
    parser.add_argument("--workers", type=int, default=3)
    args = parser.parse_args()
    if args.verify:
        verify()
        return
    scripts = read_json(SCRIPTS) if args.audio_only else prepare_scripts(args.workers)
    if args.texts_only:
        return
    manifest = read_json(MANIFEST) if MANIFEST.exists() else {}
    jobs = []
    for place_id, entries in scripts.items():
        if args.place and place_id != args.place:
            continue
        for locale, entry in entries.items():
            metadata = manifest.get(place_id, {}).get(locale)
            target = AUDIO / place_id / f"{locale}.mp3"
            if metadata and metadata["textSha256"] == digest(entry["text"]) and target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == metadata["audioSha256"]:
                continue
            jobs.append((place_id, locale, entry))
    failures = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        pending = {pool.submit(render_one, *job, args.tts_domain, args.provider): job[:2] for job in jobs}
        for future in as_completed(pending):
            place_id, locale = pending[future]
            try:
                result = future.result()
                manifest.setdefault(place_id, {})[locale] = result
                write_json(MANIFEST, manifest)
                print(f"MP3 {place_id}/{locale}: {result['durationSeconds']:.1f}s", flush=True)
            except Exception as error:
                failures.append((place_id, locale, str(error)))
                print(f"FAIL {place_id}/{locale}: {error}", flush=True)
    if failures:
        raise SystemExit(f"{len(failures)} recordings need attention; rerun to resume.")
    if not args.place:
        verify()


if __name__ == "__main__":
    main()
