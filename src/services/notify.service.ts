import { env } from '../config/env';

export interface SentNotification {
  to: string;
  channel: 'sms' | 'log';
  message: string;
  live: boolean;
  at: string;
}

/** In-memory record of dispatched notifications (inspectable in dev). */
export const sentNotifications: SentNotification[] = [];

export function clearNotifications() {
  sentNotifications.length = 0;
}

function record(n: Omit<SentNotification, 'at'>) {
  sentNotifications.push({ ...n, at: new Date().toISOString() });
  if (sentNotifications.length > 100) sentNotifications.shift();
}

/** Send an SMS via Termii (Nigeria). Falls back to log-only when unconfigured. */
export async function sendSms(to: string, message: string): Promise<void> {
  if (!env.termiiApiKey) {
    console.log(`[sms:dry-run -> ${to}] ${message}`);
    record({ to, channel: 'sms', message, live: false });
    return;
  }
  try {
    const res = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        from: env.termiiSender,
        sms: message.slice(0, 400),
        type: 'plain',
        channel: 'generic',
        api_key: env.termiiApiKey,
      }),
    });
    const ok = res.ok;
    if (!ok) console.error('[sms:termii-error]', await res.text());
    record({ to, channel: 'sms', message, live: ok });
  } catch (e) {
    console.error('[sms:termii-exception]', (e as Error).message);
    record({ to, channel: 'sms', message, live: false });
  }
}
