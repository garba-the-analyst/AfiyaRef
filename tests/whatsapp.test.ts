import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, randomPhone, sleep } from './helpers';

function metaText(from: string, body: string) {
  return {
    entry: [{ changes: [{ value: { messages: [{ from, type: 'text', text: { body } }] } }] }],
  };
}

describe('whatsapp webhook', () => {
  it('verifies handshake with correct token', async () => {
    const token = process.env.WHATSAPP_VERIFY_TOKEN ?? 'afiyaref-verify-token';
    const res = await request(app).get(
      `/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=abc123`,
    );
    expect(res.status).toBe(200);
    expect(res.text).toBe('abc123');
  });

  it('rejects handshake with wrong token', async () => {
    const res = await request(app).get(
      '/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc',
    );
    expect(res.status).toBe(403);
  });

  it('answers MENU through the state machine', async () => {
    const from = randomPhone().replace('+', '');
    await request(app).delete('/whatsapp/dev-outbox');
    const res = await request(app).post('/whatsapp/webhook').send(metaText(from, 'hello'));
    expect(res.status).toBe(200);
    await sleep(1500);
    const outbox = await request(app).get('/whatsapp/dev-outbox');
    const bodies = (outbox.body.messages as { body: string }[]).map((m) => m.body).join('\n');
    expect(bodies).toMatch(/AfiyaRef/);
  });
});
