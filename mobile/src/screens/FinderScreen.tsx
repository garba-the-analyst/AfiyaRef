import React, { useState } from 'react';
import { View, Text, Button, FlatList, Linking, StyleSheet, Pressable } from 'react-native';
import * as Location from 'expo-location';
import { api } from '../api/client';
import FacilityMap from '../components/FacilityMap';
import NavigationView from '../components/NavigationView';
import type { NavRouteData } from '../components/navLogic';
import { freshPosition } from '../components/navLogic';

interface Facility {
  id: string;
  name: string;
  phone_number: string | null;
  address: string | null;
  distance_km: number;
  latitude: number;
  longitude: number;
}

export default function FinderScreen() {
  const [items, setItems] = useState<Facility[]>([]);
  const [msg, setMsg] = useState('Tap to find hospitals near you.');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [routeInfo, setRouteInfo] = useState<string>('');
  const [fullRoute, setFullRoute] = useState<NavRouteData | null>(null);
  const [navigating, setNavigating] = useState<Facility | null>(null);

  async function select(id: string) {
    setSelectedId(id);
    setRoute(null);
    setRouteInfo('');
    const fac = items.find((i) => i.id === id);
    if (!fac || !coords) return;
    try {
      setRouteInfo('Loading route…');
      const r = await api.route(coords.lat, coords.lng, fac.latitude, fac.longitude);
      setRoute(r.coordinates);
      setFullRoute(r as NavRouteData);
      setRouteInfo(`${(r.distance_m / 1000).toFixed(1)} km • ~${Math.max(1, Math.round(r.duration_s / 60))} min drive`);
    } catch {
      setRouteInfo('Route unavailable — showing straight line.');
    }
  }

  async function find() {
    try {
      setMsg('Getting GPS…');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMsg('Location permission denied.');
        return;
      }
      const pos = await freshPosition();
      const { lat: latitude, lng: longitude } = pos;
      setCoords({ lat: latitude, lng: longitude });
      setMsg('Searching…');
      const res = await api.search(
        `lat=${latitude}&lng=${longitude}&radius_km=15&limit=10`,
      );
      setItems(res.results);
      setMsg(res.count ? `${res.count} facilities found` : 'None found within 15km.');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function startNavigation(fac: Facility) {
    try {
      // Fresh position + fresh route, then enter turn-by-turn mode
      const pos = await freshPosition(true);
      const r = (await api.route(pos.lat, pos.lng, fac.latitude, fac.longitude)) as NavRouteData;
      setFullRoute(r);
      setRoute(r.coordinates);
      setNavigating(fac);
    } catch (e) {
      setRouteInfo('Could not start navigation.');
    }
  }

  if (navigating && fullRoute) {
    return (
      <NavigationView
        destName={navigating.name}
        destLat={navigating.latitude}
        destLng={navigating.longitude}
        initialRoute={fullRoute}
        fetchRoute={async (fromLat, fromLng) =>
          (await api.route(fromLat, fromLng, navigating.latitude, navigating.longitude)) as NavRouteData
        }
        onExit={() => setNavigating(null)}
      />
    );
  }

  return (
    <View style={s.wrap}>
      <Button title="Find nearby hospitals" onPress={find} />
      <Text style={s.msg}>{msg}</Text>
      {(coords || items.length > 0) && (
        <FacilityMap
          userLat={coords?.lat}
          userLng={coords?.lng}
          pins={items.map((i) => ({ id: i.id, name: i.name, latitude: i.latitude, longitude: i.longitude }))}
          selectedId={selectedId}
          onSelect={select}
          route={route}
        />
      )}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => select(item.id)}>
            <View style={[s.card, item.id === selectedId && s.selected]}>
              <Text style={s.name}>{item.name}</Text>
              <Text>{item.address} • {item.distance_km.toFixed(1)} km</Text>
              <Text style={s.hint}>
                {item.id === selectedId && routeInfo ? `🛣️ ${routeInfo}` : 'Tap to show route on the map ↑'}
              </Text>
              <View style={s.row}>
                {!!item.phone_number && (
                  <Button title="Call" onPress={() => Linking.openURL(`tel:${item.phone_number}`)} />
                )}
                {item.id === selectedId && route ? (
                  <Button title="Start 🧭" onPress={() => startNavigation(item)} />
                ) : null}
                <Button
                  title="Navigate"
                  onPress={() =>
                    Linking.openURL(
                      `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`,
                    )
                  }
                />
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  msg: { marginVertical: 10 },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 10 },
  selected: { borderColor: '#0066cc', borderWidth: 2 },
  hint: { color: '#0066cc', fontSize: 12, marginTop: 4 },
  name: { fontWeight: 'bold', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
});
