import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authService } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('tqa_auth_token')?.value;
  const user = token ? authService.verifyToken(token) : null;

  if (!user) redirect('/login');
  if (user.role !== 'SUPER_ADMIN') redirect('/trainer');

  return children;
}
