import { NextResponse } from 'next/server';
import { ensureAuthBootstrap, createPendingCredentialsUser, findAuthUserByEmail } from '@/lib/auth/users';

export async function POST(request: Request) {
  try {
    await ensureAuthBootstrap();

    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, message: 'name, email and password are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ success: false, message: 'password must have at least 8 chars' }, { status: 400 });
    }

    const exists = await findAuthUserByEmail(email);
    if (exists) {
      return NextResponse.json({
        success: true,
        status: exists.status,
        message: exists.status === 'approved' ? 'Conta ja aprovada, faca login.' : 'Conta ja cadastrada e em analise.',
      });
    }

    await createPendingCredentialsUser({ name, email, password });

    return NextResponse.json({
      success: true,
      status: 'pending',
      message: 'Cadastro realizado. Sua conta esta em analise pelo master.',
    });
  } catch (error) {
    console.error('[AUTH_REGISTER_FAILED]', error);
    return NextResponse.json({ success: false, message: 'Falha temporaria no cadastro' }, { status: 500 });
  }
}
