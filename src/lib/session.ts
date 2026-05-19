// HMAC-signed session cookie for the admin area.
// TODO: This is "good enough" for a low-volume consulting site. Long-term, replace
// with a real auth provider (Clerk, Auth.js, or an invite-based system).
import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';
import { requireEnv } from './env';

const COOKIE_NAME = 'amplo_admin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sign(payload: string): string {
  const secret = requireEnv('SESSION_SECRET');
  return b64url(crypto.createHmac('sha256', secret).update(payload).digest());
}

function timingSafeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function issueToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `admin:${expiresAt}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const lastDot = token.lastIndexOf('.');
  if (lastDot <= 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!payload.startsWith('admin:')) return false;
  if (!timingSafeEq(sign(payload), sig)) return false;
  const expiresAt = Number(payload.slice('admin:'.length));
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return true;
}

export function setSessionCookie(cookies: AstroCookies, secure: boolean): void {
  cookies.set(COOKIE_NAME, issueToken(), {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(cookies: AstroCookies, secure: boolean): void {
  cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    path: '/',
    maxAge: 0,
  });
}

export function isAuthenticated(cookies: AstroCookies): boolean {
  const c = cookies.get(COOKIE_NAME);
  return verifyToken(c?.value);
}

export { COOKIE_NAME };
