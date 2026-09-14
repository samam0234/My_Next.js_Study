import Link from "next/link";

export default function HomePage() {
  return (
    <article className="rounded-2xl border border-rule bg-card p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mark">
        studyFinal
      </p>
      <h1 className="mt-3 text-4xl font-bold leading-tight">
        배운 것을
        <br />
        노트 한 권에
      </h1>
      <p className="mt-4 max-w-lg leading-7 text-ink">
        demo 게시판과 달리 이 프로젝트는 <strong>학습 노트</strong> 도메인입니다. 폴더는{" "}
        <code>src/features</code>, 저장소는 <code>node:sqlite</code>, URL은 Route Group으로
        마케팅 화면과 노트북 화면을 나눕니다.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/register" className="rounded-md bg-ink px-4 py-2 text-sm text-card">
          노트 시작
        </Link>
        <Link href="/login" className="rounded-md border border-rule px-4 py-2 text-sm">
          로그인
        </Link>
      </div>
      <p className="mt-6 text-xs text-stone-500">시드 계정 demo@example.com / demo1234</p>
    </article>
  );
}
