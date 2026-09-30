import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { askNurseTiti, ChatTurn, isLive, isPotentialEmergency } from '../services/nurseTiti.service';
import { searchFacilities } from '../services/facility.service';
import { redis } from '../lib/redis';
import { AuthRequest } from '../middleware/auth';
import { env } from '../config/env';

export const nurseRouter = Router();

const histKey = (userId: string) => `nurse_hist:${userId}`;

export function nurseStatusHandler(_req: Request, res: Response) {
  res.json({ live: isLive(), model: isLive() ? env.openaiModel : null });
}

// GET /api/nurse/status — lets the app show Online/Offline badge
nurseRouter.get('/status', nurseStatusHandler);

// POST /api/nurse/chat { message, lat?, lng? } — server-side history per user
nurseRouter.post('/chat', async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      message: z.string().min(1).max(2000),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.sub;
  const raw = await redis.get(histKey(userId)).catch(() => null);
  const history: ChatTurn[] = raw ? JSON.parse(raw) : [];

  const { reply, offline } = await askNurseTiti(parsed.data.message, history);
  history.push({ role: 'user', content: parsed.data.message }, { role: 'assistant', content: reply });
  await redis.set(histKey(userId), JSON.stringify(history.slice(-16)), 'EX', 86400).catch(() => undefined);

  const emergency = isPotentialEmergency(parsed.data.message);
  let facilities = undefined;
  if (emergency && parsed.data.lat !== undefined && parsed.data.lng !== undefined) {
    try {
      facilities = await searchFacilities({
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        radiusKm: 15,
        emergencyOnly: true,
        limit: 2,
      });
    } catch {
      facilities = undefined;
    }
  }
  res.json({ reply, offline, emergency, facilities: facilities ?? undefined });
});

// DELETE /api/nurse/history — reset conversation
nurseRouter.delete('/history', async (req: AuthRequest, res) => {
  await redis.del(histKey(req.user!.sub)).catch(() => undefined);
  res.json({ ok: true });
});
