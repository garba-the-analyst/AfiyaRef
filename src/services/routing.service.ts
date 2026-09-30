export interface RouteStep {
  instruction: string;
  maneuver: string;
  distance_m: number;
  duration_s: number;
  /** [lat, lng] of the maneuver point */
  location: [number, number];
}

export interface RouteResult {
  /** [lat, lng] pairs along the road route */
  coordinates: [number, number][];
  distance_m: number;
  duration_s: number;
  steps: RouteStep[];
}

const OSRM_BASE = process.env.OSRM_BASE ?? 'https://router.project-osrm.org';

interface OsrmStep {
  maneuver: { type: string; modifier?: string; location: [number, number] };
  name: string;
  distance: number;
  duration: number;
}

/** Human-readable instruction from an OSRM step. */
export function describeStep(s: OsrmStep): string {
  const name = s.name ? ` on ${s.name}` : '';
  const mod = s.maneuver.modifier?.replace(/_/g, ' ') ?? '';
  switch (s.maneuver.type) {
    case 'depart':
      return `Head out${name}`;
    case 'arrive':
      return 'You have arrived at your destination';
    case 'turn':
      return `Turn ${mod}${name}`;
    case 'new name':
      return `Continue${name}`;
    case 'continue':
      return `Continue straight${name}`;
    case 'roundabout':
    case 'rotary':
      return 'At the roundabout, take the exit to stay on route';
    case 'roundabout turn':
      return `At the roundabout, turn ${mod}`;
    case 'merge':
      return `Merge ${mod}${name}`;
    case 'on ramp':
      return `Take the ramp${mod ? ` on the ${mod}` : ''}${name}`;
    case 'off ramp':
      return `Take the exit${mod ? ` on the ${mod}` : ''}${name}`;
    case 'fork':
      return `Keep ${mod}${name}`;
    case 'end of road':
      return `At the end of the road, turn ${mod}${name}`;
    default:
      return `${s.maneuver.type}${mod ? ` ${mod}` : ''}${name}`.trim();
  }
}

/** Driving route with turn-by-turn steps via OSRM (public demo server by default; self-host for production). */
export async function getRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<RouteResult> {
  const url =
    `${OSRM_BASE}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson&steps=true`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = (await res.json()) as {
      routes?: {
        geometry: { coordinates: [number, number][] };
        distance: number;
        duration: number;
        legs?: { steps?: OsrmStep[] }[];
      }[];
    };
    const route = data?.routes?.[0];
    if (!route) throw new Error('No route found');
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng],
    );
    const rawSteps: OsrmStep[] = route.legs?.flatMap((l) => l.steps ?? []) ?? [];
    const steps: RouteStep[] = rawSteps.map((s) => ({
      instruction: describeStep(s),
      maneuver: s.maneuver.modifier ?? s.maneuver.type,
      distance_m: s.distance,
      duration_s: s.duration,
      location: [s.maneuver.location[1], s.maneuver.location[0]],
    }));
    return { coordinates, distance_m: route.distance, duration_s: route.duration, steps };
  } finally {
    clearTimeout(timer);
  }
}
