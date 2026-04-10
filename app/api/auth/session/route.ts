import { NextRequest, NextResponse } from 'next/server';
import { readSessionFromRequest } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const session = await readSessionFromRequest(request);
  return NextResponse.json({
    success: true,
    authenticated: Boolean(session?.user?.id),
    data: session ? { user: session.user, exp: session.exp } : null,
  });
}
