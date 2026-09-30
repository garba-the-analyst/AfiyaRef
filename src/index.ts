import { createApp } from './app';
import { env } from './config/env';
import { redis } from './lib/redis';

async function main() {
  try {
    await redis.connect().catch(() => undefined);
  } catch {
    console.warn('[redis] continuing without cache connection');
  }
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`AfiyaRef backend listening on :${env.port}`);
  });
}

main();
