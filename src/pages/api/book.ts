import type { APIRoute } from 'astro';
import { performBooking } from '../../lib/booking';
import { rateLimit, getClientIp } from '../../lib/rate-limit';

export const prerender = false;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const ip = getClientIp(request.headers);
  const limited = rateLimit(`book:${ip}`, 5, 10 * 60 * 1000);
  if (!limited.ok) {
    return json(429, { error: 'Too many booking attempts. Please try again later.' });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid request body.' });
  }

  const result = await performBooking(raw);
  if (!result.ok) {
    return json(result.status, { error: result.error });
  }
  return json(200, { ok: true, eventId: result.eventId });
};
