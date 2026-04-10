import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, AUTH_SESSION_MAX_AGE_SECONDS, GOOGLE_STATE_COOKIE } from '@/lib/auth/constants';
import { createSessionToken, verifySessionToken } from '@/lib/auth/token';
import type { AuthSessionPayload } from '@/lib/auth/types';

export async function readSessionFromRequest(request: Request | NextRequest): Promise<AuthSessionPayload | null> {
  const cookieHeader = request.headers.get('cookie') || '';
  const token = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split('=')[1];
  return verifySessionToken(token);
}

export async function readSessionFromServerCookies(): Promise<AuthSessionPayload | null> {
  const c = await cookies();
  const token = c.get(AUTH_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function applySessionCookie(response: NextResponse, user: AuthSessionPayload['user']): Promise<void> {
  const token = await createSessionToken(user);
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
}

export function setGoogleStateCookie(response: NextResponse, state: string): void {
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10,
    path: '/',
  });
}

export function clearGoogleStateCookie(response: NextResponse): void {
  response.cookies.set(GOOGLE_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
}
