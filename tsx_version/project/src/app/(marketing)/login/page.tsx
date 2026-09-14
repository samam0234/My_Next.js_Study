import Link from "next/link";
import { loginAction } from "@/features/auth/actions";
import { SubmitButton } from "@/components/submit-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <article className="rounded-2xl border border-rule bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-bold">로그인</h1>
      {error ? (
        <p className="mt-2 text-sm text-red-700">이메일 또는 비밀번호를 확인하세요.</p>
      ) : null}
      <form action={loginAction} className="mt-4 flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          defaultValue="demo@example.com"
          className="rounded-md border border-rule bg-white px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          defaultValue="demo1234"
          className="rounded-md border border-rule bg-white px-3 py-2"
        />
        <SubmitButton label="들어가기" />
      </form>
      <Link href="/register" className="mt-4 inline-block text-sm underline">
        가입하기
      </Link>
    </article>
  );
}
