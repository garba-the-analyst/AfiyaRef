import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, adminKey, registerUser } from './helpers';
import { prisma } from '../src/lib/prisma';

describe('transfers', () => {
  it('check-in creates a NOTIFIED record with EHR payload', async () => {
    const { token } = await registerUser();
    const fac = await prisma.facility.findFirstOrThrow();
    const res = await request(app)
      .post('/api/transfers/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ treating_facility_id: fac.id, nhia_number_used: 'NHIA-TEST-1' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('NOTIFIED');
    expect(res.body.payload.ehr_snapshot).toBeTruthy();

    // admin can ACK it via the admin router
    const ack = await request(app)
      .patch(`/api/admin/transfers/${res.body.id}/status`)
      .set('x-admin-key', adminKey)
      .send({ status: 'ACKNOWLEDGED' });
    expect(ack.status).toBe(200);
    expect(ack.body.status).toBe('ACKNOWLEDGED');
  });

  it('rejects status patch without admin key', async () => {
    const res = await request(app)
      .patch('/api/admin/transfers/00000000-0000-0000-0000-000000000000/status')
      .send({ status: 'ACKNOWLEDGED' });
    expect(res.status).toBe(401);
  });

  it('incoming list requires admin key', async () => {
    const noKey = await request(app).get('/api/admin/transfers/incoming');
    expect(noKey.status).toBe(401);
    const ok = await request(app)
      .get('/api/admin/transfers/incoming?status=NOTIFIED')
      .set('x-admin-key', adminKey);
    expect(ok.status).toBe(200);
    expect(Array.isArray(ok.body)).toBe(true);
  });
});
