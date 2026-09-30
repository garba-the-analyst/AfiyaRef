import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const bookingRouter = Router();

const createSchema = z.object({
  facility_id: z.string().uuid(),
  booking_type: z.enum(['DOCTOR_APPOINTMENT', 'LAB_TEST']),
  scheduled_time: z.string().datetime(),
  notes: z.string().optional(),
});

bookingRouter.post('/', async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = await prisma.booking.create({
    data: {
      userId: req.user!.sub,
      facilityId: parsed.data.facility_id,
      bookingType: parsed.data.booking_type,
      scheduledTime: new Date(parsed.data.scheduled_time),
      notes: parsed.data.notes,
    },
  });
  res.status(201).json(b);
});

bookingRouter.get('/mine', async (req: AuthRequest, res) => {
  const list = await prisma.booking.findMany({
    where: { userId: req.user!.sub },
    include: { facility: true },
    orderBy: { scheduledTime: 'asc' },
  });
  res.json(list);
});

bookingRouter.patch('/:id', async (req: AuthRequest, res) => {
  const parsed = z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = await prisma.booking.updateMany({
    where: { id: req.params.id, userId: req.user!.sub },
    data: { status: parsed.data.status },
  });
  res.json({ updated: b.count });
});
