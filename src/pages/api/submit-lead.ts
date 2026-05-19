import type { APIRoute } from 'astro';
import { validateLead } from '../../lib/validation';
import { appendLead } from '../../lib/sheets';
import { sendLeadNotification } from '../../lib/resend';
import { rateLimit, getClientIp } from '../../lib/rate-limit';

export const prerender = false;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, url }) => {
  // 5 submissions per 10 minutes per IP — keeps a stray bot from filling the Sheet.
  const ip = getClientIp(request.headers);
  const limited = rateLimit(`submit:${ip}`, 5, 10 * 60 * 1000);
  if (!limited.ok) {
    return json(429, {
      error: 'Too many submissions. Please try again in a few minutes.',
    });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid request body.' });
  }

  const result = validateLead(raw);
  if (!result.ok) {
    return json(400, { error: result.error });
  }
  // Honeypot tripped — fake success so bots don't learn they were caught.
  if (result.spam || !result.data) {
    return json(200, { ok: true });
  }

  const lead = result.data;
  const adminUrl = new URL('/admin', url.origin).toString();

  // Try to write to the Sheet, but ALWAYS try to email Roger so a Sheet outage
  // never loses the lead.
  let sheetTimestamp: string | null = null;
  let sheetError: Error | null = null;
  try {
    const { timestamp } = await appendLead(lead);
    sheetTimestamp = timestamp;
  } catch (err) {
    sheetError = err instanceof Error ? err : new Error(String(err));
    console.error('[submit-lead] Sheets append failed:', sheetError.message);
  }

  try {
    await sendLeadNotification({
      ...lead,
      timestamp: sheetTimestamp ?? new Date().toISOString(),
      adminUrl,
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('[submit-lead] Resend send failed:', e.message);
    // If both Sheets and email failed, surface an error so the user can retry.
    if (sheetError) {
      return json(500, {
        error: 'Submission failed. Please email us at Roger@amploconsulting.com.',
      });
    }
  }

  return json(200, { ok: true });
};
