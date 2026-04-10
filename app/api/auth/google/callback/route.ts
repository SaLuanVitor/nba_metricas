import { NextRequest, NextResponse } from 'next/server';
import { applySessionCookie, clearGoogleStateCookie } from '@/lib/auth/session';
import { createOrUpdateGooglePendingUser, ensureAuthBootstrap } from '@/lib/auth/users';

type GoogleTokenResponse = {
  access_token?: string;
};

type GoogleUserInfo = {
  email?: string;
  name?: string;
};

export async function GET(request: NextRequest) {
  try {
    await ensureAuthBootstrap();

    const url = request.nextUrl;
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const expectedState = request.cookies.get('nba_google_state')?.value;

    if (!code || !state || !expectedState || state !== expectedState) {
      const bad = NextResponse.redirect(new URL('/login?message=Falha+na+autenticacao+Google', request.url));
      clearGoogleStateCookie(bad);
      return bad;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      const bad = NextResponse.redirect(new URL('/login?message=Google+OAuth+nao+configurado', request.url));
      clearGoogleStateCookie(bad);
      return bad;
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${url.origin}/api/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
    const accessToken = tokenJson.access_token;
    if (!accessToken) {
      const bad = NextResponse.redirect(new URL('/login?message=Falha+ao+obter+token+Google', request.url));
      clearGoogleStateCookie(bad);
      return bad;
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = (await profileRes.json()) as GoogleUserInfo;

    const email = String(profile.email || '').trim().toLowerCase();
    const name = String(profile.name || 'Google User').trim();
    if (!email) {
      const bad = NextResponse.redirect(new URL('/login?message=Google+nao+retornou+email', request.url));
      clearGoogleStateCookie(bad);
      return bad;
    }

    const user = await createOrUpdateGooglePendingUser({ email, name });
    const redirectLogin = (message: string) => {
      const response = NextResponse.redirect(new URL(`/login?message=${encodeURIComponent(message)}`, request.url));
      clearGoogleStateCookie(response);
      return response;
    };

    if (user.status === 'pending') return redirectLogin('Conta em analise pelo master.');
    if (user.status === 'rejected') return redirectLogin('Acesso nao liberado.');

    const response = NextResponse.redirect(new URL('/', request.url));
    await applySessionCookie(response, {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      name: user.name,
    });
    clearGoogleStateCookie(response);
    return response;
  } catch (error) {
    console.error('[AUTH_GOOGLE_CALLBACK_FAILED]', error);
    return NextResponse.redirect(new URL('/login?message=Falha+temporaria+no+Google+login', request.url));
  }
}
