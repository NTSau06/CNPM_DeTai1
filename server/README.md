# Backend services — Quảng Trị

The backend is a runnable three-layer application split into an API gateway and
four independently started services. It uses FastAPI, Pydantic, HTTPX and
SQLite so the class project can run locally without provisioning a database.

## Run the full stack

From the repository root:

```powershell
docker compose -f server/compose.yml up --build
```

The gateway is available at `http://localhost:8000`; interactive API docs are at
`http://localhost:8000/docs`. The web app's Vite development server proxies
`/api` to the gateway. The POI, tour, narration and analytics services remain private on
the Compose network. Named volumes persist POI, tour and analytics data.

Docker Compose is required for this one-command multi-service run. Without
Docker on Windows, you can use the repository venv and PID scripts from the
repository root. Create the environment and install dependencies once:

```powershell
py -3.12 -m venv venvs\.venv
.\venvs\.venv\Scripts\python.exe -m pip install -r server\requirements.txt
```

Start and stop the backend services with:

```powershell
npm run backend:start
npm run backend:stop
```

The services run in the background. Their process IDs are stored in
`server\var\run\` and logs are written to `server\var\logs\`. Local SQLite
databases are stored in `server\var\`. Run the frontend separately with
`npm --prefix clients\frontend run dev`. Do not combine this method with
`npm run dev` or Docker Compose, which also starts the backend services.

Without the PID scripts, you can also start the four services in separate
terminals from the repository root after installing `server/requirements.txt`:

```powershell
$env:PYTHONPATH = "$PWD\server"
python -m uvicorn services.poi_service.main:app --port 8001
python -m uvicorn services.tour_service.main:app --port 8002
python -m uvicorn services.narration_service.main:app --port 8003
python -m uvicorn services.analytics_service.main:app --port 8004
```

Start the gateway in a fifth terminal:

```powershell
$env:PYTHONPATH = "$PWD\server"
$env:POI_SERVICE_URL = "http://127.0.0.1:8001"
$env:TOUR_SERVICE_URL = "http://127.0.0.1:8002"
$env:NARRATION_SERVICE_URL = "http://127.0.0.1:8003"
$env:ANALYTICS_SERVICE_URL = "http://127.0.0.1:8004"
python -m uvicorn api_gateway.main:app --port 8000
```

For disposable local data, set `POI_DATABASE_PATH` and `TOUR_DATABASE_PATH` to
paths outside the repository; otherwise the services create `server/var/` SQLite
files. The POI seed is derived from the existing frontend catalog so both
clients start with the same 14 places and seven reviewed locale copies.

## Three-layer and service boundaries

- **Presentation:** gateway routes in `api_gateway/api.py` and service routers
  in `services/*/api.py` handle HTTP, DTO validation and status codes.
- **Business/application:** `PlaceCatalog`, `TourPlanner` and
  `NarrationReader` implement catalog, tour and narration use cases.
- **Data access:** POI, tour and analytics repositories own SQLite access and seed/data
  serialization.
- **POI Service:** serves the canonical catalog and resolves tour stop IDs.
- **Tour Service:** calls POI Service over HTTP before calculating and saving a
  tour.
- **Narration Service:** calls POI Service over HTTP and returns localized text
  plus the locale identifier for device speech synthesis.
- **Analytics Service:** persists proximity-verified, anonymous daily visits,
  and one editable rating per anonymous device/place. Public per-place
  statistics show visits from the last 30 days and the average rating from all
  submitted ratings. Rating submissions are not identity-verified; device
  identifiers can be reset or spoofed. Visits count app users who enable GPS,
  not all people physically visiting a destination. There is no ticket-sales
  data source in the application, so ticket counts are not displayed.
- **API Gateway:** routes web/mobile clients to the internal services; service
  URLs are supplied through environment variables.

The current tour endpoints are for the course prototype and do not yet include
user authentication/authorization. Do not expose tour reads/writes on a public
production deployment until a real identity/ownership policy is added.

## API examples

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/places
Invoke-RestMethod http://localhost:8000/api/v1/places/phong-nha-cave/analytics
Invoke-RestMethod "http://localhost:8000/api/v1/narrations/phong-nha-cave?locale=ja"
```

```powershell
$tour = @{
  id = [guid]::NewGuid().ToString()
  createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  placeIds = @('phong-nha-cave', 'thien-duong-cave')
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/tours `
  -ContentType 'application/json' -Body $tour
```

## Verification and CI/CD

```powershell
$env:PYTHONPATH = "$PWD\server"
python -m pip install -r server/requirements-dev.txt
python -m pytest server/tests/test_services.py -q
python server/tests/smoke_api.py
```

`.github/workflows/backend-ci-cd.yml` runs unit tests, brings up the Compose
stack and exercises gateway-to-service calls on pull requests. A successful
push to `main` also publishes a versioned container image to GHCR. The published
image is deployable with the Compose file after replacing its local `build`
configuration with the corresponding image tag.
