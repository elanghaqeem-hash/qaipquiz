import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { requireRole } from '@/lib/authorize';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!(await requireRole(req, ['SUPER_ADMIN']))) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
    }
    return NextResponse.json(
      { success: true, data: await authService.getAllUsers() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await requireRole(req, ['SUPER_ADMIN']))) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
    }
    const body = await req.json();
    const newUser = await authService.createUser(body);
    return NextResponse.json(
      { success: true, data: newUser },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    const message = e?.message || 'Gagal membuat user';
    const badRequest = /wajib|minimal|tidak valid|sudah digunakan/i.test(message);
    return NextResponse.json(
      { success: false, error: message },
      { status: badRequest ? 400 : 500 }
    );
  }
}
