// Minimal Resend client — single fetch to the public API.
// No SDK needed; keeps the Function bundle small.
import { requireEnv, optionalEnv } from './env';

export interface LeadEmailInput {
  name: string;
  email: string;
  mobile: string;
  message: string;
  timestamp: string;
  adminUrl: string;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] as string
  );
}

function deriveCompany(email: string): string {
  const at = email.indexOf('@');
  if (at < 0) return '';
  const domain = email.slice(at + 1);
  // Skip generic mailbox providers — they're not a company name.
  const generic = new Set([
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'icloud.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
    'live.com',
  ]);
  if (generic.has(domain.toLowerCase())) return '';
  return domain;
}

export async function sendLeadNotification(lead: LeadEmailInput): Promise<void> {
  const apiKey = requireEnv('RESEND_API_KEY');
  const from = optionalEnv('RESEND_FROM_EMAIL', 'onboarding@resend.dev');
  // LEAD_NOTIFICATION_EMAIL accepts a single address or a comma-separated list.
  const toRaw = requireEnv('LEAD_NOTIFICATION_EMAIL');
  const to = toRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const company = deriveCompany(lead.email);
  const subject = company
    ? `New lead: ${lead.name} — ${company}`
    : `New lead: ${lead.name}`;

  const text = [
    `New lead from the Amplo Consulting website:`,
    ``,
    `Name:     ${lead.name}`,
    `Email:    ${lead.email}`,
    `Mobile:   ${lead.mobile || '—'}`,
    `Received: ${lead.timestamp}`,
    ``,
    `Message:`,
    lead.message,
    ``,
    `View all leads: ${lead.adminUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0b1936; background: #ede5d2;">
      <p style="font-size: 11px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #c9a961; margin: 0 0 8px;">New Lead</p>
      <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 500; margin: 0 0 24px; color: #0b1936;">${escapeHtml(lead.name)}${company ? ` <span style="color:#6a7390;">— ${escapeHtml(company)}</span>` : ''}</h1>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding:6px 0; color:#6a7390; width: 90px;">Email</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(lead.email)}" style="color:#0b1936;">${escapeHtml(lead.email)}</a></td></tr>
        ${lead.mobile ? `<tr><td style="padding:6px 0; color:#6a7390;">Mobile</td><td style="padding:6px 0;"><a href="tel:${escapeHtml(lead.mobile)}" style="color:#0b1936;">${escapeHtml(lead.mobile)}</a></td></tr>` : ''}
        <tr><td style="padding:6px 0; color:#6a7390;">Received</td><td style="padding:6px 0;">${escapeHtml(lead.timestamp)}</td></tr>
      </table>
      <div style="margin-top: 20px; padding: 16px; background: #ffffff; border-left: 3px solid #c9a961; white-space: pre-wrap; font-size: 14px; line-height: 1.5;">${escapeHtml(lead.message)}</div>
      <p style="margin-top: 32px; font-size: 12px;"><a href="${escapeHtml(lead.adminUrl)}" style="background:#c9a961; color:#0b1936; padding:10px 16px; text-decoration:none; font-weight:600; letter-spacing:0.15em; text-transform:uppercase; font-size:11px;">View in admin</a></p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: lead.email,
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Resend send failed: ${res.status} ${text}`);
  }
}
