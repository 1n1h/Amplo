// Centralized env var access with helpful errors when something's missing.
// Read on every call (not cached) so dev hot-reload picks up .env edits.

function read(name: string): string | undefined {
  // In Astro + Vite, import.meta.env exposes user vars and process.env mirrors them on server.
  // We prefer process.env so tests / scripts that don't go through Vite still work.
  const v = process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
  return v && v.length > 0 ? v : undefined;
}

export function requireEnv(name: string): string {
  const v = read(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function optionalEnv(name: string, fallback = ''): string {
  return read(name) ?? fallback;
}

export function getAllowedAdminEmails(): string[] {
  const raw = requireEnv('ADMIN_ALLOWED_EMAILS');
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function getServiceAccount(): { email: string; privateKey: string } {
  const email = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const raw = requireEnv('GOOGLE_SERVICE_ACCOUNT_KEY');
  // When pasted into Vercel env vars, real newlines are usually replaced by the literal \n.
  // Normalize both forms.
  const privateKey = raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
  return { email, privateKey };
}
