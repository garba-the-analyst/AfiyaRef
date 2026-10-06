# AfiyaRef — Universal Unified Health Platform

Single backend + shared Postgres/PostGIS database serving both the **Mobile App** (REST API) and the **WhatsApp Bot** (Meta Cloud API webhooks). One account (`phone_number` + JWT) works on both surfaces.

## Quick start

```bash
cp .env.example .env        # fill in secrets
docker compose up -d        # postgres+postgis (:5434) + redis (:6380)
npm install
npx prisma migrate dev      # create tables
docker exec -i afiyaref-postgres psql -U afiyaref -d afiyaref < prisma/postgis-init.sql
npm run db:import           # 18 real Lagos facilities
npm run dev                 # http://localhost:3006
```

> Ports: API `3006`, Postgres `5434`, Redis `6380` (host defaults `3000`/`5432`/`6379` were taken on this machine).

## Environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (PostGIS image: `postgis/postgis:16-3.4`) |
| `REDIS_URL` | Session + WhatsApp state (`whatsapp_state:{phone}`) + Nurse history |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Mobile app auth |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Nurse Titi live mode (`gpt-4o-mini`); offline fallback if empty |
| `WHATSAPP_VERIFY_TOKEN` | Must match token set in Meta App dashboard |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION` | Meta Cloud API send + webhook |
| `WHATSAPP_APP_SECRET` | Enables `X-Hub-Signature-256` webhook verification |
| `WHATSAPP_DRY_RUN=1` | Log instead of calling Meta (local testing) |
| `ADMIN_API_KEY` | Shared secret (`x-admin-key` header) for facility creation, transfer ACK, portal |
| `TERMII_API_KEY` / `TERMII_SENDER` | Live SMS alerts (Termii); dry-run log when empty |
| `TWILIO_*` | Optional fallback provider |

## API summary

- `POST /api/auth/register` — `{phone_number, password, full_name, dob?, gender?, insurance_provider?, nhia_policy_number?, home_hospital_id?}`
- `POST /api/auth/login` — returns `{user, token}`
- `GET /api/facilities/search?lat=&lng=&radius_km=&service=&emergency_only=&accepts_nhia=` — PostGIS `ST_DWithin`/`ST_Distance`
- `GET /api/facilities/route?from_lat=&from_lng=&to_lat=&to_lng=` — OSRM driving route (`coordinates`, `distance_m`, `duration_s`; set `OSRM_BASE` to self-host in production)
- `POST /api/bookings` (auth) — `{facility_id, booking_type: DOCTOR_APPOINTMENT|LAB_TEST, scheduled_time, notes?}`
- `GET /api/bookings/mine` (auth)
- `GET|PUT /api/health-profile/me` (auth) — EHR-Lite passport
- `POST /api/transfers/checkin` (auth) — `{treating_facility_id, nhia_number_used?}` → creates `CrossFacilityTransfer` + EHR snapshot payload
- `GET /api/transfers/mine`, `GET /api/transfers/ehr-snapshot` (auth)
- `GET /api/nurse/status` (public) — `{live, model}` for Online/Offline badge
- `POST /api/nurse/chat` (auth) — `{message, lat?, lng?}` → `{reply, offline, emergency, facilities?}` (server-side Redis history; emergency + coords returns 2 nearest emergency-ready facilities)
- `DELETE /api/nurse/history` (auth) — reset conversation
- `GET /api/admin/transfers/incoming?status=&facility_id=` (admin key) — facility portal feed
- `PATCH /api/admin/transfers/:id/status` (admin key) — ACKNOWLEDGED | REJECTED
- `GET|DELETE /api/admin/transfers/notifications` (admin key) — SMS dispatch log
- `POST /api/facilities` (admin key) — create facility
- `GET /whatsapp/webhook` — Meta verification; `POST /whatsapp/webhook` — message ingress (signature-verified when `WHATSAPP_APP_SECRET` set)
- Facility portal UI: `http://localhost:3006/portal/portal.html` (paste admin key, ACK/reject with EHR snapshot view)

## Tests & hardening

```bash
npm test   # 19 vitest tests: auth, search, nurse, transfers, alerts, webhook
```

Rate limits: auth 60/15min, nurse chat 30/min, WhatsApp 120/min. Admin-only routes guarded by `ADMIN_API_KEY`.

## WhatsApp flow (Redis state machine)

Key `whatsapp_state:{phone}` ∈ `IDLE | NURSE_TITI | LOCATION_AWAIT | INTER_HOSPITAL_CHECKIN`.

