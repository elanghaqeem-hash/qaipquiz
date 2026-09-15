import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const authResult = authService.authenticate(username, password);
    if (!authResult) {
      return NextResponse.json({ success: false, error: 'Username atau password salah' }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      data: authResult
    });

    // Set cookie for HTTP session
    response.cookies.set('tqa_auth_token', authResult.token, {
      httpOnly: false, // Accessible to client-side JS for role checks
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
      sameSite: 'lax'
    });
    response.cookies.set('tqa_auth_role', authResult.user.role, {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24,
      sameSite: 'lax'
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
