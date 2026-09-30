import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { buildEhrSnapshot, createTransfer } from '../services/transfer.service';
import { sentNotifications, clearNotifications } from '../services/notify.service';

export const transferRouter = Router();

/** Admin/facility routes — mounted WITHOUT user JWT (guarded by admin key). */
export const transferAdminRouter = Router();

transferRouter.post('/checkin', async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      treating_facility_id: z.string().uuid(),
      nhia_number_used: z.string().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const record = await createTransfer({
      userId: req.user!.sub,
      treatingFacilityId: parsed.data.treating_facility_id,
      nhiaNumberUsed: parsed.data.nhia_number_used,
    });
    res.status(201).json(record);
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

transferRouter.get('/mine', async (req: AuthRequest, res) => {
  const list = await prisma.crossFacilityTransfer.findMany({
    where: { userId: req.user!.sub },
    include: { treatingFacility: true, homeFacility: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(list);
});

transferRouter.get('/ehr-snapshot', async (req: AuthRequest, res) => {
  try {
    res.json(await buildEhrSnapshot(req.user!.sub));
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

transferAdminRouter.get('/incoming', adminMiddleware, async (req, res) => {
  // Facility portal: list transfers involving a facility, newest first.
  const facilityId = req.query.facility_id as string | undefined;
  const status = req.query.status as string | undefined;
  const list = await prisma.crossFacilityTransfer.findMany({
    where: {
      ...(facilityId ? { OR: [{ treatingFacilityId: facilityId }, { homeFacilityId: facilityId }] } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: { treatingFacility: true, homeFacility: true, user: { select: { fullName: true, phoneNumber: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(list);
});

transferAdminRouter.get('/notifications', adminMiddleware, (_req, res) => {
  res.json({ notifications: sentNotifications });
});

transferAdminRouter.delete('/notifications', adminMiddleware, (_req, res) => {
  clearNotifications();
  res.json({ ok: true });
});

transferAdminRouter.patch('/:id/status', adminMiddleware, async (req, res) => {  const parsed = z.object({ status: z.enum(['ACKNOWLEDGED', 'REJECTED']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = await prisma.crossFacilityTransfer.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status },
  });
  res.json(updated);
});
