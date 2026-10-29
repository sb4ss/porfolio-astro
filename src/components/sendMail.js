import { setLocalizedText } from '../i18n/client.js';
const form = document.querySelector('.formulario');
const button = form.querySelector('button[type="submit"]');
const buttonText = button.querySelector('span');
const status = document.getElementById('contact-status');
let pending = false;
let lastPayload = '';
let requestId;

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (pending || !form.reportValidity()) return;
  const fields = new FormData(form);
  const payload = {
    name: String(fields.get('name') || '').trim(),
    email: String(fields.get('email') || '').trim(),
    subject: String(fields.get('subject') || '').trim(),
    message: String(fields.get('message') || '').trim(),
    website: String(fields.get('website') || ''),
  };
  const serialized = JSON.stringify(payload);
  if (serialized !== lastPayload || !requestId) {
    requestId = crypto.randomUUID();
    lastPayload = serialized;
  }
  pending = true;
  button.disabled = true;
  setLocalizedText(buttonText, 'Sending…');
  form.setAttribute('aria-busy', 'true');
  status.dataset.state = 'pending';
  setLocalizedText(status, 'Sending your message…');
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, requestId }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true) {
      throw new Error(result?.message || 'Your message could not be sent. Please try again or email me directly.');
    }
    status.dataset.state = 'success';
    setLocalizedText(status, 'Message sent. Thanks for reaching out!');
    form.reset();
    requestId = undefined;
    lastPayload = '';
  } catch (error) {
    status.dataset.state = 'error';
    setLocalizedText(status, error.name === 'TimeoutError'
      ? 'The request timed out. Your message is still here; please try again.'
      : error instanceof TypeError
        ? 'Unable to connect. Your message is still here; please try again or email me directly.'
        : error.message);
  } finally {
    pending = false;
    button.disabled = false;
    setLocalizedText(buttonText, 'Send message');
    form.removeAttribute('aria-busy');
  }
});
