"""AfiyaRef Android app in Python (Flet) — mirrors the Expo app end to end."""
import threading
import time

import flet as ft
from flet_map import (
    Map,
    MapLatitudeLongitude,
    Marker,
    MarkerLayer,
    PolylineLayer,
    PolylineMarker,
    TileLayer,
)
from flet_geolocator import Geolocator

from api import ApiClient, ApiError
from nav_logic import (
    ARRIVE_M,
    OFF_ROUTE_M,
    cumulative,
    derive_guidance,
    ensure_steps,
    format_dist,
    project_onto_route,
    step_start_indices,
)

# OSM France basemap (standard OSM cartography, app-friendly, no key).
# tile.openstreetmap.org blocks app traffic and CARTO now requires an API key.
OSM_TILES = "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
OSM_FALLBACK = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
TILE_ATTRIBUTION = "© OpenStreetMap contributors"
TILE_USER_AGENT = "com.afiyaref.afiyaref"


class State:
    def __init__(self):
        self.api = ApiClient()
        self.tab = 0
        self.coords: tuple[float, float] | None = None
        self.facilities: list = []
        self.selected_id: str | None = None
        self.route: dict | None = None
        self.route_info = ""
        self.navigating: dict | None = None  # {facility, route}
        self.nav_thread: threading.Thread | None = None
        self.chat: list[tuple[str, str]] = []
        self.bookings: list = []
        self.geo: Geolocator | None = None
        self.has_geo = False
        self.manual_lat = "6.52"
        self.manual_lng = "3.37"
        self.ip_loc: tuple[float, float, str] | bool | None = None


def ring(width: int = 2, color: str = "white") -> ft.border.Border:
    side = ft.border.BorderSide(width, color)
    return ft.border.Border(top=side, right=side, bottom=side, left=side)


def card_border(color: str, width: int = 1) -> ft.border.Border:
    side = ft.border.BorderSide(width, color)
    return ft.border.Border(top=side, right=side, bottom=side, left=side)


def dot(color: str, size: int = 16) -> ft.Container:
    return ft.Container(
        width=size, height=size, bgcolor=color,
        border_radius=size // 2, border=ring(),
    )


def build_map(state: State, height: int = 300, follow: tuple[float, float] | None = None,
              route_coords: list | None = None, zoom: float = 12.0) -> Map:
    center = follow or state.coords or (6.5244, 3.3792)
    if isinstance(center, tuple):
        clat, clng = center
    else:
        clat, clng = center
    markers = []
    if state.coords:
        markers.append(Marker(content=dot("blue", 18), coordinates=MapLatitudeLongitude(state.coords[0], state.coords[1])))
    for f in state.facilities:
        color = "red" if f["id"] == state.selected_id else "green"
        markers.append(Marker(content=dot(color), coordinates=MapLatitudeLongitude(f["latitude"], f["longitude"])))
    layers: list = [TileLayer(url_template=OSM_TILES, subdomains=["a", "b", "c"],
                              fallback_url=OSM_FALLBACK, user_agent_package_name=TILE_USER_AGENT),
                    MarkerLayer(markers=markers)]
    if route_coords:
        layers.append(PolylineLayer(polylines=[PolylineMarker(
            coordinates=[MapLatitudeLongitude(a, b) for a, b in route_coords],
            color="blue", stroke_width=5)]))
    return Map(
        initial_center=MapLatitudeLongitude(clat, clng),
        initial_zoom=zoom,
        layers=layers,
    )


