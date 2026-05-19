import type { APIRoute } from 'astro';
import { queryFreeBusy } from '../../lib/calendar';
import {
  buildSlotsForDate,
  parseDateString,
  slotIsAvailable,
  slotIsInFuture,
  validateBookingDate,
} from '../../lib/booking-validation';
import { rateLimit, getClientIp } from '../../lib/rate-limit';

export const prerender = false;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  // Cheap shield: 60 lookups per minute per IP.
  const ip = getClientIp(request.headers);
  const limited = rateLimit(`avail:${ip}`, 60, 60 * 1000);
  if (!limited.ok) {
    return json(429, { error: 'Too many requests. Please slow down.' });
  }

  const dateStr = url.searchParams.get('date') ?? '';
  const dateCheck = validateBookingDate(dateStr);
  if (!dateCheck.ok) {
    return json(400, { error: dateCheck.error ?? 'Invalid date.' });
  }
  const parsed = parseDateString(dateStr)!; // safe: validate passed

  const slots = buildSlotsForDate(parsed.year, parsed.month, parsed.day);
  if (slots.length === 0) {
    return json(200, { date: dateStr, slots: [] });
  }

  // Free/busy window spans the whole working day (so a meeting starting just
  // before 9:00 still blocks the 9:00 slot through the buffer rule).
  const windowStart = new Date(new Date(slots[0]!.startISO).getTime() - 60 * 60 * 1000);
  const windowEnd = new Date(new Date(slots[slots.length - 1]!.endISO).getTime() + 60 * 60 * 1000);

  let busy: { startMs: number; endMs: number }[];
  try {
    busy = await queryFreeBusy(windowStart.toISOString(), windowEnd.toISOString());
  } catch (err) {
    console.error('[availability] freeBusy failed:', err);
    return json(502, { error: 'Could not load availability. Please try again.' });
  }

  const result = slots.map((s) => ({
    startISO: s.startISO,
    endISO: s.endISO,
    label: s.label,
    available: slotIsInFuture(s) && slotIsAvailable(s, busy),
  }));

  return json(200, { date: dateStr, slots: result });
};
