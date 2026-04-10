import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { setGoogleStateCookie } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ success: false, message: 'Google OAuth not configured' }, { status: 503 });
  }

  const origin = request.nextUrl.origin;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;
  const state = randomUUID();

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  const response = NextResponse.redirect(authUrl);
  setGoogleStateCookie(response, state);
  return response;
}
