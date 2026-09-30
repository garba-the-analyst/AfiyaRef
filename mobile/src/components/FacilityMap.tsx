import React from 'react';
import { Platform } from 'react-native';
import FacilityMapWeb from './FacilityMapWeb';
import FacilityMapNative from './FacilityMapNative';
import type { FacilityMapProps } from './mapTypes';

/** Embedded facility map — Leaflet/OSM on web, react-native-maps on device. */
export default function FacilityMap(props: FacilityMapProps) {
  if (Platform.OS === 'web') return <FacilityMapWeb {...props} />;
  return <FacilityMapNative {...props} />;
}
