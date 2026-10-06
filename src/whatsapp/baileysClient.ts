import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { handleIncoming } from './stateMachine';
import { normalizePhone } from '../utils/phone';

let sock: WASocket | null = null;
let up = false;

export function isBaileysUp(): boolean {
  return up && sock !== null;
}

function jidToPhone(jid: string): string {
  return normalizePhone(jid.split('@')[0].split(':')[0]);
}

/** Start the local Baileys session (QR pairing). Call once at boot when enabled. */
export async function startBaileys(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState('./baileys_auth');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, undefined as never),
    },
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('\n📱 Scan this QR with the bot WhatsApp number (Linked devices):\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      up = true;
      console.log('[baileys] connected ✅ — messages to the paired number now reach AfiyaRef');
    }
    if (connection === 'close') {
      up = false;
      const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`[baileys] connection closed (${code}). ${loggedOut ? 'Logged out — delete baileys_auth/ and re-scan.' : 'Reconnecting in 5s…'}`);
      if (!loggedOut) setTimeout(() => startBaileys().catch((e) => console.error('[baileys]', e)), 5000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      try {
        if (m.key.fromMe || !m.message) continue;
        const remote = m.key.remoteJid ?? '';
        if (remote === 'status@broadcast' || remote.endsWith('@g.us')) continue; // skip statuses + groups
        const from = jidToPhone(remote);
        const msg = m.message;

        if (msg.locationMessage) {
          await handleIncoming(from, '', {
            lat: msg.locationMessage.degreesLatitude ?? 0,
            lng: msg.locationMessage.degreesLongitude ?? 0,
          });
        } else {
          const text =
            msg.conversation ??
            msg.extendedTextMessage?.text ??
            msg.buttonsResponseMessage?.selectedButtonId ??
            msg.listResponseMessage?.singleSelectReply?.selectedRowId ??
            msg.templateButtonReplyMessage?.selectedId ??
            '';
          if (text) await handleIncoming(from, text);
        }
      } catch (e) {
        console.error('[baileys:incoming]', e);
      }
    }
  });
}

function toJid(phone: string): string {
  const digits = normalizePhone(phone).replace('+', '');
  return `${digits}@s.whatsapp.net`;
}

/** Outbound text via the paired session. */
export async function sendBaileysText(to: string, body: string): Promise<void> {
  if (!sock) {
    console.log(`[baileys:queued-> ${to}] ${body.slice(0, 120)}`);
    return;
  }
  await sock.sendMessage(toJid(to), { text: body.slice(0, 4000) });
}

/** Outbound native location bubble via the paired session. */
export async function sendBaileysLocation(
  to: string,
  loc: { latitude: number; longitude: number; name: string; address?: string },
): Promise<void> {
  if (!sock) {
    console.log(`[baileys:loc-queued -> ${to}] ${loc.name}`);
    return;
  }
  await sock.sendMessage(toJid(to), {
    location: {
      degreesLatitude: loc.latitude,
      degreesLongitude: loc.longitude,
      name: loc.name.slice(0, 100),
      address: (loc.address ?? '').slice(0, 100),
    },
  });
}
