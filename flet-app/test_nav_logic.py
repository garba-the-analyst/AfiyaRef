"""Unit tests for nav_logic (pure math, no network, no Flet). Run: python3 test_nav_logic.py"""
from nav_logic import (
    cumulative,
    derive_guidance,
    ensure_steps,
    format_dist,
    haversine_m,
    project_onto_route,
    step_start_indices,
)

# straight 3-point route along the equator-ish line (~111m per 0.001 deg lng at lat 6.5)
coords = [(6.5, 3.370), (6.5, 3.371), (6.5, 3.372)]
cum = cumulative(coords)
assert 200 < cum[-1] < 230, cum

# projection of midpoint
p = project_onto_route(6.5, 3.371, coords, cum)
assert p["dist_m"] < 1.0, p
assert abs(p["along_m"] - cum[-1] / 2) < 2.0, p

# off-route point
q = project_onto_route(6.51, 3.371, coords, cum)
assert q["dist_m"] > 1000, q

route = {
    "coordinates": coords,
    "distance_m": cum[-1],
    "duration_s": 120,
    "steps": [
        {"instruction": "Head out", "maneuver": "depart", "distance_m": 100, "duration_s": 60, "location": [6.5, 3.370]},
        {"instruction": "You have arrived", "maneuver": "arrive", "distance_m": 0, "duration_s": 0, "location": [6.5, 3.372]},
    ],
}
starts = step_start_indices(route, cum)
assert starts == [0, 2], starts
g0 = derive_guidance(route, starts, cum, 0.0)
assert g0["idx"] == 0 and g0["remaining_m"] > 200, g0
g1 = derive_guidance(route, starts, cum, cum[-1] - 1)
assert g1["idx"] == 1, g1

assert format_dist(1838) == "1.8 km"
assert format_dist(42) == "42 m"

bare = ensure_steps({"coordinates": coords, "distance_m": 10, "duration_s": 5, "steps": []})
assert len(bare["steps"]) == 2

print("nav_logic tests passed ✅")
