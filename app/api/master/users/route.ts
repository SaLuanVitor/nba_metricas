import { NextRequest, NextResponse } from 'next/server';
import { requireMasterUser } from '@/lib/auth/guards';
import { ensureAuthBootstrap, listUsersByStatus } from '@/lib/auth/users';
import type { AuthStatus } from '@/lib/auth/types';

export async function GET(request: NextRequest) {
  await ensureAuthBootstrap();
  const guard = await requireMasterUser(request);
  if (!guard.ok) return guard.response;

  const statusParam = String(request.nextUrl.searchParams.get('status') || 'pending') as AuthStatus;
  const status: AuthStatus = ['pending', 'approved', 'rejected'].includes(statusParam)
    ? statusParam
    : 'pending';
  const users = await listUsersByStatus(status);

  return NextResponse.json({
    success: true,
    data: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      provider: user.provider,
      createdAt: user.createdAt,
      approvedAt: user.approvedAt,
      approvedBy: user.approvedBy,
    })),
  });
}
