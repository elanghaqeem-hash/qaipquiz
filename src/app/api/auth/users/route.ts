import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin(req: NextRequest) {
  const token = req.cookies.get('tqa_auth_token')?.value || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const payload = await authService.verifyToken(token);
  return payload?.role === 'SUPER_ADMIN' ? payload : null;
}

export async function GET(req: NextRequest) {
  try {
    if (!(await requireSuperAdmin(req))) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: await authService.getAllUsers() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await requireSuperAdmin(req))) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
    }
    const body = await req.json();
    const newUser = await authService.createUser(body);
    return NextResponse.json({ success: true, data: newUser }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}
