import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json(
      { success: false, authenticated: false },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    { success: true, authenticated: true, user },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
