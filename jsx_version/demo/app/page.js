import Link from "next/link";

export default function HomePage() {
  const renderedAt = new Date().toISOString();

  return (
    <article className="flex flex-col gap-6">
      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          study1
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Next.js에 오신 것을 환영합니다
        </h1>
        <p className="mt-3 leading-7 text-stone-600">
          이 페이지는 <code className="rounded bg-stone-100 px-1">app/page.js</code>
          입니다. App Router에서 <code className="rounded bg-stone-100 px-1">page</code> 파일이
          곧 URL입니다. 루트 레이아웃(
          <code className="rounded bg-stone-100 px-1">app/layout.js</code>
          )이 헤더와 푸터를 감싸고 있습니다.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">이 파일은 서버 컴포넌트입니다</h2>
        <p className="mt-2 leading-7 text-stone-600">
          <code className="rounded bg-stone-100 px-1">&quot;use client&quot;</code>가
          없으므로 아래 시각은 브라우저가 아니라 <strong>서버에서</strong> 문자열로
          만들어진 뒤 HTML에 박혀 내려옵니다. 새로고침할 때마다 값이 바뀝니다.
        </p>
        <p className="mt-4 rounded-lg bg-stone-900 px-4 py-3 font-mono text-sm text-accent-fg">
          renderedAt = {renderedAt}
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">study2에서 열린 주소</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 leading-7 text-stone-600">
          <li>
            <Link className="text-accent underline" href="/about">
              /about
            </Link>{" "}
            정적 페이지
          </li>
          <li>
            <Link className="text-accent underline" href="/hello/next">
              /hello/[name]
            </Link>{" "}
            동적 세그먼트
          </li>
          <li>
            <Link className="text-accent underline" href="/posts">
              /posts
            </Link>{" "}
            중첩 레이아웃 + 목록 / 상세
          </li>
        </ul>
      </section>
    </article>
  );
}
