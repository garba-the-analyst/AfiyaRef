import { createApp } from './app';
import { env } from './config/env';
import { redis } from './lib/redis';
import { startBaileys } from './whatsapp/baileysClient';

async function main() {
  try {
    await redis.connect().catch(() => undefined);
  } catch {
    console.warn('[redis] continuing without cache connection');
  }
  if (process.env.WHATSAPP_PROVIDER === 'baileys') {
    startBaileys().catch((e) => console.error('[baileys:startup]', e));
  }
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`AfiyaRef backend listening on :${env.port}`);
  });
}

main();
