import { NextResponse } from "next/server";
import { cookieOptions, SESSION_COOKIE, signSession, verifyPassword } from "@/lib/auth";
import { findUserByEmail, publicUser } from "@/lib/users-store";

export async function POST(request) {
  const body = await request.json();
  const user = await findUserByEmail((body.email ?? "").trim());
  if (!user || !(await verifyPassword(body.password ?? "", user.passwordHash))) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  const token = signSession({ sub: user.id, email: user.email, name: user.name });
  const response = NextResponse.json({ user: publicUser(user) });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions);
  return response;
}
