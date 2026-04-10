import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/guards';
import { applySessionCookie } from '@/lib/auth/session';
import { updateAuthUserProfile } from '@/lib/auth/users';

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();

    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, message: 'Nome deve ter pelo menos 2 caracteres' },
        { status: 400 }
      );
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Email invalido' },
        { status: 400 }
      );
    }

    const updated = await updateAuthUserProfile({
      userId: auth.session.user.id,
      name,
      email,
    });

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Usuario nao encontrado' }, { status: 404 });
    }

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: updated.id,
          email: updated.email,
          role: updated.role,
          status: updated.status,
          name: updated.name,
        },
      },
    });

    await applySessionCookie(response, {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      status: updated.status,
      name: updated.name,
    });

    return response;
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ success: false, message: 'Email ja esta em uso' }, { status: 409 });
    }
    console.error('[AUTH_PROFILE_UPDATE_FAILED]', error);
    return NextResponse.json(
      { success: false, message: 'Falha temporaria ao atualizar perfil' },
      { status: 500 }
    );
  }
}
