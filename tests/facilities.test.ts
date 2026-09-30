import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, adminKey } from './helpers';
import { prisma } from '../src/lib/prisma';

describe('facilities', () => {
  it('finds nearby hospitals ordered by distance', async () => {
    const res = await request(app).get(
      '/api/facilities/search?lat=6.52&lng=3.37&radius_km=15&limit=5',
    );
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
    const dists = res.body.results.map((r: { distance_km: number }) => r.distance_km);
    expect([...dists].sort((a, b) => a - b)).toEqual(dists);
  });

  it('filters by service', async () => {
    const res = await request(app).get(
      '/api/facilities/search?lat=6.52&lng=3.37&radius_km=25&service=Emergency&limit=10',
    );
    expect(res.status).toBe(200);
    for (const r of res.body.results) {
      expect(r.services_offered).toContain('Emergency');
    }
  });

  it('rejects facility creation without admin key', async () => {
    const res = await request(app).post('/api/facilities').send({ name: 'Nope' });
    expect(res.status).toBe(401);
  });

  it('creates and cleans up a facility with admin key', async () => {
    const res = await request(app)
      .post('/api/facilities')
      .set('x-admin-key', adminKey)
      .send({
        name: `Test Clinic ${Date.now()}`,
        facilityType: 'CLINIC',
        latitude: 6.5,
        longitude: 3.37,
      });
    expect(res.status).toBe(201);
    await prisma.facility.delete({ where: { id: res.body.id } });
  });
});
