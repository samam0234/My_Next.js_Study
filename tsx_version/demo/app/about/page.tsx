import Link from "next/link";
import { Counter } from "@/app/ui/counter";

export default function AboutPage() {
  const serverStamp = new Date().toISOString();

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        study3 · /about
      </p>
      <h1 className="text-3xl font-bold tracking-tight">이 데모가 가는 길</h1>
      <p className="leading-7 text-stone-600">
        Notion 예제처럼 게시판과 로그인을 Next.js 한 프로젝트에서 붙입니다. 지금은
        라우팅만 있고, 데이터는 아직 메모리(상수 배열)입니다.
      </p>
      <ul className="list-disc space-y-1 pl-5 leading-7 text-stone-600">
        <li>
          <Link className="text-accent underline" href="/posts">
            /posts
          </Link>{" "}
          중첩 레이아웃 + 목록
        </li>
        <li>
          <Link className="text-accent underline" href="/hello/gildong">
            /hello/gildong
          </Link>{" "}
          동적 세그먼트
        </li>
      </ul>
      <div className="mt-2 rounded-xl bg-stone-100 px-4 py-3 text-sm">
        서버 컴포넌트가 만든 시각:{" "}
        <code className="font-mono">{serverStamp}</code>
      </div>
      <Counter label="클라이언트 카운터 (useState)" initialCount={3} />
    </article>
  );
}
