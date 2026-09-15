import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; firstAttemptAt: number }>();

function getClientKey(req: NextRequest, username: string): string {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwardedFor || req.headers.get('x-real-ip') || 'unknown';
  return `${ip}:${username.trim().toLowerCase()}`;
}

function getAttemptState(key: string) {
  const now = Date.now();
  const state = attempts.get(key);
  if (!state || now - state.firstAttemptAt >= WINDOW_MS) {
    const fresh = { count: 0, firstAttemptAt: now };
    attempts.set(key, fresh);
    return fresh;
  }
  return state;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const requestedRole = body.requestedRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'TRAINER';

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username dan password wajib diisi.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const clientKey = getClientKey(req, username);
    const state = getAttemptState(clientKey);
    if (state.count >= MAX_FAILED_ATTEMPTS) {
      const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (Date.now() - state.firstAttemptAt)) / 1000));
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan login. Silakan coba lagi beberapa saat.' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': retryAfterSeconds.toString(),
          },
        }
      );
    }

    const authResult = authService.authenticate(username, password);
    if (!authResult || (requestedRole === 'SUPER_ADMIN' && authResult.user.role !== 'SUPER_ADMIN')) {
      state.count += 1;
      attempts.set(clientKey, state);
      return NextResponse.json(
        { success: false, error: 'Username, password, atau hak akses tidak sesuai.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    attempts.delete(clientKey);

    const response = NextResponse.json(
      { success: true, data: { user: authResult.user } },
      { headers: { 'Cache-Control': 'no-store' } }
    );

    response.cookies.set('tqa_auth_token', authResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Konfigurasi autentikasi belum siap atau terjadi gangguan server.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
