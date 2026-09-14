import Link from "next/link";
import { SAMPLE_POSTS } from "@/lib/sample-posts";

type PostsPageProps = {
  searchParams: Promise<{ slow?: string; boom?: string }>;
};

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const { slow, boom } = await searchParams;
  if (boom === "1") {
    throw new Error("study4 실습용 에러");
  }
  if (slow === "1") {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        study4 · /posts
      </p>
      <h1 className="text-2xl font-bold tracking-tight">게시글 목록</h1>
      <p className="text-sm text-stone-500">
        <Link href="/posts?slow=1" className="underline">
          느린 로딩
        </Link>
        {" · "}
        <Link href="/posts?boom=1" className="underline">
          에러 보기
        </Link>
        {" · "}
        <Link href="/api/hello" className="underline">
          /api/hello
        </Link>
      </p>
      <ul className="divide-y divide-line">
        {SAMPLE_POSTS.map((post) => (
          <li key={post.id} className="py-3">
            <Link href={`/posts/${post.id}`} className="font-medium text-accent hover:underline">
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
