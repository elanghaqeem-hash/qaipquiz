import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tqa_auth_token')?.value || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ success: false, authenticated: false }, { status: 401 });
  }

  const payload = await authService.verifyToken(token);
  if (!payload) {
    const response = NextResponse.json({ success: false, authenticated: false }, { status: 401 });
    response.cookies.set('tqa_auth_token', '', { path: '/', maxAge: 0 });
    return response;
  }

  return NextResponse.json({ success: true, authenticated: true, user: payload });
}
