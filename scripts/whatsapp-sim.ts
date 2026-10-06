/* WhatsApp simulator: drives the full bot state machine through the real
 * webhook endpoint using Meta-shaped payloads. Requires the server running
 * with WHATSAPP_DRY_RUN=1. Usage: npm run whatsapp:sim */
const BASE = process.env.SIM_BASE ?? 'http://localhost:3006';
const FROM = process.env.SIM_FROM ?? '2348012345678';

interface OutMsg { to: string; kind?: string; body: string; }

function payload(msg: object) {
  return {
    entry: [{ changes: [{ value: { messages: [{ from: FROM, ...msg }] } }] }],
  };
}
const text = (body: string) => payload({ type: 'text', text: { body } });
const location = (lat: number, lng: number) => payload({ type: 'location', location: { latitude: lat, longitude: lng } });

async function outboxCount(): Promise<number> {
  const res = await fetch(`${BASE}/whatsapp/dev-outbox`);
  const data = (await res.json()) as { messages: OutMsg[] };
  return data.messages.filter((m) => m.to.includes(FROM.replace(/^\+/, '')) || FROM.includes(m.to.replace(/^\+/, ''))).length;
}

async function send(msg: object) {
  const res = await fetch(`${BASE}/whatsapp/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
  if (res.status !== 200) throw new Error(`webhook returned ${res.status}`);
}

async function lastReply(kind?: string): Promise<string> {
  const res = await fetch(`${BASE}/whatsapp/dev-outbox`);
  const data = (await res.json()) as { messages: OutMsg[] };
  const mine = data.messages.filter((m) => m.to.includes(FROM.replace(/^\+/, '')) || FROM.includes(m.to.replace(/^\+/, '')));
  const filtered = kind ? mine.filter((m) => (m.kind ?? 'text') === kind) : mine;
  return filtered.length ? filtered[filtered.length - 1].body : '(no reply)';
}

async function step(label: string, msg: object, expect: RegExp, extra = 0) {
  const before = await outboxCount();
  await send(msg);
  // wait for this step's reply/replies (live LLM calls take seconds)
  const want = 1 + extra;
  const start = Date.now();
  while (Date.now() - start < 90000) {
    if ((await outboxCount()) >= before + want) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const reply = await lastReply('text');
  const ok = expect.test(reply);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  console.log(`  ↳ ${reply.slice(0, 160).replace(/\n/g, ' ')}${reply.length > 160 ? '…' : ''}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  await fetch(`${BASE}/whatsapp/dev-outbox`, { method: 'DELETE' });
  console.log(`Simulating WhatsApp user +${FROM} against ${BASE}\n`);

  await step('MENU shows options', text('hello'), /AfiyaRef/);
  await step('1 → asks for location', text('1'), /share your location/i);
  await step('location → top-3 hospitals', location(6.52, 3.37), /Lagos University Teaching Hospital/, 3);
  await step('location → in-chat map bubbles', location(6.52, 3.37), /./); // reply text (assert bubbles below)
  {
    const res = await fetch(`${BASE}/whatsapp/dev-outbox`);
    const data = (await res.json()) as { messages: OutMsg[] };
    const pins = data.messages.filter((m) => m.kind === 'location');
    const ok = pins.length >= 3 && /Lagos University Teaching Hospital/.test(pins[0].body);
    console.log(`${ok ? 'PASS' : 'FAIL'} map bubbles (${pins.length} location pins)`);
    if (pins[0]) console.log(`  ↳ ${pins[0].body.slice(0, 140)}`);
    if (!ok) process.exitCode = 1;
  }
  await step('2 → enters Nurse Titi', text('2'), /Nurse Titi/);
  await step('nurse answers with disclaimer', text('Someone burned their hand, what do I do?'), /life[‐‑‒–—−-]threatening emergency/);
  await step('EXIT leaves Nurse Titi', text('EXIT'), /AfiyaRef/);
  await step('3 → check-in format prompt', text('3'), /NHIA_NUMBER/);
  await step(
    'check-in creates transfer',
    text('NHIA-TEST-001 | Reddington Hospital Lekki'),
    /Tracking ID/,
  );

  console.log(process.exitCode ? '\nSome steps FAILED' : '\nAll simulator steps passed ✅');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
