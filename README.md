# GPX Viewer

Import your GPX files and see all your hikes on one map.

- **Backend**: Go, chi, GORM (AutoMigrate), PostgreSQL + PostGIS
- **Frontend**: React, Vite, TypeScript, shadcn/ui, [mapcn](https://mapcn.dev) (MapLibre)
- The Go binary embeds the built frontend and serves it alongside the API.
- `/hikes/{id}` pages of hikes anyone may see get their title and Open Graph tags filled in server-side, pointing at the hike's `card.png`, so shared links unfurl with a preview.
- The home page (`web/home.html`, `web/src/home/`) is prerendered to static HTML at build time and served at `/` to signed-out visitors; signed-in users get the app there. `robots.txt` and `sitemap.xml` are generated from `APP_URL`.

## Quick start

```bash
docker compose up --build
```

Open http://localhost:8080, create an account and import `.gpx` files. The email verification link lands in Mailpit at http://localhost:8025.

The first account becomes the admin. The admin panel (`/admin`, from the account menu) lists users (paginated and searchable, each with a page showing their sessions), invites people, bans them with a reason they see when they try to sign in, and makes other users admins. Set `REGISTRATION_ENABLED=false` to make the instance invite-only: the first account can still sign up, then only admins add people, by invite link (copied or emailed).

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

- `users` (with a `visibility`: `private`, `friends` or `public`, `email_verified_at`, `is_admin`, and `banned_at`/`ban_reason`; on startup the oldest user is made admin if there is none), `sessions` (server-side, only the SHA-256 of the token is stored, with a public `id`, the user agent and IP of the sign-in, and `last_used_at`, refreshed with the IP at most every 5 minutes), `email_verifications` (one pending link per user, hashed like sessions, valid 24h), `hikes`, `friendships` (one row per pair, accepted or pending), `hike_participants` (friends tagged on a hike), `hike_labels` (the owner's free-form labels; "labels" because tagging means adding a friend).
- Avatars are [blobatars](https://github.com/Alain00/blobatar) generated from the user id; there is no picture upload.
- A hike is visible to whoever may see its owner's hikes or those of a tagged participant; anything else answers 404.
- Hike tracks are stored as `geometry(MultiLineStringZ, 4326)` with a GiST index; the original GPX is kept in `gpx_raw`.
- Stats derived from the GPX (elevation loss, min/max elevation, moving time, and best efforts: the fastest 1, 5, 10, 21.1 and 42.2 km in `hike_best_efforts`, and the zoom-14 tiles crossed in `hike_tiles`) are computed on import and stamped with `derived_version`; on startup a background job recomputes hikes stored by an older version (bump `hike.DerivedVersion` when adding one).
- `GET /api/hikes/tracks` returns a simplified GeoJSON `FeatureCollection` (`ST_SimplifyPreserveTopology`) for the map.
- A hike with `planned` set is a route not walked yet: it shows (dashed) on the map but is left out of stats, records, tiles, summits and repeated routes until marked done. Only the route of a planned GPX is kept: timestamps and sensor data (heart rate, cadence, temperature) are dropped, since they belong to whoever recorded it. Marking it done can take the GPX recorded on the walk, which replaces the route.
- Peaks come from OpenStreetMap (`natural=peak` nodes with a name) and are loaded per region with `api import-peaks -bbox minLon,minLat,maxLon,maxLat` (same environment as the server; `-overpass` picks another Overpass instance). Summits are matched on demand, so new peaks apply to past hikes too.

### API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/config` | `{registrationEnabled, registrationOpen}`; open when enabled or before the first account exists |
| POST | `/api/auth/register` | `{email, password}`, emails a verification link; no session until verified; `403` `code: registration_closed` when invite-only. The first account is admin |
| POST | `/api/auth/login` | `{email, password}`, sets the `session` cookie; `403` `code: email_not_verified` while the email is unverified, emailing a new link if the last one expired; `403` `code: banned` with `reason` for a banned account |
| POST | `/api/auth/verify` | `{token}` from the emailed `/verify?token=` link, verifies and sets the `session` cookie |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | current user (`name`, `visibility`, `createdAt`) |
| PATCH | `/api/me` | `{name}` to set the display name (empty clears it), `{visibility}` to set who sees your hikes |
| GET | `/api/me/sessions` | your live sessions (`id`, `userAgent`, `ip`, `createdAt`, `lastUsedAt`, `expiresAt`, `current`), most recently used first |
| DELETE | `/api/me/sessions/{id}` | sign out one of your other devices; the current session is refused |
| DELETE | `/api/me/sessions` | sign out every device but this one |
| DELETE | `/api/me` | `{password}`; permanently deletes the account with its hikes, tags, friendships, kudos and comments, and signs out |
| GET | `/api/hikes` | your hikes and those you are tagged on, with stats, bounds, `owner` and `participants` |
| POST | `/api/hikes` | multipart `files` (one or more GPX), per-file results; `?planned=true` stores them as planned routes, without times or sensor data |
| GET | `/api/hikes/tracks` | GeoJSON of all tracks |
| GET | `/api/hikes/export` | zip of the original GPX of every hike you own, named `YYYY-MM-DD name.gpx` |
| POST | `/api/hikes/export` | `{ids}` (up to 1000): the same zip, limited to those hikes you own |
| POST | `/api/hikes/delete` | `{ids}` (up to 1000): deletes those you own, skipping the others; returns `{deleted}` |
| GET | `/api/labels` | labels on your hikes, most used first |
| GET | `/api/tiles` | `{zoom, hikes: {id: [[x, y], …]}}`: the zoom-14 map tiles each of your hikes passes through |
| GET | `/api/summits` | every peak you reached (track within 50 m), with the hikes that went over it |
| GET | `/api/feed` | `{hikes, next}`: 20 recent done hikes from friends who share theirs and hikes you were tagged on; pass `?after=<next>` for the following page |
| GET | `/api/hikes/{id}` | one hike with `owner`, `participants` and `interactions` (`{kudos, comments, kudoed}`); readable signed out when shared publicly |
| GET | `/api/hikes/{id}/gpx` | the original GPX file, for whoever can see the hike |
| GET | `/api/hikes/{id}/card.png` | 1200×630 link preview of the hike (track and stats), for whoever can see it |
| GET | `/api/hikes/{id}/summits` | the named peaks the hike went over, highest first |
| GET | `/api/hikes/{id}/profile` | columnar series (distance, time, speed, elevation, HR, cadence, temperature) + summary, from the stored GPX |
| PATCH | `/api/hikes/{id}` | any of `{name, notes, labels}`; labels are lowercased, deduplicated and sorted, `[]` clears them |
| POST | `/api/hikes/{id}/done` | mark a planned hike as walked; optional multipart `file` (the recorded GPX) replaces its route |
| DELETE | `/api/hikes/{id}` | delete a hike |
| GET | `/api/hikes/{id}/similar` | your other hikes along the same route (tracks within 200 m of each other, either direction) |
| PUT / DELETE | `/api/hikes/{id}/kudos` | give or take back kudos on a hike you can see |
| GET | `/api/hikes/{id}/comments` | comments with their authors, oldest first; readable like the hike |
| POST | `/api/hikes/{id}/comments` | `{body}` (up to 2000 characters), on a hike you can see |
| DELETE | `/api/hikes/{id}/comments/{commentId}` | by its author or the hike's owner |
| PUT | `/api/hikes/{id}/participants/{userId}` | tag a friend on your hike |
| DELETE | `/api/hikes/{id}/participants/{userId}` | untag (owner, or the participant themselves) |
| GET | `/api/users/{id}` | public profile: `user`, `visibility`, `relation`, `canView`; signed out only when public |
| GET | `/api/users/{id}/hikes` | their hikes, if visible to you |
| GET | `/api/users/{id}/hikes/tracks` | GeoJSON of their tracks, if visible to you |
| GET | `/api/friends` | `{friends, incoming, outgoing}` |
| PUT | `/api/friends/{id}` | send a friend request, or accept theirs |
| DELETE | `/api/friends/{id}` | unfriend, cancel or decline |
| GET | `/api/admin/users` | admins only: `{users, total, page, pageSize}`, 20 users a page (`?page=`, from 1), oldest first, `?q=` searches emails and names; each with `isAdmin`, `emailVerifiedAt`, `bannedAt`, `banReason`, `hikes`, `lastSeenAt` |
| GET | `/api/admin/users/{id}` | one user, same fields |
| GET | `/api/admin/users/{id}/sessions` | their live sessions |
| DELETE | `/api/admin/users/{id}/sessions/{sessionId}` / `/sessions` | sign them out of one device / everywhere; unlike a ban, they can sign in again |
| POST | `/api/admin/users` | `{email, name, sendEmail}`: creates the account and returns `{user, inviteLink, emailSent}`; the `/reset-password?invite=1&token=` link is valid 7 days |
| POST | `/api/admin/users/{id}/invite` | `{sendEmail}`: new invite link for a user who has not signed in yet |
| DELETE | `/api/admin/users/{id}/invite` | revoke the invite: deletes the account if it never signed in and owns no hikes, voiding its link |
| PUT / DELETE | `/api/admin/users/{id}/ban` | `{reason}` bans and signs them out everywhere / lifts the ban; admins must be demoted first |
| PUT / DELETE | `/api/admin/users/{id}/admin` | make admin / remove the role; not on yourself |

### Configuration

| Variable | Default | |
| --- | --- | --- |
| `DATABASE_URL` | required | Postgres DSN |
| `PORT` | `8080` | |
| `COOKIE_SECURE` | `false` | set `true` behind HTTPS |
| `MAX_UPLOAD_MB` | `20` | per file |
| `REGISTRATION_ENABLED` | `true` | `false` makes the instance invite-only; shown read-only in the admin panel |
| `APP_URL` | `http://localhost:$PORT` | public URL, used in emailed links, canonical and Open Graph links, and the sitemap |
| `SMTP_HOST` | required | |
| `SMTP_PORT` | `587` | `465` uses implicit TLS, other ports STARTTLS when offered |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | empty | no auth when empty; never sent unencrypted except to localhost |
| `SMTP_FROM` | required | e.g. `GPX Viewer <noreply@example.com>` |

Accounts created before email verification existed start unverified: their first sign-in attempt emails them a link.
