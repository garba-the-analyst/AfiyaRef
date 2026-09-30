export interface MapPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface FacilityMapProps {
  userLat?: number;
  userLng?: number;
  pins: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Real road route as [lat, lng] pairs (OSRM); falls back to straight line */
  route?: [number, number][] | null;
}
