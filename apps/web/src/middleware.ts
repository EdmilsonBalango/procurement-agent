import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'procurement_session';
const PUBLIC_ROUTES = new Set(['/login', '/mfa']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE);
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)'],
};
