import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/token';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/auth/session',
  '/api/auth/logout',
  '/_next',
  '/favicon.ico',
  '/icon.svg',
  '/icon-light-32x32.png',
  '/icon-dark-32x32.png',
  '/apple-icon.png',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function extractToken(request: NextRequest): string | null {
  return request.cookies.get('nba_auth_session')?.value || null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const token = extractToken(request);
  const session = await verifySessionToken(token);

  const isApi = pathname.startsWith('/api');

  if (!session?.user?.id) {
    if (isApi) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/master') || pathname.startsWith('/api/master')) {
    if (session.user.role !== 'master') {
      if (isApi) return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
