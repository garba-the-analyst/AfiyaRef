import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { normalizePhone } from '../utils/phone';
import { askNurseTiti } from '../services/nurseTiti.service';
import { createTransfer } from '../services/transfer.service';
import { MAIN_MENU, mainMenu, isMinimalist, findNearby, formatNearby } from './messageTemplates';
import { sendWhatsAppText, sendWhatsAppLocation } from './metaClient';

export type WaState =
  | 'IDLE'
  | 'NURSE_TITI'
  | 'LOCATION_AWAIT'
  | 'INTER_HOSPITAL_CHECKIN';

const key = (phone: string) => `whatsapp_state:${phone}`;
const histKey = (phone: string) => `whatsapp_nurse_hist:${phone}`;

export async function getState(phone: string): Promise<WaState> {
  const s = await redis.get(key(phone));
  return (s as WaState) ?? 'IDLE';
}
export async function setState(phone: string, s: WaState, ttlSec = 3600) {
  await redis.set(key(phone), s, 'EX', ttlSec);
}

/** Auto-authenticate: phone number is the binding factor (no password on WhatsApp). */
export async function ensureWaUser(phone: string) {
  const normalized = normalizePhone(phone);
  let user = await prisma.user.findUnique({ where: { phoneNumber: normalized } });
  if (!user) {
    user = await prisma.user.create({
      data: { phoneNumber: normalized, passwordHash: 'WHATSAPP_ONLY', fullName: normalized },
    });
    await prisma.healthProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
  }
  return user;
}

export async function handleIncoming(from: string, text: string, location?: { lat: number; lng: number }) {
  const phone = normalizePhone(from);
  const user = await ensureWaUser(phone);
  let state = await getState(phone);
  const msg = (text ?? '').trim();

  if (/^menu$/i.test(msg)) {
    await setState(phone, 'IDLE');
    await sendWhatsAppText(phone, mainMenu());
    return;
  }

  // Location attachment handling — text list + native in-chat map bubbles
  if (location && (state === 'LOCATION_AWAIT' || state === 'IDLE')) {
    const results = await findNearby(location.lat, location.lng);
    await setState(phone, 'IDLE');
    await sendWhatsAppText(phone, formatNearby(results));
    for (const f of results) {
      await sendWhatsAppLocation(phone, {
        latitude: f.latitude,
        longitude: f.longitude,
        name: f.name,
        address: f.address ?? undefined,
      });
    }
    return;
  }

  if (state === 'NURSE_TITI') {
    if (/^exit$/i.test(msg)) {
      await setState(phone, 'IDLE');
      await sendWhatsAppText(phone, `Exited Nurse Titi. ${mainMenu()}`);
      return;
    }
    const rawHist = await redis.get(histKey(phone));
    const hist = rawHist ? JSON.parse(rawHist) : [];
    const { reply } = await askNurseTiti(msg, hist);
    hist.push({ role: 'user', content: msg }, { role: 'assistant', content: reply });
    await redis.set(histKey(phone), JSON.stringify(hist.slice(-16)), 'EX', 3600);
    await sendWhatsAppText(phone, `${reply}\n\n(Type EXIT to leave Nurse Titi)`);
    return;
  }

  if (state === 'INTER_HOSPITAL_CHECKIN') {
    // Expect: "<NHIA_NUMBER> | <TREATING_FACILITY_ID or NAME>"
    const [nhia, treating] = msg.split('|').map((s) => s?.trim());
    if (!nhia || !treating) {
      await sendWhatsAppText(
        phone,
        'Please reply in this format:\n`NHIA_NUMBER | TREATING_HOSPITAL_NAME`\nExample:\n`NHIA-12345 | Reddington Hospital Lekki`',
      );
      return;
    }
    let facility = await prisma.facility.findFirst({
      where: { name: { contains: treating, mode: 'insensitive' } },
    });
    if (!facility) facility = await prisma.facility.findUnique({ where: { id: treating } }).catch(() => null);
    if (!facility) {
      await sendWhatsAppText(phone, 'Treating facility not found. Check the name and try again, or type MENU.');
      return;
    }
    const record = await createTransfer({ userId: user.id, treatingFacilityId: facility.id, nhiaNumberUsed: nhia });
    await setState(phone, 'IDLE');
    await sendWhatsAppText(
      phone,
      `✅ Emergency check-in recorded.\nTracking ID: ${record.id}\nTreating: ${facility.name}\nYour home hospital & HMO have been notified with your EHR snapshot + insurance validation request.\n\nType MENU to continue.`,
    );
    return;
  }

  // IDLE menu routing
  switch (msg) {
    case '1':
      await setState(phone, 'LOCATION_AWAIT');
      await sendWhatsAppText(phone, '📍 Please share your location (attachment → Location) and I will find the 3 nearest hospitals.');
      break;
    case '2':
      await setState(phone, 'NURSE_TITI');
      await redis.del(histKey(phone));
      await sendWhatsAppText(phone, '👩🏾‍⚕️ You are now talking to *Nurse Titi*. Describe the symptoms or first-aid need. Type EXIT when done.');
      break;
    case '3':
      if (isMinimalist()) {
        await sendWhatsAppText(phone, `For emergencies, reply 1 and share your location to find the nearest hospital right now.\n\n${mainMenu()}`);
        break;
      }
      await setState(phone, 'INTER_HOSPITAL_CHECKIN');
      await sendWhatsAppText(phone, '🚨 *Emergency Inter-Hospital Check-in*\nReply with:\n`NHIA_NUMBER | TREATING_HOSPITAL_NAME`\nWe will notify your home hospital & HMO and share your EHR snapshot.');
      break;
    case '4':
      if (isMinimalist()) {
        await sendWhatsAppText(phone, `Booking lives in the AfiyaRef app — but I can help right here:\n${mainMenu()}`);
        break;
      }
      await sendWhatsAppText(phone, '📅 To book, use the AfiyaRef mobile app or call the facility directly. Nearby search: reply 1 and share location. Type MENU.');
      break;
    default:
      await sendWhatsAppText(phone, mainMenu());
  }
}
