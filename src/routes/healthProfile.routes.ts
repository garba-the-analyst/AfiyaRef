import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const healthProfileRouter = Router();

const updateSchema = z.object({
  blood_group: z.string().optional(),
  genotype: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  chronic_conditions: z.array(z.string()).optional(),
  emergency_contact_phone: z.string().optional(),
  active_prescriptions: z.unknown().optional(),
});

healthProfileRouter.get('/me', async (req: AuthRequest, res) => {
  const p = await prisma.healthProfile.findUnique({ where: { userId: req.user!.sub } });
  res.json(p);
});

healthProfileRouter.put('/me', async (req: AuthRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const p = await prisma.healthProfile.upsert({
    where: { userId: req.user!.sub },
    create: {
      userId: req.user!.sub,
      bloodGroup: d.blood_group,
      genotype: d.genotype,
      allergies: d.allergies ?? [],
      chronicConditions: d.chronic_conditions ?? [],
      emergencyContactPhone: d.emergency_contact_phone,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activePrescriptions: d.active_prescriptions as any,
    },
    update: {
      bloodGroup: d.blood_group,
      genotype: d.genotype,
      allergies: d.allergies,
      chronicConditions: d.chronic_conditions,
      emergencyContactPhone: d.emergency_contact_phone,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activePrescriptions: d.active_prescriptions as any,
    },
  });
  res.json(p);
});
