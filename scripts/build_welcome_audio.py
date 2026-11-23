"""Generate the Vietnamese welcome MP3 using the existing Google TTS helper."""
import hashlib
import json

from mutagen.mp3 import MP3

from build_narrations import AUDIO, ROOT, WORK, save_google_audio


def main():
    metadata_path = ROOT / "clients/frontend/src/data/welcomeAudio.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    WORK.mkdir(parents=True, exist_ok=True)
    temporary = WORK / "welcome-vi.mp3"
    save_google_audio(metadata["text"], "vi", temporary)
    duration = MP3(temporary).info.length
    if duration <= 0:
        raise ValueError("Generated welcome audio is empty")
    AUDIO.mkdir(parents=True, exist_ok=True)
    target = AUDIO / "welcome-vi.mp3"
    temporary.replace(target)
    metadata.update(
        durationSeconds=round(duration, 3),
        audioSha256=hashlib.sha256(target.read_bytes()).hexdigest(),
        bytes=target.stat().st_size,
    )
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PASS: welcome-vi.mp3; {duration:.1f} seconds; {target.stat().st_size} bytes")


if __name__ == "__main__":
    main()
