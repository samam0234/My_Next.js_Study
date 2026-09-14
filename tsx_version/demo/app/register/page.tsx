import Link from "next/link";
import { AuthForm } from "@/app/ui/auth-form";

export default function RegisterPage() {
  return (
    <article className="rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">study6</p>
      <h1 className="mt-2 text-2xl font-bold">회원가입</h1>
      <div className="mt-4">
        <AuthForm mode="register" />
      </div>
      <p className="mt-4 text-sm text-stone-500">
        이미 있으면{" "}
        <Link href="/login" className="text-accent underline">
          로그인
        </Link>
      </p>
    </article>
  );
}
