"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  cookieOptions,
  hashPassword,
  SESSION_COOKIE,
  signSession,
  verifyPassword,
} from "@/lib/auth";
import { createUserRow, findUserByEmail } from "@/features/auth/store";

export async function registerAction(formData) {
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email.includes("@") || !name || password.length < 4) {
    redirect("/register?error=invalid");
  }
  if (findUserByEmail(email)) {
    redirect("/register?error=exists");
  }
  const user = createUserRow({
    email,
    name,
    passwordHash: await hashPassword(password),
  });
  const token = signSession({ sub: user.id, email: user.email, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions);
  redirect("/notes");
}

export async function loginAction(formData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const user = findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    redirect("/login?error=invalid");
  }
  const token = signSession({ sub: user.id, email: user.email, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions);
  redirect("/notes");
}

export async function logoutAction() {
  (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  redirect("/");
}
