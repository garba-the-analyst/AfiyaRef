import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE: string =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'http://192.168.1.198:3005';

const TOKEN_KEY = 'afiyaref_token';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setToken(t: string) {
  await AsyncStorage.setItem(TOKEN_KEY, t);
}
export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function req(path: string, opts: RequestInit = {}, auth = true) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const t = await getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}

export const api = {
  register: (b: object) => req('/api/auth/register', { method: 'POST', body: JSON.stringify(b) }, false),
  login: (b: object) => req('/api/auth/login', { method: 'POST', body: JSON.stringify(b) }, false),
  search: (q: string) => req(`/api/facilities/search?${q}`, {}, false),
  route: (fromLat: number, fromLng: number, toLat: number, toLng: number) =>
    req(
      `/api/facilities/route?from_lat=${fromLat}&from_lng=${fromLng}&to_lat=${toLat}&to_lng=${toLng}`,
      {},
      false,
    ),
  myBookings: () => req('/api/bookings/mine'),
  createBooking: (b: object) => req('/api/bookings', { method: 'POST', body: JSON.stringify(b) }),
  nurseStatus: () => req('/api/nurse/status', {}, false),
  nurseChat: (b: object) => req('/api/nurse/chat', { method: 'POST', body: JSON.stringify(b) }),
  healthProfile: () => req('/api/health-profile/me'),
  saveProfile: (b: object) => req('/api/health-profile/me', { method: 'PUT', body: JSON.stringify(b) }),
  transferCheckin: (b: object) => req('/api/transfers/checkin', { method: 'POST', body: JSON.stringify(b) }),
};

export { BASE };
