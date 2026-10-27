# Backend services — Quảng Trị

The backend is a runnable three-layer application split into an API gateway and
four independently started services. It uses FastAPI, Pydantic, HTTPX and
SQLite so the class project can run locally without provisioning a database.

## Run the full stack

From the repository root:

```powershell
docker compose --env-file .env -f server/compose.yml up --build
```

The gateway is available at `http://localhost:8000`; interactive API docs are at
`http://localhost:8000/docs`. The web app's Vite development server proxies
`/api` to the gateway. The POI, tour, narration and analytics services remain private on
the Compose network. Named volumes persist accounts, POI, tour and analytics data.

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

The POI seed is derived from the existing frontend catalog so both clients
start with the same 14 places and seven reviewed locale copies.

## Three-layer and service boundaries

- **Presentation:** gateway routes in `api_gateway/api.py` and service routers
  in `services/*/api.py` handle HTTP, DTO validation and status codes.
- **Business/application:** `PlaceCatalog`, `TourPlanner` and
  `NarrationReader` implement catalog, tour and narration use cases.
- **Data access:** POI, tour and analytics repositories own SQLite access and
  seed/data serialization.
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
  not all people physically visiting a destination. Ticket bookings are
  simulated and do not represent real paid or validated tickets.
- **API Gateway:** routes web/mobile clients to the internal services; service
  URLs are supplied through environment variables.

Email-and-password registration/login is provided by the Gateway. Passwords are
stored as salted scrypt hashes, and issued bearer sessions expire after 30 days.
Tour list, create and delete endpoints require a valid account session; each
saved tour is scoped to its owner. The web and mobile clients restore the session
and account's tours on reload. This is a course-project authentication implementation, not a
substitute for a production identity provider, HTTPS, rate limiting or account
recovery.

Ticket orders are an authenticated test flow, not real payment processing.
Administrators configure a positive VND price per place; a blank price disables
sales. Each successful order records a price snapshot, ticket quantity and
simulated revenue. Users can see their own order totals; admins see aggregate
sales and revenue in `/admin`. No payment provider or real ticket validation is
integrated. Initial demo prices are seeded for the sample catalog in the
70,000–150,000 VND range and are not official venue prices; verify tariffs with
the venue before any real use. Admin changes persist and are not overwritten
when the gateway restarts.

The gateway bootstraps the administrator account from `ADMIN_EMAIL` and
`ADMIN_PASSWORD` on startup. Both values are required together; the password
must contain at least 12 characters. Keep them in an untracked local `.env` or
deployment secret store. Admin credentials and sessions are stored in the
separate `admin_accounts.sqlite` database (`ADMIN_DATABASE_PATH`); user accounts,
user sessions and ticket orders remain in `accounts.sqlite`. Legacy admin rows
matching the configured admin email are migrated out of the user table when the
gateway starts. The web app sends an authenticated heartbeat every 30 seconds
while visible. The protected
`/api/v1/admin/overview` endpoint reports distinct user accounts with at least
one unexpired login session and an analytics summary; multiple device sessions
for one account count once. Admin sessions do not count as user accounts.
Expired or revoked sessions and guest sessions are not counted. It does not
expose user profiles.

## API examples

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/places
Invoke-RestMethod http://localhost:8000/api/v1/places/phong-nha-cave/analytics
Invoke-RestMethod "http://localhost:8000/api/v1/narrations/phong-nha-cave?locale=ja"
```

```powershell
$account = Invoke-RestMethod -Method Post `
  -Uri http://localhost:8000/api/v1/auth/register `
  -ContentType 'application/json' `
  -Body (@{ fullName = 'Nguyen An'; email = 'an@example.com'; password = 'mat-khau-123' } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($account.token)" }

$tour = @{
  id = [guid]::NewGuid().ToString()
  createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  placeIds = @('phong-nha-cave', 'thien-duong-cave')
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/tours `
  -Headers $headers -ContentType 'application/json' -Body $tour
Invoke-RestMethod -Uri http://localhost:8000/api/v1/tours -Headers $headers
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
