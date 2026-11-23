import { NextResponse, type NextRequest } from 'next/server';
export function proxy(request: NextRequest) {
  if (request.cookies.get('course_session')?.value) return NextResponse.next();
  return NextResponse.redirect(new URL('/board', request.url));
}
export const config = { matcher: ['/private-lab/:path*', '/workbench/:path*'] };
