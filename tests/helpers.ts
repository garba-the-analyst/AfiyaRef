import request from 'supertest';
import { createApp } from '../src/app';

export const app = createApp();

export const adminKey = process.env.ADMIN_API_KEY ?? '';

export function randomPhone(): string {
  const n = Math.floor(100000000 + Math.random() * 899999999);
  return `+2349${String(n).slice(0, 9)}`;
}

export async function registerUser(phone = randomPhone(), password = 'test1234') {
  const res = await request(app).post('/api/auth/register').send({
    phone_number: phone,
    password,
    full_name: 'Test User',
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { phone, password, token: res.body.token as string, user: res.body.user };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
