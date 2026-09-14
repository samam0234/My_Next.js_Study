import { NextResponse } from "next/server";

const SESSION_COOKIE = "session_token";

function isProtected(pathname) {
  return pathname === "/posts/new" || /^\/posts\/[^/]+\/edit$/.test(pathname);
}

export function proxy(request) {
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
