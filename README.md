# GPX Viewer

Import your GPX files and see all your hikes on one map.

- **Backend**: Go, chi, GORM (AutoMigrate), PostgreSQL + PostGIS
- **Frontend**: React, Vite, TypeScript, shadcn/ui, [mapcn](https://mapcn.dev) (MapLibre)
- The Go binary embeds the built frontend and serves it alongside the API.
- The home page (`web/home.html`, `web/src/home/`) is prerendered to static HTML at build time and served at `/` to signed-out visitors; signed-in users get the app there. `robots.txt` and `sitemap.xml` are generated from `APP_URL`.

## Quick start

```bash
docker compose up --build
```

Open http://localhost:8080, create an account and import `.gpx` files. The email verification link lands in Mailpit at http://localhost:8025.

## Development

Requires Go 1.26+, Node 24+, pnpm and Docker.

```bash
cp .env.example .env
make dev-db     # PostGIS + Mailpit (catches emails, inbox on :8025) in docker
make web        # build the frontend once (embedded into the Go binary)
make dev-api    # API + built frontend on :8080
make dev-web    # optional: Vite dev server with HMR on :5173, /api proxied to :8080
```

Tests:

```bash
make test               # Go unit tests
cd web && pnpm test     # frontend unit tests (vitest)
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
    smtp/                   SMTP mailer (net/smtp, STARTTLS or implicit TLS on 465)
  delivery/http/            chi router, handlers, DTOs, middleware, SPA serving
web/                        React app; web/embed.go embeds web/dist
```

Adding a feature usually means: an entity/port in `domain`, a service in `usecase`, an adapter in `infrastructure`, and a handler in `delivery/http`, wired in `cmd/api/main.go`.

### Data

- `users` (with a `visibility`: `private`, `friends` or `public`, and `email_verified_at`), `sessions` (server-side, only the SHA-256 of the token is stored), `email_verifications` (one pending link per user, hashed like sessions, valid 24h), `hikes`, `friendships` (one row per pair, accepted or pending), `hike_participants` (friends tagged on a hike), `hike_labels` (the owner's free-form labels; "labels" because tagging means adding a friend).
- Avatars are [blobatars](https://github.com/Alain00/blobatar) generated from the user id; there is no picture upload.
- A hike is visible to whoever may see its owner's hikes or those of a tagged participant; anything else answers 404.
- Hike tracks are stored as `geometry(MultiLineStringZ, 4326)` with a GiST index; the original GPX is kept in `gpx_raw`.
- Stats derived from the GPX (elevation loss, min/max elevation, moving time, and best efforts: the fastest 1, 5, 10, 21.1 and 42.2 km in `hike_best_efforts`, and the zoom-14 tiles crossed in `hike_tiles`) are computed on import and stamped with `derived_version`; on startup a background job recomputes hikes stored by an older version (bump `hike.DerivedVersion` when adding one).
- `GET /api/hikes/tracks` returns a simplified GeoJSON `FeatureCollection` (`ST_SimplifyPreserveTopology`) for the map.

### API

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | `{email, password}`, emails a verification link; no session until verified |
| POST | `/api/auth/login` | `{email, password}`, sets the `session` cookie; `403` while the email is unverified, emailing a new link if the last one expired |
| POST | `/api/auth/verify` | `{token}` from the emailed `/verify?token=` link, verifies and sets the `session` cookie |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | current user (`name`, `visibility`, `createdAt`) |
| PATCH | `/api/me` | `{name}` to set the display name (empty clears it), `{visibility}` to set who sees your hikes |
| GET | `/api/hikes` | your hikes and those you are tagged on, with stats, bounds, `owner` and `participants` |
| POST | `/api/hikes` | multipart `files` (one or more GPX), per-file results |
| GET | `/api/hikes/tracks` | GeoJSON of all tracks |
| GET | `/api/hikes/export` | zip of the original GPX of every hike you own, named `YYYY-MM-DD name.gpx` |
| GET | `/api/labels` | labels on your hikes, most used first |
| GET | `/api/tiles` | `{zoom, hikes: {id: [[x, y], …]}}`: the zoom-14 map tiles each of your hikes passes through |
| GET | `/api/hikes/{id}` | one hike with `owner` and `participants`; readable signed out when shared publicly |
| GET | `/api/hikes/{id}/gpx` | the original GPX file, for whoever can see the hike |
| GET | `/api/hikes/{id}/profile` | columnar series (distance, time, speed, elevation, HR, cadence, temperature) + summary, from the stored GPX |
| PATCH | `/api/hikes/{id}` | any of `{name, notes, labels}`; labels are lowercased, deduplicated and sorted, `[]` clears them |
| DELETE | `/api/hikes/{id}` | delete a hike |
| PUT | `/api/hikes/{id}/participants/{userId}` | tag a friend on your hike |
| DELETE | `/api/hikes/{id}/participants/{userId}` | untag (owner, or the participant themselves) |
| GET | `/api/users/{id}` | public profile: `user`, `visibility`, `relation`, `canView`; signed out only when public |
| GET | `/api/users/{id}/hikes` | their hikes, if visible to you |
| GET | `/api/users/{id}/hikes/tracks` | GeoJSON of their tracks, if visible to you |
| GET | `/api/friends` | `{friends, incoming, outgoing}` |
| PUT | `/api/friends/{id}` | send a friend request, or accept theirs |
| DELETE | `/api/friends/{id}` | unfriend, cancel or decline |

### Configuration

| Variable | Default | |
| --- | --- | --- |
| `DATABASE_URL` | required | Postgres DSN |
| `PORT` | `8080` | |
| `COOKIE_SECURE` | `false` | set `true` behind HTTPS |
| `MAX_UPLOAD_MB` | `20` | per file |
| `APP_URL` | `http://localhost:$PORT` | public URL, used in emailed links, canonical and Open Graph links, and the sitemap |
| `SMTP_HOST` | required | |
| `SMTP_PORT` | `587` | `465` uses implicit TLS, other ports STARTTLS when offered |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | empty | no auth when empty; never sent unencrypted except to localhost |
| `SMTP_FROM` | required | e.g. `GPX Viewer <noreply@example.com>` |

Accounts created before email verification existed start unverified: their first sign-in attempt emails them a link.
