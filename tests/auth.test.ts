import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, randomPhone, registerUser } from './helpers';

describe('auth', () => {
  it('registers and logs in', async () => {
    const phone = randomPhone();
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ phone_number: phone, password: 'test1234', full_name: 'Test User' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeTruthy();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ phone_number: phone, password: 'test1234' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  it('rejects duplicate registration', async () => {
    const { phone } = await registerUser();
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ phone_number: phone, password: 'test1234', full_name: 'Dup' });
    expect(dup.status).toBe(409);
  });

  it('rejects bad password', async () => {
    const { phone } = await registerUser();
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ phone_number: phone, password: 'wrong' });
    expect(bad.status).toBe(401);
  });

  it('normalizes 080… numbers to +234', async () => {
    const phone = randomPhone();
    const local = '0' + phone.replace('+234', '');
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ phone_number: local, password: 'test1234', full_name: 'Local Format' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.phoneNumber).toBe(phone);
  });
});
