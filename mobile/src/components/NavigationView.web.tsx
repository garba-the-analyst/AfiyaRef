import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigator, formatDist, type NavViewProps } from './navLogic';

/** In-app turn-by-turn navigation — Leaflet build for web. */
export default function NavigationViewWeb({ destName, destLat, destLng, initialRoute, fetchRoute, onExit }: NavViewProps) {
  const nav = useNavigator({ initialRoute, fetchRoute });
  const divRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const userRef = React.useRef<L.Marker | null>(null);
  const routeRef = React.useRef<L.Polyline | null>(null);

  React.useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { zoomControl: true }).setView([destLat, destLng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: 'abc',
      errorTileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    L.marker([destLat, destLng]).addTo(map).bindPopup(destName);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw route (e.g. after rerouting)
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeRef.current?.remove();
    routeRef.current = L.polyline(nav.route.coordinates, { color: '#0066cc', weight: 5 }).addTo(map);
    map.fitBounds(routeRef.current.getBounds(), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.route]);

  // Follow camera + user marker
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !nav.pos) return;
    if (!userRef.current) {
      userRef.current = L.marker([nav.pos.lat, nav.pos.lng], {
        icon: L.divIcon({
          className: '',
          html: '<div style="background:#0066cc;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5)"></div>',
          iconSize: [18, 18],
        }),
      }).addTo(map);
    } else {
      userRef.current.setLatLng([nav.pos.lat, nav.pos.lng]);
    }
    if (nav.follow) map.setView([nav.pos.lat, nav.pos.lng], 16, { animate: true });
  }, [nav.pos, nav.follow]);

  const headline = nav.arrived
    ? `✅ Arrived at ${destName}`
    : nav.rerouting
      ? '🔄 Rerouting…'
      : nav.currentStep
        ? `${nav.currentStep.instruction} — in ${formatDist(nav.toManeuverM)}`
        : 'Starting navigation…';

  return (
    <View style={s.wrap}>
      <View style={s.banner}>
        <Text style={s.headline}>{headline}</Text>
        {!nav.arrived && (
          <Text style={s.sub}>
            {formatDist(nav.remainingM)} to go • ~{nav.etaMin} min{nav.offRoute ? ' • off route' : ''}
          </Text>
        )}
      </View>
      <div ref={divRef} style={{ flex: 1, zIndex: 0 }} />
      <View style={s.bar}>
        <Button title={nav.follow ? 'Free map' : 'Follow'} onPress={() => nav.setFollow(!nav.follow)} />
        <Button title={nav.muted ? 'Unmute' : 'Mute'} onPress={() => nav.setMuted(!nav.muted)} />
        <Button title="Exit" onPress={onExit} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  banner: { backgroundColor: '#0066cc', padding: 12 },
  headline: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  sub: { color: '#dceaff', marginTop: 2 },
  bar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, borderTopWidth: 1, borderColor: '#ddd' },
});
