import React from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FacilityMapProps } from './mapTypes';

/** Web implementation: Leaflet + OpenStreetMap, fully embedded (no redirects). */
export default function FacilityMapWebLeaflet({ userLat, userLng, pins, selectedId, onSelect, route }: FacilityMapProps) {
  const divRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const layerRef = React.useRef<L.LayerGroup | null>(null);
  const onSelectRef = React.useRef(onSelect);
  onSelectRef.current = onSelect;

  React.useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    try {
      const center: [number, number] =
        userLat !== undefined && userLng !== undefined
          ? [userLat, userLng]
          : pins.length
            ? [pins[0].latitude, pins[0].longitude]
            : [6.5244, 3.3792];
      const map = L.map(divRef.current).setView(center, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abc',
        errorTileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      mapRef.current = map;
    } catch (e) {
      console.error('[facility-map]', e);
    }
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    layerRef.current?.remove();
    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    const dot = (color: string) =>
      L.divIcon({
        className: '',
        html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [16, 16],
      });

    if (userLat !== undefined && userLng !== undefined) {
      L.marker([userLat, userLng], { icon: dot('#0066cc') }).addTo(group).bindPopup('You are here');
    }
    const bounds: [number, number][] = [];
    for (const p of pins) {
      const m = L.marker([p.latitude, p.longitude], { icon: dot(p.id === selectedId ? '#e11d48' : '#16a34a') }).addTo(group);
      m.bindPopup(p.name);
      m.on('click', () => onSelectRef.current?.(p.id));
      bounds.push([p.latitude, p.longitude]);
    }
    // Real road route if available, else straight dashed fallback
    const sel = pins.find((p) => p.id === selectedId);
    if (route && route.length > 1) {
      L.polyline(route, { color: '#0066cc', weight: 4 }).addTo(group);
      for (const [rlat, rlng] of route) bounds.push([rlat, rlng]);
    } else if (sel && userLat !== undefined && userLng !== undefined) {
      L.polyline(
        [
          [userLat, userLng],
          [sel.latitude, sel.longitude],
        ],
        { color: '#0066cc', dashArray: '6 6' },
      ).addTo(group);
      bounds.push([userLat, userLng], [sel.latitude, sel.longitude]);
    }
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
    else if (bounds.length === 1) map.setView(bounds[0], 13);
  }, [pins, selectedId, userLat, userLng, route]);

  return (
    <View style={{ height: 280, borderRadius: 8, overflow: 'hidden' }}>
      <div ref={divRef} style={{ height: '100%', width: '100%', zIndex: 0 }} />
    </View>
  );
}
