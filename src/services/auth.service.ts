import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { normalizePhone } from '../utils/phone';
import { signToken } from '../middleware/auth';

export const registerSchema = z.object({
  phone_number: z.string().min(7),
  password: z.string().min(6),
  full_name: z.string().min(2),
  dob: z.string().datetime().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  insurance_provider: z.string().optional(),
  nhia_policy_number: z.string().optional(),
  home_hospital_id: z.string().uuid().optional(),
});

export const loginSchema = z.object({
  phone_number: z.string().min(7),
  password: z.string().min(1),
});

export async function register(input: z.infer<typeof registerSchema>) {
  const phoneNumber = normalizePhone(input.phone_number);
  const existing = await prisma.user.findUnique({ where: { phoneNumber } });
  if (existing) throw Object.assign(new Error('Phone number already registered'), { status: 409 });

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      phoneNumber,
      passwordHash,
      fullName: input.full_name,
      dob: input.dob ? new Date(input.dob) : undefined,
      gender: input.gender,
      insuranceProvider: input.insurance_provider,
      nhiaPolicyNumber: input.nhia_policy_number,
      homeHospitalId: input.home_hospital_id,
    },
  });
  await prisma.healthProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });
  const token = signToken(user.id, user.phoneNumber);
  return { user: sanitize(user), token };
}

export async function login(input: z.infer<typeof loginSchema>) {
  const phoneNumber = normalizePhone(input.phone_number);
  const user = await prisma.user.findUnique({ where: { phoneNumber } });
  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  const token = signToken(user.id, user.phoneNumber);
  return { user: sanitize(user), token };
}

function sanitize(u: Record<string, unknown>) {
  const { passwordHash, ...rest } = u;
  return rest;
}
