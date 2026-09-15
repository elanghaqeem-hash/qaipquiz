import { NextRequest, NextResponse } from 'next/server';
import { authService, AuthTokenPayload } from '@/lib/auth';
import { UserRole } from '@/types/quiz';

function extractToken(req: NextRequest): string | undefined {
  const cookieToken = req.cookies.get('tqa_auth_token')?.value;
  if (cookieToken) return cookieToken;

  const authorization = req.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return undefined;
}

function isSameOriginMutation(req: NextRequest): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

  // Explicit bearer-token clients are not browser-cookie CSRF targets.
  if (req.headers.get('authorization')?.startsWith('Bearer ')) return true;

  const origin = req.headers.get('origin');
  if (!origin) return true;

  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const requestHost = forwardedHost || req.headers.get('host');
  if (!requestHost) return false;

  try {
    return new URL(origin).host.toLowerCase() === requestHost.toLowerCase();
  } catch {
    return false;
  }
}

export function getAuthenticatedUser(req: NextRequest): AuthTokenPayload | null {
  const token = extractToken(req);
  if (!token) return null;
  return authService.verifyToken(token);
}

export function authorizeRequest(
  req: NextRequest,
  allowedRoles: UserRole[] = ['SUPER_ADMIN', 'TRAINER']
): { ok: true; user: AuthTokenPayload } | { ok: false; response: NextResponse } {
  if (!isSameOriginMutation(req)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Origin permintaan tidak diizinkan.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      ),
    };
  }

  const user = getAuthenticatedUser(req);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Autentikasi diperlukan.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      ),
    };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Anda tidak memiliki hak akses untuk aksi ini.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      ),
    };
  }

  return { ok: true, user };
}
