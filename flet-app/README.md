# AfiyaRef Flet App (Python Android app)

Native-quality Android app written **entirely in Python** using [Flet](https://flet.dev).
Lives alongside `mobile/` (Expo) — same backend, same account, pick either client.

## Features (mirrors the Expo app)

- Auth (register/login, Nigerian phone normalization server-side)
- Finder: GPS → nearby hospitals on an **embedded OpenStreetMap** (flet-map, no redirects), tappable route info, Call buttons
  (live GPS on Android/iOS; desktop builds use manual lat/lng fields since the
  geolocator plugin ships no desktop implementation)
- Service / emergency-only / NHIA filters, in-map road-route preview on select
- In-app turn-by-turn navigation (banner/reroute/arrival; haptic buzz on maneuvers on phones)
- Nurse chat + reset, bookings with cancel, transfer history, EHR profile, NHIA check-in

## Run (desktop, for testing)

```bash
cd flet-app
pip install -r requirements.txt
python main.py            # desktop window; set AFIYA_API_URL to point at the backend
```

Default API: auto-detected (`AFIYA_API_URL` → `localhost:3005` → LAN fallback, first healthy wins).

## Verify without a GUI

```bash
python test_nav_logic.py  # navigation math unit tests
python smoke.py           # live end-to-end against the backend (register→search→route→chat→booking→checkin)
```

## Build the Android APK

```bash
flet build apk  # output: build/apk/afiyaref.apk (debug-signed, installable)
adb install -r build/apk/afiyaref.apk
```

The APK requests GPS + internet permissions and allows cleartext HTTP so it can
reach the dev backend over Wi-Fi. The app auto-detects the backend
(`AFIYA_API_URL` → `localhost` → LAN); for a physical phone, put it on the same
Wi-Fi and set `AFIYA_API_URL=http://<your-lan-ip>:3005` at build time if
auto-detect fails (check yours with `ip route get 1.1.1.0`).

Requirements: Flutter SDK + Android SDK (see https://flet.dev/docs/publish). Requires
`flet-map`/`flet-geolocator` permissions: location is requested at runtime; ensure
`ACCESS_FINE_LOCATION` is granted when prompted.
