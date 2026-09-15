import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const users = authService.getAllUsers();
    return NextResponse.json({ success: true, data: users });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newUser = authService.createUser(body);
    return NextResponse.json({ success: true, data: newUser });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}
