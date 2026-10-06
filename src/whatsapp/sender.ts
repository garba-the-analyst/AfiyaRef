import { sendWhatsAppText as sendMetaText, sendWhatsAppLocation as sendMetaLocation, WaLocation } from './metaClient';
import { sendBaileysText, sendBaileysLocation, isBaileysUp } from './baileysClient';

export function waProvider(): 'meta' | 'baileys' {
  return process.env.WHATSAPP_PROVIDER === 'baileys' ? 'baileys' : 'meta';
}

/** Outbound text — Baileys when paired locally, else Meta Cloud API. */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  if (waProvider() === 'baileys' && isBaileysUp()) {
    return sendBaileysText(to, body);
  }
  return sendMetaText(to, body);
}

/** Outbound location bubble — Baileys when paired locally, else Meta Cloud API. */
export async function sendWhatsAppLocation(to: string, loc: WaLocation): Promise<void> {
  if (waProvider() === 'baileys' && isBaileysUp()) {
    return sendBaileysLocation(to, loc);
  }
  return sendMetaLocation(to, loc);
}
