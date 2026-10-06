import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, registerUser } from './helpers';

describe('nurse titi', () => {
  it('status reports live flag', async () => {
    const res = await request(app).get('/api/nurse/status');
    expect(res.status).toBe(200);
    expect(typeof res.body.live).toBe('boolean');
  });

  it('chat returns guarded reply (offline fallback without key)', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/nurse/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Someone burned their hand, what do I do?' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/life[‐‑‒–—−-]threatening emergency/);
  });

  it('flags emergencies and suggests facilities with coords', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/nurse/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Chest pain and cannot breathe', lat: 6.52, lng: 3.37 });
    expect(res.status).toBe(200);
    expect(res.body.emergency).toBe(true);
    expect(res.body.facilities?.length).toBeGreaterThan(0);
  });

  it('requires auth', async () => {
    const res = await request(app).post('/api/nurse/chat').send({ message: 'hi' });
    expect(res.status).toBe(401);
  });
});
