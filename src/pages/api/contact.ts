import type { APIRoute } from 'astro';
import { createContactHandler } from '../../server/contact.mjs';

export const prerender = false;
const handleContact = createContactHandler();

export const POST: APIRoute = ({ request, clientAddress }) => handleContact(request, {
  apiKey: process.env.RESEND_API_KEY || import.meta.env.RESEND_API_KEY,
  from: process.env.CONTACT_FROM_EMAIL || import.meta.env.CONTACT_FROM_EMAIL,
  to: process.env.CONTACT_TO_EMAIL || import.meta.env.CONTACT_TO_EMAIL,
}, clientAddress);

export const ALL: APIRoute = () => new Response(null, {
  status: 405,
  headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
});
