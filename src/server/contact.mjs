import { z } from 'zod';

const line = max => z.string().trim().min(1).max(max).refine(value => !/[\u0000-\u001f\u007f]/.test(value));
const schema = z.object({
  name: line(100),
  email: z.string().trim().email().max(254),
  subject: line(160),
  message: z.string().trim().min(10).max(5000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)),
  website: z.string().max(200).default(''),
  requestId: z.string().uuid(),
}).strict();
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
});

// Best-effort per-instance throttling. Use a shared limiter/WAF for public deployment at scale.
export function createContactHandler({ send = fetch, now = Date.now, bodyTimeoutMs = 5000 } = {}) {
  const attempts = new Map();
  return async (request, config, clientAddress = 'unknown') => {
    if (request.method !== 'POST') return json(405, { ok: false }, { Allow: 'POST' });
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return json(403, { ok: false, message: 'Please send your message from this website.' });
    }
    const timestamp = now();
    for (const [key, value] of attempts) if (value.expires <= timestamp) attempts.delete(key);
    const bucket = attempts.get(clientAddress) || { count: 0, expires: timestamp + 600000 };
    if (bucket.count >= 5 || (!attempts.has(clientAddress) && attempts.size >= 10000)) {
      return json(429, { ok: false, message: 'Too many attempts. Please wait a few minutes or email me directly.' }, { 'Retry-After': '600' });
    }
    // Count malformed requests too, before any asynchronous body reading.
    bucket.count++;
    attempts.set(clientAddress, bucket);
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' ||
        (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity')) {
      return json(415, { ok: false, message: 'Please use the contact form.' });
    }
    if (Number(request.headers.get('content-length')) > 32768) {
      return json(413, { ok: false, message: 'Your message is too long.' });
    }
    let raw;
    let timer;
    let reader;
    try {
      reader = request.body?.getReader();
      if (!reader) return json(400, { ok: false, message: 'Please complete the form.' });
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Body timeout')), bodyTimeoutMs);
      });
      const chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await Promise.race([reader.read(), deadline]);
        if (done) break;
        size += value.byteLength;
        if (size > 32768) {
          await reader.cancel();
          return json(413, { ok: false, message: 'Your message is too long.' });
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      reader?.cancel().catch(() => {});
      return json(400, { ok: false, message: 'Please check the form and try again.' });
    } finally {
      clearTimeout(timer);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success || parsed.data.website) {
      return json(400, { ok: false, message: 'Please check all fields. Your message must contain at least 10 characters.' });
    }
    if (!config.apiKey || !config.from || !config.to) {
      return json(503, { ok: false, message: 'The contact form is temporarily unavailable. Please email me directly.' });
    }
    const { name, email, subject, message, requestId } = parsed.data;
    try {
      const response = await send('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `portfolio-contact/${requestId}`,
        },
        body: JSON.stringify({
          from: config.from,
          to: [config.to],
          reply_to: email,
          subject: `[Portfolio] ${subject}`,
          text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.id !== 'string' || !result.id) {
        return json(502, { ok: false, message: 'Your message could not be sent. Please try again or email me directly.' });
      }
      return json(200, { ok: true });
    } catch {
      return json(502, { ok: false, message: 'The email service is unavailable. Please try again or email me directly.' });
    }
  };
}
