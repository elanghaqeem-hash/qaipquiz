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

export function getAuthenticatedUser(req: NextRequest): AuthTokenPayload | null {
  const token = extractToken(req);
  if (!token) return null;
  return authService.verifyToken(token);
}

export function authorizeRequest(
  req: NextRequest,
  allowedRoles: UserRole[] = ['SUPER_ADMIN', 'TRAINER']
): { ok: true; user: AuthTokenPayload } | { ok: false; response: NextResponse } {
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
