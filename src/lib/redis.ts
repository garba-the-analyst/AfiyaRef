import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.on('error', (e) => console.error('[redis]', e.message));
