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

// ---- Booking confirmation -----------------------------------------------

export interface BookingEmailInput {
  name: string;
  email: string;
  mobile: string;
  message: string;
  startISO: string;
  endISO: string;
  eventId: string;
}

// Format e.g. "20260522T130000Z" for an ICS DTSTART/DTEND.
function toICSDateUTC(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Escape commas, semicolons, backslashes, and newlines per RFC 5545.
function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function buildIcs(input: BookingEmailInput): string {
  const dtstamp = toICSDateUTC(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Amplo Consulting//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.eventId}@amploconsulting.com`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toICSDateUTC(input.startISO)}`,
    `DTEND:${toICSDateUTC(input.endISO)}`,
    `SUMMARY:${escapeIcs(`Amplo Consulting — Intro Call (${input.name})`)}`,
    `DESCRIPTION:${escapeIcs(
      `30-minute intro call with Amplo Consulting.\n\nQuestions before the meeting? Email Roger@amploconsulting.com.`
    )}`,
    `ORGANIZER;CN=Amplo Consulting:mailto:Roger@amploconsulting.com`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Amplo Consulting call in 30 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // RFC 5545 wants CRLF line endings.
  return lines.join('\r\n');
}

function fmtMeetingTimeET(startISO: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(new Date(startISO));
}

export async function sendBookingEmails(input: BookingEmailInput): Promise<void> {
  const apiKey = requireEnv('RESEND_API_KEY');
  const from = optionalEnv('RESEND_FROM_EMAIL', 'onboarding@resend.dev');
  const internalToRaw = requireEnv('LEAD_NOTIFICATION_EMAIL');
  const internalTo = internalToRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const when = fmtMeetingTimeET(input.startISO);
  const ics = buildIcs(input);
  const icsBase64 = Buffer.from(ics, 'utf8').toString('base64');

  // --- Email 1: confirmation to the visitor (with .ics attached) ---
  const visitorText = [
    `Hi ${input.name},`,
    ``,
    `Thanks for booking with Amplo Consulting. Your 30-minute intro call is confirmed for:`,
    ``,
    `  ${when}`,
    ``,
    `The attached calendar invite (.ics) will add this meeting to your calendar.`,
    `If anything changes, just reply to this email or write to Roger@amploconsulting.com.`,
    ``,
    `— The Amplo team`,
  ].join('\n');

  const visitorHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0b1936; background: #ede5d2;">
      <p style="font-size: 11px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #c9a961; margin: 0 0 8px;">Booking Confirmed</p>
      <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 500; margin: 0 0 16px; color: #0b1936;">You're on the calendar.</h1>
      <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.55;">Hi ${escapeHtml(input.name)} — thanks for booking with Amplo Consulting. Your 30-minute intro call is confirmed for:</p>
      <div style="background: #ffffff; border-left: 3px solid #c9a961; padding: 16px 18px; margin-bottom: 24px; font-size: 16px;">${escapeHtml(when)}</div>
      <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.55;">The attached calendar invite (.ics) will add this meeting to your calendar in one click — works with Google Calendar, Apple Calendar, and Outlook.</p>
      <p style="margin: 0; font-size: 14px; line-height: 1.55;">If anything changes, just reply to this email or write to <a href="mailto:Roger@amploconsulting.com" style="color:#0b1936;">Roger@amploconsulting.com</a>.</p>
      <p style="margin: 32px 0 0; font-size: 13px; color: #6a7390;">— The Amplo team</p>
    </div>
  `;

  const visitorRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: `Your Amplo Consulting call — ${when}`,
      text: visitorText,
      html: visitorHtml,
      attachments: [
        {
          filename: 'amplo-consulting-call.ics',
          content: icsBase64,
          contentType: 'text/calendar; method=PUBLISH; charset=UTF-8',
        },
      ],
    }),
  });
  if (!visitorRes.ok) {
    const body = await visitorRes.text().catch(() => '');
    throw new Error(`Resend visitor send failed: ${visitorRes.status} ${body}`);
  }

  // --- Email 2: internal heads-up to Roger / Katherine ---
  const internalText = [
    `New booking from the Amplo Consulting website:`,
    ``,
    `When:    ${when}`,
    `Name:    ${input.name}`,
    `Email:   ${input.email}`,
    `Mobile:  ${input.mobile || '—'}`,
    ``,
    `Message:`,
    input.message || '—',
    ``,
    `(The event is already on the shared Amplo calendar.)`,
  ].join('\n');

  const internalHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0b1936; background: #ede5d2;">
      <p style="font-size: 11px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #c9a961; margin: 0 0 8px;">New Booking</p>
      <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 500; margin: 0 0 8px; color: #0b1936;">${escapeHtml(input.name)}</h1>
      <p style="margin: 0 0 20px; font-size: 15px; color:#6a7390;">${escapeHtml(when)}</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding:6px 0; color:#6a7390; width: 90px;">Email</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(input.email)}" style="color:#0b1936;">${escapeHtml(input.email)}</a></td></tr>
        ${input.mobile ? `<tr><td style="padding:6px 0; color:#6a7390;">Mobile</td><td style="padding:6px 0;"><a href="tel:${escapeHtml(input.mobile)}" style="color:#0b1936;">${escapeHtml(input.mobile)}</a></td></tr>` : ''}
      </table>
      ${input.message ? `<div style="margin-top: 20px; padding: 16px; background: #ffffff; border-left: 3px solid #c9a961; white-space: pre-wrap; font-size: 14px; line-height: 1.5;">${escapeHtml(input.message)}</div>` : ''}
      <p style="margin: 24px 0 0; font-size: 12px; color:#6a7390;">The event is already on the shared Amplo calendar.</p>
    </div>
  `;

  const internalRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: internalTo,
      reply_to: input.email,
      subject: `New booking: ${input.name} — ${when}`,
      text: internalText,
      html: internalHtml,
    }),
  });
  if (!internalRes.ok) {
    const body = await internalRes.text().catch(() => '');
    throw new Error(`Resend internal send failed: ${internalRes.status} ${body}`);
  }
}
