"""Thin httpx client for the AfiyaRef backend."""
import os

import httpx

BASE_URL = os.environ.get("AFIYA_API_URL", "http://192.168.18.25:3006")


def resolve_base() -> str:
    """Pick the first healthy backend (env override → localhost → legacy LAN)."""
    candidates = [BASE_URL, "http://localhost:3006"]
    seen = set()
    for base in candidates:
        if not base or base in seen:
            continue
        seen.add(base)
        try:
            r = httpx.get(base.rstrip("/") + "/health", timeout=2.0)
            if r.status_code == 200:
                return base
        except Exception:
            pass
    return BASE_URL


class ApiError(Exception):
    pass


class ApiClient:
    def __init__(self, base_url: str | None = None, timeout: float = 20.0):
        self.base_url = (base_url or resolve_base()).rstrip("/")
        self._timeout = timeout
        self.client = httpx.Client(base_url=self.base_url, timeout=timeout)
        self.token: str | None = None

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def _req(self, method: str, path: str, body: dict | None = None, auth: bool = True):
        if auth and not self.token:
            raise ApiError("Not logged in")
        try:
            return self._do(method, path, body)
        except Exception:
            pass
        # First attempt failed: backend may have started, moved, or switched
        # networks since launch — re-resolve and retry once before giving up.
        fresh = resolve_base()
        if fresh.rstrip("/") != self.base_url:
            self.base_url = fresh.rstrip("/")
            self.client = httpx.Client(base_url=self.base_url, timeout=self._timeout)
            try:
                return self._do(method, path, body)
            except Exception:
                pass
        raise ApiError(
            f"Cannot reach server at {self.base_url}. "
            "Start the backend: cd ~/Desktop/Projects/AfiyaRef && node dist/index.js"
        )

    def _do(self, method: str, path: str, body: dict | None = None):
        r = self.client.request(method, path, json=body, headers=self._headers())
        try:
            data = r.json()
        except ValueError:
            data = {}
        if r.status_code >= 400:
            err = data.get("error", f"HTTP {r.status_code}") if isinstance(data, dict) else f"HTTP {r.status_code}"
            raise ApiError(str(err))
        return data

    # auth (public)
    def register(self, phone: str, password: str, full_name: str) -> dict:
        return self._req("POST", "/api/auth/register",
                         {"phone_number": phone, "password": password, "full_name": full_name}, auth=False)

    def login(self, phone: str, password: str) -> dict:
        return self._req("POST", "/api/auth/login",
                         {"phone_number": phone, "password": password}, auth=False)

    # facilities (public)
    def search(self, lat: float, lng: float, radius_km: float = 15, limit: int = 10,
               service: str | None = None, emergency_only: bool = False,
               accepts_nhia: bool | None = None) -> dict:
        q = f"/api/facilities/search?lat={lat}&lng={lng}&radius_km={radius_km}&limit={limit}"
        if service:
            q += f"&service={service}"
        if emergency_only:
            q += "&emergency_only=true"
        if accepts_nhia is not None:
            q += f"&accepts_nhia={'true' if accepts_nhia else 'false'}"
        return self._req("GET", q, auth=False)

    def route(self, from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> dict:
        return self._req(
            "GET",
            f"/api/facilities/route?from_lat={from_lat}&from_lng={from_lng}&to_lat={to_lat}&to_lng={to_lng}",
            auth=False,
        )

    # bookings
    def my_bookings(self) -> list:
        return self._req("GET", "/api/bookings/mine")

    def create_booking(self, facility_id: str, booking_type: str, scheduled_time: str) -> dict:
        return self._req("POST", "/api/bookings",
                         {"facility_id": facility_id, "booking_type": booking_type, "scheduled_time": scheduled_time})

    def cancel_booking(self, booking_id: str) -> dict:
        return self._req("PATCH", f"/api/bookings/{booking_id}", {"status": "CANCELLED"})

    # nurse
    def nurse_status(self) -> dict:
        return self._req("GET", "/api/nurse/status", auth=False)

    def nurse_chat(self, message: str, lat: float | None = None, lng: float | None = None) -> dict:
        body: dict = {"message": message}
        if lat is not None and lng is not None:
            body.update({"lat": lat, "lng": lng})
        return self._req("POST", "/api/nurse/chat", body)

    # ehr
    def health_profile(self) -> dict:
        return self._req("GET", "/api/health-profile/me")

    def save_profile(self, body: dict) -> dict:
        return self._req("PUT", "/api/health-profile/me", body)

    # transfers
    def transfer_checkin(self, treating_facility_id: str, nhia_number_used: str | None = None) -> dict:
        body: dict = {"treating_facility_id": treating_facility_id}
        if nhia_number_used:
            body["nhia_number_used"] = nhia_number_used
        return self._req("POST", "/api/transfers/checkin", body)

    def my_transfers(self) -> list:
        return self._req("GET", "/api/transfers/mine")

    def reset_nurse_history(self) -> dict:
        return self._req("DELETE", "/api/nurse/history")

    # desktop location fallback (city-level IP geolocation; GPS is used on phones)
    def ip_location(self) -> tuple[float, float, str] | None:
        try:
            r = httpx.get("http://ip-api.com/json/?fields=status,lat,lon,city", timeout=6.0)
            d = r.json()
            if d.get("status") == "success" and d.get("lat") and d.get("lon"):
                return (float(d["lat"]), float(d["lon"]), str(d.get("city") or ""))
        except Exception:
            pass
        return None
