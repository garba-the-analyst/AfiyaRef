"""Build every Flet control tree used by the app WITHOUT a page (proves validity)."""
import flet as ft
from flet_map import (Map, MapLatitudeLongitude, Marker, MarkerLayer,
                      PolylineLayer, PolylineMarker, TileLayer)
from flet_geolocator import Geolocator

side = ft.border.BorderSide(2, "white")
ring = ft.border.Border(top=side, right=side, bottom=side, left=side)

m = Map(
    initial_center=MapLatitudeLongitude(6.52, 3.37), initial_zoom=12,
    layers=[
        TileLayer(url_template="https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
        MarkerLayer(markers=[
            Marker(content=ft.Container(width=16, height=16, bgcolor="green",
                                        border_radius=8, border=ring),
                   coordinates=MapLatitudeLongitude(6.5244, 3.3792)),
        ]),
        PolylineLayer(polylines=[PolylineMarker(
            coordinates=[MapLatitudeLongitude(6.52, 3.37), MapLatitudeLongitude(6.5244, 3.3792)],
            color="blue", stroke_width=5)]),
    ],
)
geo = Geolocator(on_error=lambda e: None)
nav = ft.NavigationBar(destinations=[
    ft.NavigationBarDestination(icon="map", label="Finder"),
    ft.NavigationBarDestination(icon="medical_services", label="Nurse"),
])
login_col = ft.Column([ft.Text("AfiyaRef"), ft.TextField(label="Phone"),
                       ft.TextField(label="Password", password=True),
                       ft.FilledButton("Login"), ft.TextButton("Register"),
                       ft.OutlinedButton("Lab test")])
print("controls constructed OK:", type(m).__name__, type(geo).__name__, len(login_col.controls), "widgets")