def main(page: ft.Page):
    page.title = "AfiyaRef"
    state = State()
    # Geolocator's native code ships on Android/iOS only (unknown control on
    # desktop/web builds) — use live GPS there, manual coords elsewhere.
    state.has_geo = page.platform in (ft.PagePlatform.ANDROID, ft.PagePlatform.IOS,
                                      ft.PagePlatform.ANDROID_TV)
    state.manual_lat = "6.52"
    state.manual_lng = "3.37"
    if state.has_geo:
        state.geo = Geolocator(on_error=lambda e: None)
        page.overlay.append(state.geo)
    haptic = ft.HapticFeedback() if state.has_geo else None
    if haptic is not None:
        page.overlay.append(haptic)

    def buzz(kind: str = "medium"):
        if haptic is None:
            return
        try:
            if kind == "heavy":
                haptic.heavy_impact()
            elif kind == "light":
                haptic.light_impact()
            else:
                haptic.medium_impact()
        except Exception:
            pass

    # ---------- responsive shell ----------
    width_watchers: list = []

    def center_wrap(inner, maxw: int):
        width_watchers.append((inner, maxw))
        return ft.Container(content=inner, alignment=ft.Alignment.CENTER)

    def apply_widths():
        try:
            w = page.window.width or 0
        except Exception:
            w = 0
        w = w or 1280
        for ctrl, maxw in width_watchers:
            try:
                ctrl.width = min(maxw, max(280, w - 24))
            except Exception:
                pass

    def on_win_resize(e):
        apply_widths()
        try:
            page.update()
        except Exception:
            pass

    page.on_resize = on_win_resize

    status = ft.Text("", color="grey")

    def err(msg: str):
        status.value = msg
        page.update()

    # ---------- auth ----------
    phone = ft.TextField(label="Phone e.g. 08012345678", keyboard_type=ft.KeyboardType.PHONE)
    password = ft.TextField(label="Password", password=True)
    name = ft.TextField(label="Full name (register only)")
    mode = {"register": False}

    def do_auth(e):
        try:
            if mode["register"]:
                r = state.api.register(phone.value.strip(), password.value, name.value.strip())
            else:
                r = state.api.login(phone.value.strip(), password.value)
            state.api.token = r["token"]
            page.clean()
            page.add(ft.Column([body_host, nav_bar], expand=True))
            show_tabs()
        except ApiError as ex:
            err(f"Auth failed: {ex}")

    def toggle_mode(e):
        mode["register"] = not mode["register"]
        name.visible = mode["register"]
        login_btn.text = "Register" if mode["register"] else "Login"
        toggle_btn.text = "Have an account? Login" if mode["register"] else "Need an account? Register"
        page.update()

    login_btn = ft.FilledButton("Login", on_click=do_auth)
    toggle_btn = ft.TextButton("Need an account? Register", on_click=toggle_mode)
    name.visible = False
    login_inner = ft.Column(
        [ft.Text("AfiyaRef 🏥", size=28, weight="bold"), phone, password, name, login_btn, toggle_btn, status],
        alignment=ft.MainAxisAlignment.CENTER, spacing=10,
    )
    login_view = center_wrap(login_inner, 430)

    # ---------- finder ----------
    finder_msg = ft.Text("Tap to find hospitals near you.")
    finder_col = ft.Column(scroll=ft.ScrollMode.AUTO, expand=True)
    filt_service = ft.TextField(label="Service e.g. Emergency, X-Ray, ICU", width=260)
    filt_emerg = ft.Checkbox(label="Emergency-ready only", value=False)
    filt_nhia = ft.Checkbox(label="Accepts NHIA", value=False)

    def refresh_finder():
        finder_col.controls.clear()
        finder_col.controls.append(ft.FilledButton("Find nearby hospitals", on_click=find_nearby))
        finder_col.controls.append(ft.Row([filt_service, filt_emerg, filt_nhia], wrap=True))
        if not state.has_geo:
            finder_col.controls.append(ft.Row([
                ft.TextField(label="Lat", value=state.manual_lat, width=140, on_change=lambda e: setattr(state, "manual_lat", e.control.value)),
                ft.TextField(label="Lng", value=state.manual_lng, width=140, on_change=lambda e: setattr(state, "manual_lng", e.control.value)),
            ]))
        finder_col.controls.append(finder_msg)
        if state.coords or state.facilities:
            finder_col.controls.append(ft.Container(
                content=build_map(state, route_coords=state.route), height=300))
            finder_col.controls.append(ft.Text(TILE_ATTRIBUTION, size=10, color="grey"))
        cards = []
        for f in state.facilities:
            sel = f["id"] == state.selected_id
            info = f"🛣️ {state.route_info}" if sel and state.route_info else "Tap to show route on the map"
            card = ft.Container(
                col={"xs": 12, "md": 6},
                content=ft.Column([
                    ft.Text(f["name"], weight="bold"),
                    ft.Text(f"{f.get('address') or ''} • {f['distance_km']:.1f} km"),
                    ft.Text(info, size=12, color="blue"),
                    ft.Row([
                        ft.FilledButton("Call", on_click=lambda e, p=f.get("phone_number"): page.launch_url(f"tel:{p}") if p else None) if f.get("phone_number") else ft.Container(),
                        ft.FilledButton("Route", on_click=lambda e, fid=f["id"]: select_facility(fid)),
                        ft.FilledButton("Start 🧭", on_click=lambda e, fac=f: start_navigation(fac)) if sel and state.route else ft.Container(),
                    ]),
                ]),
                border=card_border("blue" if sel else "grey", 2 if sel else 1),
                border_radius=8, padding=10,
            )
            cards.append(card)
        if cards:
            finder_col.controls.append(ft.ResponsiveRow(controls=cards))
        page.update()

    def get_pos() -> tuple[float, float]:
        if state.has_geo and state.geo is not None:
            try:
                state.geo.request_permission()
            except Exception:
                pass
            p = state.geo.get_current_position()
            return (p.latitude, p.longitude)
        # Desktop: real location via IP geolocation (cached), else manual fields
        if state.ip_loc is None:
            try:
                state.ip_loc = state.api.ip_location()
            except Exception:
                state.ip_loc = False  # don't retry every tap
            if state.ip_loc:
                state.manual_lat, state.manual_lng = str(state.ip_loc[0]), str(state.ip_loc[1])
        if state.ip_loc:
            return (state.ip_loc[0], state.ip_loc[1])
        return (float(state.manual_lat), float(state.manual_lng))

    def find_nearby(e):
        try:
            finder_msg.value = "Getting GPS…"
            page.update()
            lat, lng = get_pos()
            state.coords = (lat, lng)
            finder_msg.value = "Searching…"
            page.update()
            res = state.api.search(lat, lng,
                                     service=filt_service.value.strip() or None,
                                     emergency_only=bool(filt_emerg.value),
                                     accepts_nhia=True if filt_nhia.value else None)
            state.facilities = res.get("results", [])
            finder_msg.value = f"{res.get('count', 0)} facilities found" if state.facilities else "None found within 15km."
        except ApiError as ex:
            finder_msg.value = f"Error: {ex}"
        except Exception as ex:
            finder_msg.value = f"GPS error: {ex}"
        refresh_finder()

    def select_facility(fid: str):
        state.selected_id = fid
        state.route, state.route_info = None, ""
        fac = next((x for x in state.facilities if x["id"] == fid), None)
        if fac and state.coords:
            try:
                state.route_info = "Loading route…"
                refresh_finder()
                r = state.api.route(state.coords[0], state.coords[1], fac["latitude"], fac["longitude"])
                state.route = ensure_steps(r)
                state.route_info = f"{r['distance_m'] / 1000:.1f} km • ~{max(1, round(r['duration_s'] / 60))} min drive"
            except ApiError as ex:
                state.route_info = f"Route failed: {ex}"
        refresh_finder()

    def start_navigation(fac: dict):
        try:
            lat, lng = get_pos()
            r = ensure_steps(state.api.route(lat, lng, fac["latitude"], fac["longitude"]))
            state.coords = (lat, lng)
            state.route = r
            state.navigating = {"facility": fac, "route": r}
            show_nav()
            t = threading.Thread(target=nav_loop, daemon=True)
            state.nav_thread = t
            t.start()
        except (ApiError, Exception) as ex:
            finder_msg.value = f"Could not start navigation: {ex}"
            refresh_finder()

    # ---------- navigation ----------
    nav_banner = ft.Text("", weight="bold", size=16)
    nav_sub = ft.Text("")
    nav_view = ft.Column(expand=True)

    def show_nav():
        fac = state.navigating["facility"]
        nav_view.controls = [
            ft.Container(content=ft.Column([nav_banner, nav_sub]),
                         bgcolor="blue", padding=10),
            ft.Container(content=ft.Text("Acquiring GPS…"), expand=True),
            ft.Row([
                ft.FilledButton("Exit", on_click=lambda e: stop_navigation()),
            ], alignment=ft.MainAxisAlignment.CENTER),
        ]
        page.clean()
        body_host.content = nav_view
        page.add(ft.Column([body_host, nav_bar], expand=True))
        page.update()

    def stop_navigation():
        state.navigating = None
        show_tabs()

    def nav_loop():
        last_step = -1
        while state.navigating:
            try:
                lat, lng = get_pos()
                state.coords = (lat, lng)
                nav = state.navigating
                if nav is None:
                    return
                route = nav["route"]
                cum = cumulative(route["coordinates"])
                proj = project_onto_route(lat, lng, route["coordinates"], cum)
                if proj["dist_m"] > OFF_ROUTE_M:
                    nav_banner.value = "🔄 Rerouting…"
                    page.update()
                    try:
                        fac = nav["facility"]
                        fresh = ensure_steps(state.api.route(lat, lng, fac["latitude"], fac["longitude"]))
                        nav["route"] = fresh
                        state.route = fresh
                        last_step = -1
                    except ApiError:
                        pass
                    time.sleep(3)
                    continue
                starts = step_start_indices(route, cum)
                g = derive_guidance(route, starts, cum, proj["along_m"])
                step = route["steps"][g["idx"]]
                if g["remaining_m"] < ARRIVE_M:
                    if last_step != -2:
                        last_step = -2
                        buzz("heavy")
                    nav_banner.value = "✅ Arrived!"
                else:
                    nav_banner.value = f"{step['instruction']} — in {format_dist(g['to_maneuver_m'])}"
                    if g["idx"] != last_step:
                        buzz()
                    last_step = g["idx"]
                nav_sub.value = f"{format_dist(g['remaining_m'])} to go" if g["remaining_m"] >= ARRIVE_M else nav["facility"]["name"]
                # redraw map centered on user
                nav_view.controls[1] = ft.Container(
                    content=build_map(state, follow=(lat, lng),
                                      route_coords=route["coordinates"], zoom=15.0),
                    expand=True)
                page.update()
            except Exception:
                pass
            time.sleep(4)

    # ---------- nurse ----------
    nurse_badge = ft.Text("Nurse Titi …")
    chat_list = ft.ListView(expand=True, spacing=6)
    nurse_input = ft.TextField(label="Describe symptoms…", expand=True)

    def nurse_refresh_status():
        try:
            s = state.api.nurse_status()
            nurse_badge.value = f"Nurse Titi {'🟢 Online' if s.get('live') else '⚪ Offline mode'}"
        except ApiError:
            nurse_badge.value = "Nurse Titi (status unknown)"

    def send_nurse(e):
        msg = (nurse_input.value or "").strip()
        if not msg:
            return
        nurse_input.value = ""
        chat_list.controls.append(ft.Text(f"You: {msg}"))
        page.update()
        try:
            kw = {"message": msg}
            if state.coords:
                kw.update({"lat": state.coords[0], "lng": state.coords[1]})
            r = state.api.nurse_chat(**kw)
            reply = r.get("reply", "")
            if r.get("emergency") and r.get("facilities"):
                reply += "\n\nNearest emergency care: " + ", ".join(f["name"] for f in r["facilities"])
            chat_list.controls.append(ft.Container(content=ft.Text(f"Nurse Titi: {reply}"),
                                                   bgcolor="#eeeeee", border_radius=8, padding=8))
        except ApiError as ex:
            chat_list.controls.append(ft.Text(f"Error: {ex}", color="red"))
        page.update()

    def reset_nurse(e):
        try:
            state.api.reset_nurse_history()
            chat_list.controls.clear()
            chat_list.controls.append(ft.Text("Conversation reset."))
        except ApiError as ex:
            chat_list.controls.append(ft.Text(f"Error: {ex}", color="red"))
        page.update()

    nurse_view = ft.Column([ft.Row([nurse_badge, ft.TextButton("Reset chat", on_click=reset_nurse)]),
                            chat_list,
                            ft.Row([nurse_input, ft.FilledButton("Send", on_click=send_nurse)])],
                           expand=True)

    # ---------- bookings ----------
    book_msg = ft.Text("")
    book_list = ft.Column(scroll=ft.ScrollMode.AUTO, expand=True)
    fac_id = ft.TextField(label="Facility ID")
    book_date = ft.TextField(label="Date/time ISO e.g. 2026-10-01T09:00:00Z", value="2026-10-01T09:00:00Z")
    book_type = {"value": "DOCTOR_APPOINTMENT"}
    type_row = ft.Row([
        ft.FilledButton("Doctor", on_click=lambda e: set_book_type("DOCTOR_APPOINTMENT")),
        ft.OutlinedButton("Lab test", on_click=lambda e: set_book_type("LAB_TEST")),
    ])
    book_type_label = ft.Text("Type: DOCTOR_APPOINTMENT")

    def set_book_type(v: str):
        book_type["value"] = v
        book_type_label.value = f"Type: {v}"
        page.update()

    def load_bookings():
        try:
            state.bookings = state.api.my_bookings()
        except ApiError as ex:
            book_msg.value = f"Error: {ex}"

    def book(e):
        try:
            state.api.create_booking(fac_id.value.strip(), book_type["value"], book_date.value.strip())
            book_msg.value = "Booked ✅"
            fac_id.value = ""
            load_bookings()
        except ApiError as ex:
            book_msg.value = f"Error: {ex}"
        refresh_bookings()

    def cancel_booking(bid: str):
        try:
            state.api.cancel_booking(bid)
            book_msg.value = "Cancelled."
        except ApiError as ex:
            book_msg.value = f"Error: {ex}"
        refresh_bookings()

    def refresh_bookings():
        load_bookings()
        rows = []
        for b in state.bookings:
            label = (f"{b.get('facility', {}).get('name', b.get('facilityId'))} • "
                     f"{b.get('bookingType')} • {b.get('status')}")
            if b.get("status") in ("PENDING", "CONFIRMED"):
                rows.append(ft.Row([ft.Text(label, expand=True),
                                    ft.TextButton("Cancel", on_click=lambda e, bid=b["id"]: cancel_booking(bid))]))
            else:
                rows.append(ft.Text(label))
        book_list.controls = rows
        page.update()

    bookings_view = ft.Column([ft.Text("New booking", weight="bold"), fac_id, book_date,
                               book_type_label, type_row,
                               ft.FilledButton("Book", on_click=book), book_msg,
                               ft.Text("My bookings", weight="bold"), book_list],
                              scroll=ft.ScrollMode.AUTO, expand=True)

    # ---------- profile ----------
    prof_msg = ft.Text("")
    blood = ft.TextField(label="Blood group e.g. O+")
    genotype = ft.TextField(label="Genotype e.g. AA")
    allergies = ft.TextField(label="Allergies, comma-separated")
    emerg = ft.TextField(label="Emergency contact phone", keyboard_type=ft.KeyboardType.PHONE)
    nhia = ft.TextField(label="NHIA policy number")
    treating = ft.TextField(label="Treating facility ID (check-in)")

    def load_profile():
        try:
            p = state.api.health_profile() or {}
            blood.value = p.get("bloodGroup") or ""
            genotype.value = p.get("genotype") or ""
            allergies.value = ", ".join(p.get("allergies") or [])
            emerg.value = p.get("emergencyContactPhone") or ""
        except ApiError as ex:
            prof_msg.value = f"Error: {ex}"

    def save_profile(e):
        try:
            state.api.save_profile({
                "blood_group": blood.value, "genotype": genotype.value,
                "allergies": [a.strip() for a in allergies.value.split(",") if a.strip()],
                "emergency_contact_phone": emerg.value,
            })
            prof_msg.value = "Saved ✅"
        except ApiError as ex:
            prof_msg.value = f"Error: {ex}"
        page.update()

    def checkin(e):
        try:
            r = state.api.transfer_checkin(treating.value.strip(), nhia.value.strip() or None)
            prof_msg.value = f"Checked in ✅ Tracking: {r.get('id')}"
            load_transfers()
        except ApiError as ex:
            prof_msg.value = f"Error: {ex}"
        page.update()

    transfers_list = ft.Column()

    def load_transfers():
        try:
            items = state.api.my_transfers()
            rows = []
            for t in items:
                tid = str(t.get("id", ""))[:8]
                rows.append(ft.Text(
                    f"{tid} • {t.get('treatingFacility', {}).get('name', '?')} • "
                    f"{t.get('status')} • NHIA {t.get('nhiaNumberUsed') or '—'}"))
            transfers_list.controls = rows or [ft.Text("No check-ins yet.")]
        except ApiError as ex:
            transfers_list.controls = [ft.Text(f"Error: {ex}", color="red")]

    def logout(e):
        state.api.token = None
        state.navigating = None
        page.clean()
        page.add(login_view)
        page.update()

    profile_view = ft.Column([ft.Text("Medical passport (EHR-Lite)", weight="bold"),
                              blood, genotype, allergies, emerg,
                              ft.FilledButton("Save profile", on_click=save_profile),
                              ft.Text("Emergency inter-hospital check-in", weight="bold"),
                              nhia, treating,
                              ft.FilledButton("Check in with NHIA", on_click=checkin),
                              prof_msg,
                              ft.Text("My transfers", weight="bold"),
                              transfers_list,
                              ft.FilledButton("Logout", on_click=logout)],
                             scroll=ft.ScrollMode.AUTO, expand=True)

    # ---------- tabs ----------
    tabs = [center_wrap(finder_col, 900), center_wrap(nurse_view, 680),
            center_wrap(bookings_view, 680), center_wrap(profile_view, 680)]

    nav_bar = ft.NavigationBar(
        selected_index=0,
        on_change=lambda e: on_tab(e),
        destinations=[
            ft.NavigationBarDestination(icon=ft.Icons.MAP, label="Finder"),
            ft.NavigationBarDestination(icon=ft.Icons.MEDICAL_SERVICES, label="Nurse"),
            ft.NavigationBarDestination(icon=ft.Icons.CALENDAR_MONTH, label="Bookings"),
            ft.NavigationBarDestination(icon=ft.Icons.PERSON, label="Profile"),
        ],
    )
    body_host = ft.Container(expand=True)

    def on_tab(e):
        state.tab = e.control.selected_index
        if state.tab == 1:
            nurse_refresh_status()
        if state.tab == 2:
            refresh_bookings()
        if state.tab == 3:
            load_profile()
            load_transfers()
            page.update()
        show_tabs()

    def show_tabs():
        if state.navigating:
            show_nav()
            return
        refresh_finder() if state.tab == 0 else None
        if state.tab == 1:
            nurse_refresh_status()
        if state.tab == 2:
            refresh_bookings()
        if state.tab == 3:
            load_profile()
            load_transfers()
        nav_bar.selected_index = state.tab
        body_host.content = tabs[state.tab]
        apply_widths()
        page.update()

    page.add(login_view)


if __name__ == "__main__":
    ft.run(main)
