import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authService } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('tqa_auth_token')?.value;
  const user = token ? await authService.verifyToken(token) : null;

  if (!user || !['TRAINER', 'SUPER_ADMIN'].includes(user.role)) {
    redirect('/login');
  }

  return children;
}
