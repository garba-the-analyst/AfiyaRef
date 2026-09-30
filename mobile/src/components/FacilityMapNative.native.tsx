import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { FacilityMapProps } from './mapTypes';

/** Native implementation: embedded react-native-maps (no app switching). */
export default function FacilityMapNativeMap({ userLat, userLng, pins, selectedId, onSelect, route }: FacilityMapProps) {
  const initial =
    userLat !== undefined && userLng !== undefined
      ? { latitude: userLat, longitude: userLng }
      : pins.length
        ? { latitude: pins[0].latitude, longitude: pins[0].longitude }
        : { latitude: 6.5244, longitude: 3.3792 };
  const sel = pins.find((p) => p.id === selectedId);

  return (
    <MapView
      style={s.map}
      initialRegion={{ ...initial, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
      showsUserLocation={userLat === undefined}
    >
      {userLat !== undefined && userLng !== undefined && (
        <Marker coordinate={{ latitude: userLat, longitude: userLng }} title="You are here" pinColor="blue" />
      )}
      {pins.map((p) => (
        <Marker
          key={p.id}
          coordinate={{ latitude: p.latitude, longitude: p.longitude }}
          title={p.name}
          pinColor={p.id === selectedId ? 'red' : 'green'}
          onPress={() => onSelect?.(p.id)}
        />
      ))}
      {sel && userLat !== undefined && userLng !== undefined && (
        <Polyline
          coordinates={
            route && route.length > 1
              ? route.map(([latitude, longitude]) => ({ latitude, longitude }))
              : [
                  { latitude: userLat, longitude: userLng },
                  { latitude: sel.latitude, longitude: sel.longitude },
                ]
          }
          strokeColor="#0066cc"
          strokeWidth={route && route.length > 1 ? 4 : 3}
          lineDashPattern={route && route.length > 1 ? undefined : [6, 6]}
        />
      )}
    </MapView>
  );
}

const s = StyleSheet.create({
  map: { height: 280, borderRadius: 8 },
});
