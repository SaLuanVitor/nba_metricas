import { NextResponse } from 'next/server';
import { applySessionCookie } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/password';
import { ensureAuthBootstrap, findAuthUserByEmail, markLastLogin } from '@/lib/auth/users';

export async function POST(request: Request) {
  try {
    await ensureAuthBootstrap();

    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'email and password are required' }, { status: 400 });
    }

    const user = await findAuthUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ success: false, message: 'Credenciais invalidas' }, { status: 401 });
    }

    if (user.status === 'pending') {
      return NextResponse.json({ success: false, status: 'pending', message: 'Conta em analise pelo master.' }, { status: 403 });
    }

    if (user.status === 'rejected') {
      return NextResponse.json({ success: false, status: 'rejected', message: 'Acesso nao liberado.' }, { status: 403 });
    }

    await markLastLogin(user.id);

    const response = NextResponse.json({
      success: true,
      status: user.status,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          name: user.name,
        },
      },
    });

    await applySessionCookie(response, {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      name: user.name,
    });

    return response;
  } catch (error) {
    console.error('[AUTH_LOGIN_FAILED]', error);
    return NextResponse.json({ success: false, message: 'Falha temporaria no login' }, { status: 500 });
  }
}
