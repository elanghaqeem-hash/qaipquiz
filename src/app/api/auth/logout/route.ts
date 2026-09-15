import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set('tqa_auth_token', '', { path: '/', maxAge: 0 });
  response.cookies.set('tqa_auth_role', '', { path: '/', maxAge: 0 });
  return response;
}
