import Link from "next/link";

export default async function HelloPage({ params, searchParams }) {
  const { name } = await params;
  const { from } = await searchParams;
  const decoded = decodeURIComponent(name);

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        study2 · /hello/[name]
      </p>
      <h1 className="text-3xl font-bold tracking-tight">안녕하세요, {decoded}님</h1>
      <p className="leading-7 text-stone-600">
        <code className="rounded bg-stone-100 px-1">params.name</code> = {decoded}
        {from ? (
          <>
            {" "}
            · <code className="rounded bg-stone-100 px-1">searchParams.from</code> = {from}
          </>
        ) : null}
      </p>
      <p className="text-sm text-stone-500">
        Next 15부터 <code>params</code>와 <code>searchParams</code>는 Promise라서 await 합니다.
      </p>
      <Link href="/hello/next?from=query" className="text-sm text-accent underline">
        쿼리스트링 예제 보기
      </Link>
    </article>
  );
}
