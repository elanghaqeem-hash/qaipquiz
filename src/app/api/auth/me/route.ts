import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tqa_auth_token')?.value || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ success: false, authenticated: false }, { status: 401 });
  }

  const payload = authService.verifyToken(token);
  if (!payload) {
    return NextResponse.json({ success: false, authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    user: payload
  });
}
