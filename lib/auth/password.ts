import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const digest = scryptSync(password, salt, KEYLEN).toString('hex');
  return `scrypt:${salt}:${digest}`;
}

export function verifyPassword(password: string, encoded: string | null | undefined): boolean {
  if (!encoded) return false;
  const [alg, salt, digest] = encoded.split(':');
  if (alg !== 'scrypt' || !salt || !digest) return false;
  const candidate = scryptSync(password, salt, KEYLEN);
  const target = Buffer.from(digest, 'hex');
  if (candidate.length !== target.length) return false;
  return timingSafeEqual(candidate, target);
}
