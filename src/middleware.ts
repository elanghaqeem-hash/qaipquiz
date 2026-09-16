import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/play/')) {
    const participantToken = req.cookies.get('tqa_participant_token')?.value;
    if (!participantToken) {
      const roomCode = pathname.split('/')[2] || '';
      const url = new URL('/join', req.url);
      if (roomCode) url.searchParams.set('code', roomCode.toUpperCase());
      return NextResponse.redirect(url);
    }
  }

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/trainer') ||
    pathname.startsWith('/host/')
  ) {
    const staffToken = req.cookies.get('tqa_auth_token')?.value;
    if (!staffToken) {
      const url = new URL('/login', req.url);
      url.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/play/:path*',
    '/admin/:path*',
    '/trainer/:path*',
    '/host/:path*',
  ],
};
