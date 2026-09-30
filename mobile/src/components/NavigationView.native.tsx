import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useNavigator, formatDist, type NavViewProps } from './navLogic';

/** In-app turn-by-turn navigation — native build. */
export default function NavigationViewNative({ destName, destLat, destLng, initialRoute, fetchRoute, onExit }: NavViewProps) {
  const nav = useNavigator({ initialRoute, fetchRoute });
  const mapRef = React.useRef<MapView | null>(null);

  React.useEffect(() => {
    if (mapRef.current && nav.pos && nav.follow) {
      mapRef.current.animateToRegion(
        { latitude: nav.pos.lat, longitude: nav.pos.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500,
      );
    }
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
      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={{ latitude: destLat, longitude: destLng, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        showsUserLocation
      >
        <Polyline
          coordinates={nav.route.coordinates.map(([latitude, longitude]) => ({ latitude, longitude }))}
          strokeColor="#0066cc"
          strokeWidth={5}
        />
        <Marker coordinate={{ latitude: destLat, longitude: destLng }} title={destName} pinColor="red" />
        {nav.pos && <Marker coordinate={{ latitude: nav.pos.lat, longitude: nav.pos.lng }} title="You" pinColor="blue" />}
      </MapView>
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
  map: { flex: 1 },
  bar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, borderTopWidth: 1, borderColor: '#ddd' },
});
