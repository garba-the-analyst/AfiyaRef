import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './helpers';

describe('routing', () => {
  it('returns an OSRM road route with distance and duration', async () => {
    const res = await request(app).get(
      '/api/facilities/route?from_lat=6.52&from_lng=3.37&to_lat=6.5244&to_lng=3.3792',
    );
    expect(res.status).toBe(200);
    expect(res.body.coordinates.length).toBeGreaterThan(2);
    expect(res.body.distance_m).toBeGreaterThan(0);
    expect(res.body.duration_s).toBeGreaterThan(0);
    const [lat, lng] = res.body.coordinates[0];
    expect(Math.abs(lat - 6.52)).toBeLessThan(0.05);
    expect(Math.abs(lng - 3.37)).toBeLessThan(0.05);
    expect(res.body.steps.length).toBeGreaterThan(1);
    expect(res.body.steps[0].instruction).toBeTruthy();
    expect(res.body.steps[res.body.steps.length - 1].instruction).toMatch(/arrived/i);
  });

  it('rejects bad coords', async () => {
    const res = await request(app).get('/api/facilities/route?from_lat=999&from_lng=3&to_lat=6&to_lng=3');
    expect(res.status).toBe(400);
  });
});
