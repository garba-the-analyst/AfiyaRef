import { searchFacilities, FacilityResult } from '../services/facility.service';

export const MAIN_MENU = `Welcome to *AfiyaRef* 🏥
Your health directory & referral assistant.

Reply with a number:
1️⃣ Find Hospital (share location next)
2️⃣ Talk to Nurse Titi (first aid help)
3️⃣ Emergency Inter-Hospital Check-in
4️⃣ Book Lab / Doctor

Type MENU anytime to return here.`;

/** Minimalist menu: Nurse Titi + nearby finder only. */
export const MAIN_MENU_MINI = `Welcome to *AfiyaRef* 🏥

Reply with a number:
1️⃣ Find nearby hospital (share location next)
2️⃣ Talk to Nurse Titi (first aid help)

Type MENU anytime to return here.`;

export function mainMenu(): string {
  return process.env.WHATSAPP_MODE === 'minimalist' ? MAIN_MENU_MINI : MAIN_MENU;
}

export function isMinimalist(): boolean {
  return process.env.WHATSAPP_MODE === 'minimalist';
}

export async function findNearby(lat: number, lng: number, service?: string): Promise<FacilityResult[]> {
  return searchFacilities({ lat, lng, radiusKm: 15, service, limit: 3 });
}

export function formatNearby(results: FacilityResult[]): string {
  if (!results.length) {
    return 'No facilities found within 15km for that filter. Try a larger area or different service. Type MENU to continue.';
  }
  const lines = results.map((f, i) => {
    const call = f.phone_number ? `\n📞 ${f.phone_number}` : '';
    return `${i + 1}. *${f.name}*\n📍 ${f.address ?? ''} (~${f.distance_km.toFixed(1)} km)${call}`;
  });
  return `Nearest facilities 🏥 (tap a map pin below to view in-chat, no other app needed):\n\n${lines.join('\n\n')}\n\nType MENU to continue.`;
}
