import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../../lib/session';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, url }) => {
  clearSessionCookie(cookies, url.protocol === 'https:');
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
