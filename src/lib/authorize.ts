import { NextRequest } from 'next/server';
import { authService, AuthPayload } from './auth';
import { UserRole } from '@/types/quiz';

export async function getAuthenticatedUser(req: NextRequest): Promise<AuthPayload | null> {
  const token = req.cookies.get('tqa_auth_token')?.value || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  return authService.verifyToken(token);
}

export async function requireRole(req: NextRequest, roles: UserRole[]): Promise<AuthPayload | null> {
  const user = await getAuthenticatedUser(req);
  return user && roles.includes(user.role) ? user : null;
}