1. `IDLE`: menu — 1 Find Hospital, 2 Nurse Titi, 3 Emergency Check-in, 4 Book.
2. `LOCATION_AWAIT`: user shares location attachment → text list + **native WhatsApp location bubbles** (in-chat map view, no app switch, no Google Maps links).
3. `NURSE_TITI`: every message → OpenAI with guardrail prompt until `EXIT`.
4. `INTER_HOSPITAL_CHECKIN`: user sends `NHIA_NUMBER | TREATING_HOSPITAL_NAME` → `CrossFacilityTransfer(NOTIFIED)` + EHR snapshot; home facility/HMO notified (log hook in `transfer.service.ts` — wire SMS/webhook there).

Auth friction: WhatsApp sender phone auto-matches/creates the `User` row (`passwordHash='WHATSAPP_ONLY'`), so the same account works in the app once a password is set.

### Local bot test (no Meta account needed)

```bash
npm run whatsapp:sim   # 8-step E2E through the real webhook; uses /whatsapp/dev-outbox
```

### Meta go-live checklist

1. `npm run tunnel` → copy the `https://…ngrok-free.app` URL.
2. Meta App dashboard → WhatsApp → Configuration: set Callback URL to `<ngrok-url>/whatsapp/webhook`, Verify Token = `WHATSAPP_VERIFY_TOKEN`, subscribe to `messages`.
3. Copy Phone Number ID + permanent Access Token + App Secret into `.env`; set `WHATSAPP_DRY_RUN=0`; restart.
4. Send a real WhatsApp message to the test number; watch server logs.

## Nurse Titi

- System prompt in `src/services/nurseTiti.service.ts`: empathetic triage + step-by-step first aid, mandatory disclaimer, no complex diagnosis, no controlled-medication prescriptions, emergency escalation.
- Live mode: set a real `OPENAI_API_KEY` in `.env` and restart — `GET /api/nurse/status` flips to `{"live":true}`. 3 attempts with exponential backoff; falls back to offline guidance on failure.
- Check status: `curl http://localhost:3006/api/nurse/status`.

## Facility data

- `prisma/facilities.lagos.json` — 18 real Lagos facilities (hospitals, labs, pharmacies) with services, NHIA acceptance, 24/7 and emergency flags.
- `npm run db:import` — upserts by name (safe to re-run).

## Mobile app (`mobile/` — Expo + TypeScript)

```bash
cd mobile && npm install && npx expo start
# Point API at your machine: app.json → extra.apiUrl (default http://192.168.1.198:3006; check yours with `ip route get 1.1.1.0`)
# Scan the QR with Expo Go on the same Wi-Fi.
```

Screens: Auth (register/login + JWT in AsyncStorage) → Finder (**embedded map**: Leaflet/OpenStreetMap on web, react-native-maps on device — tappable pins, OSRM road route, Call buttons) → **In-app turn-by-turn navigation** (tap Start 🧭 on a routed card: follow camera, maneuver banner with distance, remaining + ETA, voice prompts with mute, auto-reroute when off-route, arrival detection; external Navigate kept as fallback) → Nurse Titi (chat + online badge + emergency facility suggestions) → Bookings (create/list) → Profile (EHR-Lite + NHIA check-in). `npm run typecheck` in `mobile/` verifies types.
Web (`npx expo start --web`, http://localhost:8081) renders the same app in a centered phone-width frame on desktop.

## Flet app (`flet-app/` — pure-Python Android app, mirrors the Expo app)

```bash
cd flet-app && pip install -r requirements.txt
python main.py                 # desktop window / APK base
python web.py                  # browser preview → http://localhost:8550
python test_nav_logic.py       # nav-math unit tests
python smoke.py                # live end-to-end (register→search→route→chat→booking→checkin)
```

Auth, Finder + embedded OSM map, turn-by-turn navigation (banner/reroute/arrival; no voice in Flet),
Nurse chat, bookings, EHR profile, NHIA check-in. API auto-detected (`AFIYA_API_URL` → `localhost:3006` → LAN).
Android APK: `flet build apk` (needs Flutter + Android SDK — see `flet-app/README.md`).

## Deployment

See `deploy/DEPLOY.md` — prod compose (private DB/Redis, Caddy TLS), secrets setup, WhatsApp cutover from ngrok to `https://api.afiyaref.ng/whatsapp/webhook`, mobile production URL.

## Notes

- NHIA (not NHIS) used in all user-facing labels — current Nigeria naming.
- Run `prisma/postgis-init.sql` after every fresh migrate (adds `location geography`, sync trigger, GIST/GIN indexes).
