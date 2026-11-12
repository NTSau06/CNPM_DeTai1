"""Check the running local web app and the API calls used on place pages."""
import httpx


def main():
    with httpx.Client(timeout=20, trust_env=False) as client:
        for port in (8001, 8002, 8003, 8004):
            response = client.get(f"http://127.0.0.1:{port}/health")
            response.raise_for_status()
            print(f"PASS backend :{port}", flush=True)
        for path in (
            "/", "/api/v1/health", "/api/v1/places", "/api/v1/tickets/prices",
            "/api/v1/analytics/presence", "/api/v1/places/cua-tung-beach/analytics",
            "/api/v1/places/cua-tung-beach/ratings",
        ):
            response = client.get("http://127.0.0.1:5173" + path)
            response.raise_for_status()
            print(f"PASS web {path}: HTTP {response.status_code}", flush=True)
        places = client.get("http://127.0.0.1:5173/api/v1/places").json()
        assert places["total"] >= 14
        narration = client.get("http://127.0.0.1:5173/api/v1/narrations/cua-tung-beach?locale=vi")
        narration.raise_for_status()
        assert len(narration.json()["text"]) > 1000
        for language in ("vi", "ja"):
            audio = client.head(f"http://127.0.0.1:5173/audio/cua-tung-beach/{language}.mp3")
            audio.raise_for_status()
            assert int(audio.headers["content-length"]) > 1_000_000
        print(f"PASS: {places['total']} places, long narration, and MP3 assets.")


if __name__ == "__main__":
    main()
