"""Turn-by-turn navigation math (Python port of mobile/src/components/navLogic.ts)."""
import math

OFF_ROUTE_M = 60.0
ARRIVE_M = 40.0


def haversine_m(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    r = 6371000.0
    d_lat = math.radians(b_lat - a_lat)
    d_lng = math.radians(b_lng - a_lng)
    s1 = math.sin(d_lat / 2) ** 2
    s2 = math.sin(d_lng / 2) ** 2
    a = s1 + math.cos(math.radians(a_lat)) * math.cos(math.radians(b_lat)) * s2
    return 2 * r * math.asin(math.sqrt(a))


def cumulative(coords: list[tuple[float, float]]) -> list[float]:
    cum = [0.0]
    for i in range(1, len(coords)):
        cum.append(cum[-1] + haversine_m(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]))
    return cum


def project_onto_route(lat: float, lng: float, coords: list[tuple[float, float]], cum: list[float]) -> dict:
    best = {"along_m": 0.0, "dist_m": float("inf")}
    for i in range(len(coords) - 1):
        ax, ay = coords[i]
        bx, by = coords[i + 1]
        dx, dy = bx - ax, by - ay
        len2 = dx * dx + dy * dy
        t = ((lat - ax) * dx + (lng - ay) * dy) / len2 if len2 else 0.0
        t = max(0.0, min(1.0, t))
        d = haversine_m(lat, lng, ax + t * dx, ay + t * dy)
        if d < best["dist_m"]:
            best = {"along_m": cum[i] + t * (cum[i + 1] - cum[i]), "dist_m": d}
    return best


def step_start_indices(route: dict, cum: list[float]) -> list[int]:
    idxs = []
    for s in route["steps"]:
        best, best_d = 0, float("inf")
        for i, (clat, clng) in enumerate(route["coordinates"]):
            d = haversine_m(s["location"][0], s["location"][1], clat, clng)
            if d < best_d:
                best, best_d = i, d
        idxs.append(best)
    return idxs


def derive_guidance(route: dict, starts: list[int], cum: list[float], along_m: float) -> dict:
    total = cum[-1] if cum else route["distance_m"]
    ends = [(cum[starts[i + 1]] if i + 1 < len(starts) else total) for i in range(len(starts))]
    idx = next((i for i, e in enumerate(ends) if e > along_m + 2), len(ends) - 1)
    idx = max(0, idx)
    return {
        "idx": idx,
        "to_maneuver_m": max(0.0, ends[idx] - along_m) if ends else 0.0,
        "remaining_m": max(0.0, total - along_m),
    }


def format_dist(m: float) -> str:
    return f"{m / 1000:.1f} km" if m >= 1000 else f"{round(m)} m"


def ensure_steps(route: dict) -> dict:
    if route.get("steps"):
        return route
    coords = route["coordinates"]
    route = dict(route)
    route["steps"] = [
        {"instruction": "Head out toward your destination", "maneuver": "depart",
         "distance_m": 0, "duration_s": 0, "location": list(coords[0])},
        {"instruction": "You have arrived at your destination", "maneuver": "arrive",
         "distance_m": 0, "duration_s": 0, "location": list(coords[-1])},
    ]
    return route
