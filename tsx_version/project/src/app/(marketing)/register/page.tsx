import Link from "next/link";
import { registerAction } from "@/features/auth/actions";
import { SubmitButton } from "@/components/submit-button";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message =
    error === "exists" ? "이미 있는 이메일입니다." : error ? "입력값을 확인하세요." : null;
  return (
    <article className="rounded-2xl border border-rule bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-bold">가입</h1>
      {message ? <p className="mt-2 text-sm text-red-700">{message}</p> : null}
      <form action={registerAction} className="mt-4 flex flex-col gap-3">
        <input
          name="name"
          required
          placeholder="이름"
          className="rounded-md border border-rule bg-white px-3 py-2"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="이메일"
          className="rounded-md border border-rule bg-white px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          minLength={4}
          placeholder="비밀번호"
          className="rounded-md border border-rule bg-white px-3 py-2"
        />
        <SubmitButton label="계정 만들기" />
      </form>
      <Link href="/login" className="mt-4 inline-block text-sm underline">
        이미 있으면 로그인
      </Link>
    </article>
  );
}
