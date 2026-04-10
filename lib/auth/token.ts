import { AUTH_SESSION_MAX_AGE_SECONDS, getAuthSecret } from '@/lib/auth/constants';
import type { AuthSessionPayload } from '@/lib/auth/types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64url'));
  }
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSign(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getAuthSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toBase64Url(new Uint8Array(sig));
}

export async function createSessionToken(user: AuthSessionPayload['user']): Promise<string> {
  const payload: AuthSessionPayload = {
    user,
    exp: Math.floor(Date.now() / 1000) + AUTH_SESSION_MAX_AGE_SECONDS,
  };
  const payloadStr = JSON.stringify(payload);
  const payloadPart = toBase64Url(encoder.encode(payloadStr));
  const sigPart = await hmacSign(payloadPart);
  return `${payloadPart}.${sigPart}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<AuthSessionPayload | null> {
  if (!token) return null;
  const [payloadPart, sigPart] = token.split('.');
  if (!payloadPart || !sigPart) return null;
  const expectedSig = await hmacSign(payloadPart);
  if (expectedSig !== sigPart) return null;

  try {
    const payloadRaw = decoder.decode(fromBase64Url(payloadPart));
    const payload = JSON.parse(payloadRaw) as AuthSessionPayload;
    if (!payload?.user?.id || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
