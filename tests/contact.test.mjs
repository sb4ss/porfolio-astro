import test from 'node:test';
import assert from 'node:assert/strict';
import { createContactHandler } from '../src/server/contact.mjs';

const config = { apiKey: 'test-key', from: 'Portfolio <contact@example.com>', to: 'owner@example.com' };
const payload = { name: 'Test Visitor', email: 'visitor@example.com', subject: 'Project', message: 'Hello from the contact form.', website: '', requestId: '0d4a19e6-5e78-4c0d-9a9b-2cf4db251b21' };
const request = (data = payload, origin = 'https://portfolio.example') => new Request('https://portfolio.example/api/contact', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(data),
});

test('uses the configured recipient and sender, with visitor in reply_to', async () => {
  let calls = 0;
  const handler = createContactHandler({ send: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.resend.com/emails');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.to, ['owner@example.com']);
    assert.equal(body.from, config.from);
    assert.equal(body.reply_to, payload.email);
    assert.match(body.text, /Hello from the contact form/);
    assert.equal(options.headers['Idempotency-Key'], `portfolio-contact/${payload.requestId}`);
    return Response.json({ id: 'accepted-by-provider' });
  } });
  const response = await handler(request(), config, 'test');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls, 1);
});

test('unexpected keys and header/control injection are rejected', async () => {
  let sends = 0;
  const handler = createContactHandler({ send: async () => { sends++; return Response.json({ id: 'unexpected' }); } });
  for (const data of [{ ...payload, to: 'attacker@example.com' }, { ...payload, from: 'spoof@example.com' }, { ...payload, name: 'Name\u0000' }, { ...payload, message: 'Invalid\u0000message' }, JSON.parse('{"__proto__":{"polluted":true}}')]) {
    assert.equal((await handler(request(data), config)).status, 400);
  }
  assert.equal(sends, 0);
  assert.equal({}.polluted, undefined);
});

test('HTML and command-like messages remain plain text to a fixed URL', async () => {
  const message = '<script>alert(1)</script> $(whoami); ../../etc/passwd';
  const handler = createContactHandler({ send: async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    const body = JSON.parse(options.body);
    assert.equal(body.html, undefined);
    assert.ok(body.text.endsWith(message));
    return Response.json({ id: 'test-only' });
  } });
  assert.equal((await handler(request({ ...payload, message }), config)).status, 200);
});

test('malformed requests consume the rate budget', async () => {
  const handler = createContactHandler();
  for (let i = 0; i < 5; i++) assert.equal((await handler(request(null), config, 'bad-client')).status, 400);
  assert.equal((await handler(request(), config, 'bad-client')).status, 429);
});

test('rejects false JSON types and unsupported encoding', async () => {
  for (const headers of [{ 'Content-Type': 'application/jsonp' }, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }]) {
    const req = new Request('https://portfolio.example/api/contact', { method: 'POST', headers: { ...headers, Origin: 'https://portfolio.example' }, body: '{}' });
    assert.equal((await createContactHandler()(req, config)).status, 415);
  }
});

test('stalled uploads are cancelled with a bounded timeout', async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  const req = new Request('https://portfolio.example/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://portfolio.example' }, body, duplex: 'half' });
  const response = await createContactHandler({ bodyTimeoutMs: 20 })(req, config);
  assert.equal(response.status, 400);
  assert.equal(cancelled, true);
});

test('invalid input, honeypot and external origins never call Resend', async () => {
  const handler = createContactHandler({ send: () => { throw new Error('Must not send'); } });
  for (const data of [{ ...payload, email: 'invalid' }, { ...payload, subject: 'Header\ninjection' }, { ...payload, message: 'short' }, { ...payload, website: 'spam' }]) {
    assert.equal((await handler(request(data), config)).status, 400);
  }
  assert.equal((await handler(request(payload, 'https://other.example'), config)).status, 403);
});

test('missing credentials return honest unavailability', async () => {
  const handler = createContactHandler({ send: () => { throw new Error('Must not send'); } });
  const response = await handler(request(), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
});

test('provider rejection, malformed success and network failure never report success', async () => {
  for (const send of [async () => Response.json({ message: 'secret detail' }, { status: 403 }), async () => Response.json({}), async () => { throw new Error('private error'); }]) {
    const response = await createContactHandler({ send })(request(), config);
    assert.equal(response.status, 502);
    const text = await response.text();
    assert.equal(JSON.parse(text).ok, false);
    assert.doesNotMatch(text, /secret detail|private error|test-key/);
  }
});

test('request body limit applies without relying on content-length', async () => {
  const response = await createContactHandler()(request({ ...payload, message: 'x'.repeat(33000) }), config);
  assert.equal(response.status, 413);
});

test('throttles repeated attempts and permits requests after expiry', async () => {
  let time = 1000;
  let sends = 0;
  const handler = createContactHandler({ now: () => time, send: async () => { sends++; return Response.json({ id: 'ok' }); } });
  for (let i = 0; i < 5; i++) assert.equal((await handler(request(), config, 'one-client')).status, 200);
  const limited = await handler(request(), config, 'one-client');
  assert.equal(limited.status, 429);
  assert.equal(sends, 5);
  time += 600001;
  assert.equal((await handler(request(), config, 'one-client')).status, 200);
});
