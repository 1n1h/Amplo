import type { APIRoute } from 'astro';
import { verifyGoogleIdToken } from '../../../lib/google-auth';
import { getAllowedAdminEmails } from '../../../lib/env';
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
  // Wider window than the old password endpoint — Google itself does the heavy
  // lifting on credential checking, so we mostly want to throttle disallowed-email
  // probes.
  const limited = rateLimit(`google-login:${ip}`, 20, 15 * 60 * 1000);
  if (!limited.ok) {
    return json(429, {
      error: `Too many attempts. Try again in ${Math.ceil(limited.retryAfterSec / 60)} minute(s).`,
    });
  }

  let body: { credential?: string };
  try {
    body = (await request.json()) as { credential?: string };
  } catch {
    return json(400, { error: 'Invalid request body.' });
  }

  if (typeof body.credential !== 'string' || body.credential.length === 0) {
    return json(400, { error: 'Missing Google credential.' });
  }

  let identity;
  try {
    identity = await verifyGoogleIdToken(body.credential);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[google-login] token verification failed:', message);
    return json(401, { error: 'Could not verify Google sign-in.' });
  }

  const allowed = getAllowedAdminEmails();
  if (!allowed.includes(identity.email)) {
    console.warn(`[google-login] rejected non-allowlisted email: ${identity.email}`);
    return json(403, {
      error: 'This Google account is not authorized for the Amplo admin.',
    });
  }

  setSessionCookie(cookies, url.protocol === 'https:');
  return json(200, { ok: true });
};
