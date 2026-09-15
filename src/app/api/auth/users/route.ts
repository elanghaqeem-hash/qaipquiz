import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { authorizeRequest } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const auth = authorizeRequest(req, ['SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const users = authService.getAllUsers();
    return NextResponse.json(
      { success: true, data: users },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('List users error:', error);
    return NextResponse.json({ success: false, error: 'Gagal memuat pengguna.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = authorizeRequest(req, ['SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const newUser = authService.createUser(body);
    return NextResponse.json(
      { success: true, data: newUser },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Data pengguna tidak valid.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
