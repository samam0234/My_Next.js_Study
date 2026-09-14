import Link from "next/link";
import { fetchExternalPosts } from "@/lib/external-posts";
import { listPosts } from "@/lib/posts-store";

export default async function PostsPage({ searchParams }) {
  const { slow, boom } = await searchParams;
  if (boom === "1") {
    throw new Error("study4 실습용 에러");
  }
  if (slow === "1") {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  const posts = await listPosts();
  let external = [];
  try {
    external = await fetchExternalPosts();
  } catch {
    external = [];
  }

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        study5 · /posts
      </p>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">게시글 목록</h1>
        <Link
          href="/posts/new"
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
        >
          새 글
        </Link>
      </div>
      <p className="text-sm text-stone-500">
        이 목록은 서버 컴포넌트가 <code>data/posts.json</code>을 직접 읽습니다. API를 한 번 더
        거치지 않습니다.
      </p>
      <ul className="divide-y divide-line">
        {posts.map((post) => (
          <li key={post.id} className="py-3">
            <Link href={`/posts/${post.id}`} className="font-medium text-accent hover:underline">
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
      <section className="rounded-xl bg-stone-100 p-4">
        <h2 className="text-sm font-semibold">비교: 외부 API (jsonplaceholder)</h2>
        <p className="mt-1 text-xs text-stone-500">
          서버에서 <code>fetch</code> 했습니다. 60초 재검증. 네트워크가 없으면 이 칸은 비어 있습니다.
        </p>
        <ul className="mt-2 list-disc pl-5 text-sm text-stone-600">
          {external.map((item) => (
            <li key={item.id}>{item.title}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
