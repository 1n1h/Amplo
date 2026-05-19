// Verify a Google Identity Services ID token (JWT) against Google's public keys.
// Avoids the google-auth-library dependency by doing the JWKS dance manually.
import crypto from 'node:crypto';
import { requireEnv } from './env';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ALLOWED_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

interface Jwk {
  kid: string;
  kty: 'RSA';
  n: string;
  e: string;
  alg?: string;
  use?: string;
  [key: string]: unknown;
}

interface JwksCacheEntry {
  keys: Jwk[];
  expiresAt: number;
}

let jwksCache: JwksCacheEntry | null = null;

async function getJwks(): Promise<Jwk[]> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) {
    return jwksCache.keys;
  }
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`Google JWKS fetch failed: ${res.status}`);
  const json = (await res.json()) as { keys: Jwk[] };
  // Cache for 1 hour. Google rotates keys but slowly; this is well within
  // the recommended bounds.
  jwksCache = { keys: json.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return json.keys;
}

function b64urlDecode(str: string): Buffer {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export interface VerifiedGoogleIdentity {
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
  sub: string;
}

export async function verifyGoogleIdToken(token: string): Promise<VerifiedGoogleIdentity> {
  const expectedAudience = requireEnv('PUBLIC_GOOGLE_CLIENT_ID');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');

  const header = JSON.parse(b64urlDecode(parts[0]!).toString('utf8')) as {
    alg: string;
    kid: string;
    typ?: string;
  };
  if (header.alg !== 'RS256') throw new Error(`Unexpected alg: ${header.alg}`);

  const jwks = await getJwks();
  const key = jwks.find((k) => k.kid === header.kid);
  if (!key) throw new Error('No matching Google signing key');

  const publicKey = crypto.createPublicKey({ key, format: 'jwk' });
  const signedInput = Buffer.from(`${parts[0]}.${parts[1]}`);
  const signature = b64urlDecode(parts[2]!);

  const valid = crypto.verify('RSA-SHA256', signedInput, publicKey, signature);
  if (!valid) throw new Error('Invalid token signature');

  const payload = JSON.parse(b64urlDecode(parts[1]!).toString('utf8')) as {
    iss: string;
    aud: string;
    exp: number;
    iat: number;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    sub: string;
  };

  if (!ALLOWED_ISSUERS.has(payload.iss)) throw new Error(`Untrusted issuer: ${payload.iss}`);
  if (payload.aud !== expectedAudience) throw new Error('Audience mismatch');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error('Token expired');
  // Reject tokens claiming to have been issued more than 1h in the past or in the future.
  if (payload.iat > now + 60) throw new Error('Token issued in the future');

  if (!payload.email) throw new Error('Token missing email');
  if (!payload.email_verified) throw new Error('Email not verified by Google');

  return {
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: payload.name,
    picture: payload.picture,
    sub: payload.sub,
  };
}
