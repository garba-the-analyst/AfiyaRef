import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, adminKey, registerUser } from './helpers';
import { prisma } from '../src/lib/prisma';

describe('transfer alerts', () => {
  it('sends SMS to home facility and emergency contact on check-in', async () => {
    const home = await prisma.facility.findFirstOrThrow({ where: { phoneNumber: { not: null } } });
    const treating = await prisma.facility.findFirstOrThrow({ where: { id: { not: home.id } } });

    // register with home hospital, then set emergency contact
    const phone = `+2348${String(Math.floor(100000000 + Math.random() * 899999999))}`;
    const reg = await request(app).post('/api/auth/register').send({
      phone_number: phone,
      password: 'test1234',
      full_name: 'Alert Test',
      home_hospital_id: home.id,
    });
    expect(reg.status).toBe(201);
    const token = reg.body.token as string;
    await request(app)
      .put('/api/health-profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ emergency_contact_phone: '+2348011112222' });

    await request(app).delete('/api/admin/transfers/notifications').set('x-admin-key', adminKey);

    const checkin = await request(app)
      .post('/api/transfers/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ treating_facility_id: treating.id, nhia_number_used: 'NHIA-ALERT-1' });
    expect(checkin.status).toBe(201);

    const notifs = await request(app)
      .get('/api/admin/transfers/notifications')
      .set('x-admin-key', adminKey);
    expect(notifs.status).toBe(200);
    const to = (notifs.body.notifications as { to: string }[]).map((n) => n.to);
    expect(to).toContain(home.phoneNumber);
    expect(to).toContain('+2348011112222');
  });
});
