import type { APIRoute } from 'astro';
import { getLeads } from '../../../lib/sheets';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const leads = await getLeads();
    return new Response(JSON.stringify({ leads }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/leads] read failed:', message);
    return new Response(JSON.stringify({ error: 'Failed to load leads.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
