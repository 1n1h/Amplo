import type { APIRoute } from 'astro';
import { getLeads, type LeadRow } from '../../../lib/sheets';

export const prerender = false;

function csvEscape(value: string): string {
  if (value === '') return '';
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToCsv(r: LeadRow): string {
  return [
    r.timestamp,
    r.name,
    r.email,
    r.mobile,
    r.industry,
    r.notes,
    r.status,
    r.appointment,
  ]
    .map(csvEscape)
    .join(',');
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const all = await getLeads();
    const statusFilter = url.searchParams.get('status');
    const q = url.searchParams.get('q')?.toLowerCase().trim() ?? '';

    let filtered = all;
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }
    if (q) {
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.industry.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q)
      );
    }

    const header = [
      'Timestamp',
      'Name',
      'Email',
      'Mobile',
      'Industry',
      'More',
      'Status',
      'Appointment',
    ].join(',');
    const csv = [header, ...filtered.map(rowToCsv)].join('\r\n');

    const filename = `amplo-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/export] failed:', message);
    return new Response('Export failed.', { status: 500 });
  }
};
