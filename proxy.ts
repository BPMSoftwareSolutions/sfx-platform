import { NextRequest, NextResponse } from 'next/server';

/** Runtime slot setting preserves one-image promotion and covers prerendered pages/assets. */
export function proxy(request: NextRequest) {
  if (process.env.SIDEFX_INDEXING !== 'disabled') return NextResponse.next();
  if (request.nextUrl.pathname === '/robots.txt') {
    return new NextResponse('User-agent: *\nDisallow: /\n', {
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  const response = NextResponse.next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
