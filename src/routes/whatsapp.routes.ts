import crypto from 'node:crypto';
import { Router, Request } from 'express';
import { env } from '../config/env';
import { handleIncoming } from '../whatsapp/stateMachine';
import { outbox, clearOutbox } from '../whatsapp/metaClient';

export const whatsappRouter = Router();

type RawReq = Request & { rawBody?: Buffer };

function validSignature(req: RawReq): boolean {
  if (!env.whatsappAppSecret) return true; // dev/sim mode: no secret configured
  const sig = req.headers['x-hub-signature-256'] as string | undefined;
  if (!sig || !req.rawBody) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', env.whatsappAppSecret).update(req.rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// GET /whatsapp/webhook — Meta verification handshake
whatsappRouter.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === env.whatsappVerifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// POST /whatsapp/webhook — Meta Cloud API payloads
whatsappRouter.post('/webhook', async (req: RawReq, res) => {
  if (!validSignature(req)) return res.sendStatus(401);
  // Acknowledge immediately; process async
  res.sendStatus(200);
  try {
    const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msg = entry?.messages?.[0];
    if (!msg) return;
    const from: string = msg.from;

    if (msg.type === 'location') {
      await handleIncoming(from, '', { lat: msg.location.latitude, lng: msg.location.longitude });
    } else if (msg.type === 'text') {
      await handleIncoming(from, msg.text?.body ?? '');
    } else if (msg.type === 'interactive') {
      const reply =
        msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id ?? '';
      await handleIncoming(from, reply);
    } else {
      await handleIncoming(from, 'MENU');
    }
  } catch (e) {
    console.error('[whatsapp:webhook]', e);
  }
});

// Dev-only outbox inspector for the simulator (disabled in production)
whatsappRouter.get('/dev-outbox', (_req, res) => {
  if (env.nodeEnv === 'production') return res.sendStatus(404);
  res.json({ messages: outbox });
});

whatsappRouter.delete('/dev-outbox', (_req, res) => {
  if (env.nodeEnv === 'production') return res.sendStatus(404);
  clearOutbox();
  res.json({ ok: true });
});
