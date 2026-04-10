import { NextRequest, NextResponse } from 'next/server';
import { requireMasterUser } from '@/lib/auth/guards';
import { ensureAuthBootstrap, setUserApprovalStatus } from '@/lib/auth/users';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  await ensureAuthBootstrap();
  const guard = await requireMasterUser(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = body?.reason ? String(body.reason) : undefined;

  const updated = await setUserApprovalStatus({
    userId: id,
    actorId: guard.session.user.id,
    action: 'approve',
    reason,
  });

  if (!updated) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: updated });
}

