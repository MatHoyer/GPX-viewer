# GPX Viewer

Import your GPX files and see all your hikes on one map.

- **Backend**: Go, chi, GORM (AutoMigrate), PostgreSQL + PostGIS
- **Frontend**: React, Vite, TypeScript, shadcn/ui, [mapcn](https://mapcn.dev) (MapLibre)
- The Go binary embeds the built frontend and serves it alongside the API.

## Quick start

```bash
docker compose up --build
```

Open http://localhost:8080, create an account and import `.gpx` files.

## Development

Requires Go 1.26+, Node 24+, pnpm and Docker.

```bash
cp .env.example .env
make dev-db     # PostGIS in docker
make web        # build the frontend once (embedded into the Go binary)
make dev-api    # API + built frontend on :8080
make dev-web    # optional: Vite dev server with HMR on :5173, /api proxied to :8080
```

Tests:

```bash
make test               # unit tests
make test-integration   # repository tests against the dev database
make lint
```

## Architecture

Clean architecture: dependencies point inward, `domain` has no framework imports.

```
cmd/api/                    composition root (wiring + HTTP server)
internal/
  domain/                   entities, repository & service ports, domain errors
  usecase/                  application logic (auth, hike)
  infrastructure/
    postgres/               GORM models, PostGIS geometry type, repositories
    gpx/                    GPX parsing (tkrajina/gpxgo)
    security/               bcrypt password hashing
  delivery/http/            chi router, handlers, DTOs, middleware, SPA serving
web/                        React app; web/embed.go embeds web/dist
```

Adding a feature usually means: an entity/port in `domain`, a service in `usecase`, an adapter in `infrastructure`, and a handler in `delivery/http`, wired in `cmd/api/main.go`.

### Data

- `users`, `sessions` (server-side, only the SHA-256 of the token is stored), `hikes`.
- Hike tracks are stored as `geometry(MultiLineStringZ, 4326)` with a GiST index; the original GPX is kept in `gpx_raw`.
- `GET /api/hikes/tracks` returns a simplified GeoJSON `FeatureCollection` (`ST_SimplifyPreserveTopology`) for the map.

### API

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | `{email, password}`, starts a session |
| POST | `/api/auth/login` | `{email, password}`, sets the `session` cookie |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | current user |
| GET | `/api/hikes` | hikes with stats and bounds |
| POST | `/api/hikes` | multipart `files` (one or more GPX), per-file results |
| GET | `/api/hikes/tracks` | GeoJSON of all tracks |
| GET | `/api/hikes/{id}` | one hike |
| DELETE | `/api/hikes/{id}` | delete a hike |

### Configuration

| Variable | Default | |
| --- | --- | --- |
| `DATABASE_URL` | required | Postgres DSN |
| `PORT` | `8080` | |
| `COOKIE_SECURE` | `false` | set `true` behind HTTPS |
| `MAX_UPLOAD_MB` | `20` | per file |
