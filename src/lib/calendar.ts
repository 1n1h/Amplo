// Minimal Google Calendar v3 client using fetch + Node crypto.
// Mirrors the pattern in sheets.ts so we don't pull in the heavyweight
// `googleapis` package.
import crypto from 'node:crypto';
import { getServiceAccount, requireEnv } from './env';

// Need the full calendar scope: freeBusy.query is not covered by calendar.events.
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

let cachedToken: { value: string; expiresAt: number } | null = null;

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const { email, privateKey } = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = b64url(signer.sign(privateKey));
  const assertion = `${signingInput}.${signature}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Calendar auth failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.value;
}

export interface BusyBlock {
  startMs: number;
  endMs: number;
}

export async function queryFreeBusy(
  startISO: string,
  endISO: string
): Promise<BusyBlock[]> {
  const token = await getAccessToken();
  const calendarId = requireEnv('GOOGLE_CALENDAR_ID');

  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: startISO,
      timeMax: endISO,
      items: [{ id: calendarId }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Calendar freeBusy failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }>;
  };
  const entry = json.calendars?.[calendarId];
  if (entry?.errors && entry.errors.length > 0) {
    throw new Error(`Calendar freeBusy error: ${JSON.stringify(entry.errors)}`);
  }
  const busy = entry?.busy ?? [];
  return busy.map((b) => ({
    startMs: new Date(b.start).getTime(),
    endMs: new Date(b.end).getTime(),
  }));
}

export interface CreateBookingEventInput {
  startISO: string;
  endISO: string;
  name: string;
  email: string;
  mobile: string;
  industry: string;
  notes: string;
}

export interface CreatedBookingEvent {
  id: string;
  htmlLink?: string;
}

export async function createBookingEvent(
  input: CreateBookingEventInput
): Promise<CreatedBookingEvent> {
  const token = await getAccessToken();
  const calendarId = requireEnv('GOOGLE_CALENDAR_ID');

  const summary = `Amplo Consult: ${input.name}`;
  const descriptionLines = [
    `Booked from amploconsulting.com`,
    ``,
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Mobile: ${input.mobile || '(not provided)'}`,
    `Industry: ${input.industry || '(not provided)'}`,
  ];
  if (input.notes && input.notes.trim()) {
    descriptionLines.push('', 'Notes:', input.notes);
  }
  const description = descriptionLines.join('\n');

  // We deliberately do NOT add the visitor as an attendee here — personal
  // Google accounts (no Workspace + DWD) can't invite attendees via service
  // account. The visitor instead gets an .ics invite via Resend after this
  // event is created. Roger + Katherine see the event natively because the
  // calendar is shared with them.
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calendarId
  )}/events`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: input.startISO, timeZone: 'America/New_York' },
      end: { dateTime: input.endISO, timeZone: 'America/New_York' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 * 24 },
          { method: 'popup', minutes: 30 },
        ],
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Calendar event create failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { id: string; htmlLink?: string };
  return { id: json.id, htmlLink: json.htmlLink };
}
