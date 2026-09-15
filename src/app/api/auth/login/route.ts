import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '');

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const authResult = await authService.authenticate(username, password);
    if (!authResult) {
      return NextResponse.json({ success: false, error: 'Username atau password salah' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, data: authResult });
    response.cookies.set('tqa_auth_token', authResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
      sameSite: 'lax',
    });
    return response;
  } catch (error: any) {
    const message = error?.message || 'Login gagal';
    const misconfigured = message.includes('AUTH_');
    return NextResponse.json(
      { success: false, error: misconfigured ? 'Konfigurasi autentikasi production belum lengkap' : message },
      { status: misconfigured ? 503 : 500 }
    );
  }
}
