import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "session_token";

function isProtected(pathname: string) {
  return pathname === "/posts/new" || /^\/posts\/[^/]+\/edit$/.test(pathname);
}

export function proxy(request: NextRequest) {
  if (!isProtected(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  if (request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/posts/new", "/posts/:id/edit"],
};
