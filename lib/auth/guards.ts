import { NextRequest, NextResponse } from 'next/server';
import { readSessionFromRequest } from '@/lib/auth/session';

export async function requireAuthenticatedUser(request: NextRequest) {
  const session = await readSessionFromRequest(request);
  if (!session?.user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true as const, session };
}

export async function requireMasterUser(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;
  if (auth.session.user.role !== 'master') {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 }),
    };
  }
  return { ok: true as const, session: auth.session };
}
