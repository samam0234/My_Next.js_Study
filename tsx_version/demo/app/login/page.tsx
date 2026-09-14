import Link from "next/link";
import { AuthForm } from "@/app/ui/auth-form";

export default function LoginPage() {
  return (
    <article className="rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">study6</p>
      <h1 className="mt-2 text-2xl font-bold">로그인</h1>
      <p className="mt-2 text-sm text-stone-500">시드 계정 demo@example.com / demo1234</p>
      <div className="mt-4">
        <AuthForm mode="login" />
      </div>
      <p className="mt-4 text-sm text-stone-500">
        계정이 없으면{" "}
        <Link href="/register" className="text-accent underline">
          회원가입
        </Link>
      </p>
    </article>
  );
}
