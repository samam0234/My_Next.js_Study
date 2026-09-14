import { NextResponse } from "next/server";
import { cookieOptions, hashPassword, SESSION_COOKIE, signSession } from "@/lib/auth";
import { createUser, findUserByEmail, publicUser } from "@/lib/users-store";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; name?: string; password?: string };
  const email = (body.email ?? "").trim();
  const name = (body.name ?? "").trim();
  const password = body.password ?? "";
  if (!email.includes("@") || name.length < 1 || password.length < 4) {
    return NextResponse.json({ error: "이름, 이메일, 4자 이상 비밀번호가 필요합니다." }, { status: 400 });
  }
  if (await findUserByEmail(email)) {
    return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
  }
  const user = await createUser({
    email,
    name,
    passwordHash: await hashPassword(password),
  });
  const token = signSession({ sub: user.id, email: user.email, name: user.name });
  const response = NextResponse.json({ user: publicUser(user) }, { status: 201 });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions);
  return response;
}
