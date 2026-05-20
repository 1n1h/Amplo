import type { APIRoute } from 'astro';
import { updateLead, VALID_STATUSES, type LeadStatus } from '../../../../lib/sheets';

export const prerender = false;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ params, request }) => {
  const rowNumber = Number(params.rowNumber);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    return json(400, { error: 'Invalid row number.' });
  }

  let body: { status?: string; notes?: string };
  try {
    body = (await request.json()) as { status?: string; notes?: string };
  } catch {
    return json(400, { error: 'Invalid request body.' });
  }

  const updates: { status?: string; notes?: string } = {};
  if (typeof body.status === 'string') {
    if (!VALID_STATUSES.includes(body.status as LeadStatus)) {
      return json(400, { error: 'Invalid status.' });
    }
    updates.status = body.status;
  }
  if (typeof body.notes === 'string') {
    updates.notes = body.notes.slice(0, 5000);
  }
  if (Object.keys(updates).length === 0) {
    return json(400, { error: 'No fields to update.' });
  }

  try {
    await updateLead(rowNumber, updates);
    return json(200, { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/lead update] failed:', message);
    return json(500, { error: 'Update failed.' });
  }
};
