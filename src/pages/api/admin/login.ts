import type { APIRoute } from 'astro';
import { requireEnv } from '../../../lib/env';
import { setSessionCookie } from '../../../lib/session';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';

export const prerender = false;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const ip = getClientIp(request.headers);
  // 5 attempts per 15 minutes per IP — basic brute-force defense.
  // TODO: Upgrade to a real auth provider before the site is high-traffic.
  const limited = rateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000);
  if (!limited.ok) {
    return json(429, {
      error: `Too many attempts. Try again in ${Math.ceil(limited.retryAfterSec / 60)} minute(s).`,
    });
  }

  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return json(400, { error: 'Invalid request body.' });
  }

  const expected = requireEnv('ADMIN_PASSWORD');
  const supplied = typeof body.password === 'string' ? body.password : '';
  // Don't include the password in errors or logs.
  if (supplied.length === 0 || supplied !== expected) {
    return json(401, { error: 'Incorrect password.' });
  }

  setSessionCookie(cookies, url.protocol === 'https:');
  return json(200, { ok: true });
};
