// Minimal Google Sheets v4 client using fetch + Node crypto.
// Avoids the heavyweight `googleapis` package; keeps the Function bundle small.
import crypto from 'node:crypto';
import { getServiceAccount, requireEnv } from './env';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEET_NAME = 'Leads';

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
    throw new Error(`Sheets auth failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.value;
}

function sheetUrl(path: string): string {
  const id = requireEnv('GOOGLE_SHEET_ID');
  return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}${path}`;
}

export interface LeadRow {
  rowNumber: number; // 1-indexed sheet row (row 2 is the first data row, row 1 is header)
  timestamp: string;
  name: string;
  email: string;
  mobile: string;
  message: string;
  status: string;
  notes: string;
  lastUpdated: string;
}

const STATUS_VALUES = ['New', 'Contacted', 'Qualified', 'Closed-Won', 'Closed-Lost'] as const;
export type LeadStatus = (typeof STATUS_VALUES)[number];
export const VALID_STATUSES: readonly LeadStatus[] = STATUS_VALUES;

export interface AppendLeadInput {
  name: string;
  email: string;
  mobile: string;
  message: string;
}

export async function appendLead(input: AppendLeadInput): Promise<{ timestamp: string }> {
  const token = await getAccessToken();
  const timestamp = new Date().toISOString();
  const row = [
    timestamp,
    input.name,
    input.email,
    input.mobile,
    input.message,
    'New',
    '',
    timestamp,
  ];

  const res = await fetch(
    sheetUrl(
      `/values/${encodeURIComponent(`${SHEET_NAME}!A:H`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
    ),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sheets append failed: ${res.status} ${text}`);
  }
  return { timestamp };
}

export async function getLeads(): Promise<LeadRow[]> {
  const token = await getAccessToken();
  const res = await fetch(
    sheetUrl(`/values/${encodeURIComponent(`${SHEET_NAME}!A2:H`)}?majorDimension=ROWS`),
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sheets read failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { values?: string[][] };
  const rows = json.values ?? [];
  return rows.map((r, i) => ({
    rowNumber: i + 2,
    timestamp: r[0] ?? '',
    name: r[1] ?? '',
    email: r[2] ?? '',
    mobile: r[3] ?? '',
    message: r[4] ?? '',
    status: r[5] ?? 'New',
    notes: r[6] ?? '',
    lastUpdated: r[7] ?? '',
  }));
}

export async function updateLead(
  rowNumber: number,
  updates: { status?: string; notes?: string }
): Promise<{ lastUpdated: string }> {
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error('Invalid row number');
  }
  if (updates.status && !VALID_STATUSES.includes(updates.status as LeadStatus)) {
    throw new Error('Invalid status');
  }

  // Read current row so we can write back fields we're not changing.
  const token = await getAccessToken();
  const range = `${SHEET_NAME}!A${rowNumber}:H${rowNumber}`;
  const readRes = await fetch(
    sheetUrl(`/values/${encodeURIComponent(range)}`),
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!readRes.ok) {
    throw new Error(`Sheets read failed: ${readRes.status}`);
  }
  const readJson = (await readRes.json()) as { values?: string[][] };
  const current = readJson.values?.[0] ?? [];
  if (current.length === 0) throw new Error(`Row ${rowNumber} not found`);

  const lastUpdated = new Date().toISOString();
  const updated = [
    current[0] ?? '',
    current[1] ?? '',
    current[2] ?? '',
    current[3] ?? '',
    current[4] ?? '',
    updates.status ?? current[5] ?? 'New',
    updates.notes ?? current[6] ?? '',
    lastUpdated,
  ];

  const writeRes = await fetch(
    sheetUrl(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`),
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [updated] }),
    }
  );
  if (!writeRes.ok) {
    const text = await writeRes.text().catch(() => '');
    throw new Error(`Sheets update failed: ${writeRes.status} ${text}`);
  }
  return { lastUpdated };
}
