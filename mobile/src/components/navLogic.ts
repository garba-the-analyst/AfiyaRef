import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { speakSafe, stopSafe } from './speech';

export interface NavStep {
  instruction: string;
  maneuver: string;
  distance_m: number;
  duration_s: number;
  location: [number, number]; // [lat, lng]
}

export interface NavRouteData {
  coordinates: [number, number][]; // [lat, lng]
  distance_m: number;
  duration_s: number;
  steps: NavStep[];
}

export const OFF_ROUTE_M = 60;
export const ARRIVE_M = 40;

/** Fresh GPS fix. (expo-location web pins maximumAge: Infinity internally,
 * so we override it — the web impl spreads extra options through.) */
export async function freshPosition(highAccuracy = false): Promise<{ lat: number; lng: number }> {
  const p = await Location.getCurrentPositionAsync({
    accuracy: highAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
    // @ts-expect-error maximumAge is honored on web despite missing from types
    maximumAge: 0,
  });
  return { lat: p.coords.latitude, lng: p.coords.longitude };
}

export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a =
    s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function cumulative(coords: [number, number][]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversineM(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]));
  }
  return cum;
}

/** Project user position onto the route polyline. */
export function projectOntoRoute(
  lat: number,
  lng: number,
  coords: [number, number][],
  cum: number[],
): { alongM: number; distM: number } {
  let best = { alongM: 0, distM: Infinity };
  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = [coords[i][0], coords[i][1]];
    const [bx, by] = [coords[i + 1][0], coords[i + 1][1]];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((lat - ax) * dx + (lng - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const d = haversineM(lat, lng, px, py);
    if (d < best.distM) {
      const segLen = cum[i + 1] - cum[i];
      best = { alongM: cum[i] + t * segLen, distM: d };
    }
  }
  return best;
}

/** Route-coordinate index where each maneuver starts. */
export function stepStartIndices(route: NavRouteData, cum: number[]): number[] {
  return route.steps.map((s) => {
    let best = 0;
    let bestD = Infinity;
    route.coordinates.forEach(([clat, clng], i) => {
      const d = haversineM(s.location[0], s.location[1], clat, clng);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  });
}

export interface Guidance {
  idx: number;
  toManeuverM: number;
  remainingM: number;
}

export function deriveGuidance(
  route: NavRouteData,
  starts: number[],
  cum: number[],
  alongM: number,
): Guidance {
  const total = cum[cum.length - 1] ?? route.distance_m;
  const ends = starts.map((_, i) => (i + 1 < starts.length ? cum[starts[i + 1]] : total));
  let idx = ends.findIndex((e) => e > alongM + 2);
  if (idx < 0) idx = ends.length - 1;
  return {
    idx: Math.max(0, idx),
    toManeuverM: Math.max(0, ends[Math.max(0, idx)] - alongM),
    remainingM: Math.max(0, total - alongM),
  };
}

function withFallbackSteps(route: NavRouteData): NavRouteData {
  if (route.steps.length > 0) return route;
  const last = route.coordinates[route.coordinates.length - 1];
  return {
    ...route,
    steps: [
      { instruction: 'Head out toward your destination', maneuver: 'depart', distance_m: 0, duration_s: 0, location: route.coordinates[0] },
      { instruction: 'You have arrived at your destination', maneuver: 'arrive', distance_m: 0, duration_s: 0, location: last },
    ],
  };
}

export interface Navigator {
  pos: { lat: number; lng: number } | null;
  route: NavRouteData;
  stepIdx: number;
  currentStep: NavStep | undefined;
  toManeuverM: number;
  remainingM: number;
  etaMin: number;
  offRoute: boolean;
  rerouting: boolean;
  arrived: boolean;
  follow: boolean;
  setFollow: (v: boolean) => void;
  muted: boolean;
  setMuted: (v: boolean) => void;
}

/** GPS polling + step tracking + rerouting + voice prompts. */
export function useNavigator(opts: {
  initialRoute: NavRouteData;
  fetchRoute: (fromLat: number, fromLng: number) => Promise<NavRouteData>;
}): Navigator {
  const [route, setRoute] = useState<NavRouteData>(() => withFallbackSteps(opts.initialRoute));
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [remainingM, setRemainingM] = useState(opts.initialRoute.distance_m);
  const [toManeuverM, setToManeuverM] = useState(0);
  const [offRoute, setOffRoute] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [follow, setFollow] = useState(true);
  const [muted, setMuted] = useState(false);

  const routeRef = useRef(route);
  routeRef.current = route;
  const fetchRef = useRef(opts.fetchRoute);
  fetchRef.current = opts.fetchRoute;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const speak = (text: string) => {
    if (!text || mutedRef.current) return;
    speakSafe(text);
  };

  useEffect(() => {
    let alive = true;
    let lastStep = -1;
    const tick = async () => {
      try {
        const { lat: latitude, lng: longitude } = await freshPosition(true);
        if (!alive) return;
        setPos({ lat: latitude, lng: longitude });
        const r = routeRef.current;
        const cum = cumulative(r.coordinates);
        const proj = projectOntoRoute(latitude, longitude, r.coordinates, cum);

        if (proj.distM > OFF_ROUTE_M) {
          setOffRoute(true);
          setRerouting(true);
          try {
            const fresh = withFallbackSteps(await fetchRef.current(latitude, longitude));
            if (!alive) return;
            setRoute(fresh);
            routeRef.current = fresh;
            lastStep = -1;
            setOffRoute(false);
            speak('Rerouting. New route calculated.');
          } catch {
            /* keep old route */
          }
          if (alive) setRerouting(false);
          return;
        }
        setOffRoute(false);
        const starts = stepStartIndices(r, cum);
        const g = deriveGuidance(r, starts, cum, proj.alongM);
        setStepIdx(g.idx);
        setRemainingM(g.remainingM);
        setToManeuverM(g.toManeuverM);
        if (g.remainingM < ARRIVE_M) {
          if (alive) {
            setArrived(true);
            if (lastStep !== -2) {
              lastStep = -2;
              speak('You have arrived at your destination.');
            }
          }
          return;
        }
        if (g.idx !== lastStep) {
          lastStep = g.idx;
          speak(r.steps[g.idx]?.instruction ?? '');
        }
      } catch {
        /* GPS unavailable this tick */
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
      stopSafe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const etaMin = Math.max(1, Math.round((route.duration_s * (remainingM / Math.max(1, route.distance_m))) / 60));

  return {
    pos,
    route,
    stepIdx,
    currentStep: route.steps[stepIdx],
    toManeuverM,
    remainingM,
    etaMin,
    offRoute,
    rerouting,
    arrived,
    follow,
    setFollow,
    muted,
    setMuted,
  };
}

export function formatDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export interface NavViewProps {
  destName: string;
  destLat: number;
  destLng: number;
  initialRoute: NavRouteData;
  fetchRoute: (fromLat: number, fromLng: number) => Promise<NavRouteData>;
  onExit: () => void;
}
