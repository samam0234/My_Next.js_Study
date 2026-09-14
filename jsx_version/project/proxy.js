import { NextResponse } from "next/server";

const SESSION_COOKIE = "studylog_session";

export function proxy(request) {
  if (!request.nextUrl.pathname.startsWith("/notes")) {
    return NextResponse.next();
  }
  if (request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/notes/:path*"],
};
