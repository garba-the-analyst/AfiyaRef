import { env } from '../config/env';

export interface OutboundMessage {
  to: string;
  kind: 'text' | 'location';
  body: string;
  at: string;
  dryRun: boolean;
}

/** In-memory outbox (used by dev simulator via GET /dev/outbox). */
export const outbox: OutboundMessage[] = [];

export function clearOutbox() {
  outbox.length = 0;
}

export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const text = body.slice(0, 4000);
  if (env.whatsappDryRun || !env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
    console.log(`[whatsapp:out -> ${to}] ${text}`);
    outbox.push({ to, kind: 'text', body: text, at: new Date().toISOString(), dryRun: true });
    if (outbox.length > 50) outbox.shift();
    return;
  }
  const url = `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.whatsappAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
  if (!res.ok) console.error('[whatsapp:send-error]', await res.text());
}

export interface WaLocation {
  latitude: number;
  longitude: number;
  name: string;
  address?: string;
}

/** Send a native WhatsApp location bubble (in-chat map view, no app switch). */
export async function sendWhatsAppLocation(to: string, loc: WaLocation): Promise<void> {
  const label = `📍 ${loc.name}${loc.address ? ` — ${loc.address}` : ''} (${loc.latitude},${loc.longitude})`;
  if (env.whatsappDryRun || !env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
    console.log(`[whatsapp:loc -> ${to}] ${label}`);
    outbox.push({ to, kind: 'location', body: label, at: new Date().toISOString(), dryRun: true });
    if (outbox.length > 50) outbox.shift();
    return;
  }
  const url = `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.whatsappAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'location',
      location: {
        latitude: loc.latitude,
        longitude: loc.longitude,
        name: loc.name.slice(0, 1000),
        address: (loc.address ?? '').slice(0, 1000),
      },
    }),
  });
  if (!res.ok) console.error('[whatsapp:send-error]', await res.text());
}
