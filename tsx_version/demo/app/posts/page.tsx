import Link from "next/link";
import { SAMPLE_POSTS } from "@/lib/sample-posts";

export default function PostsPage() {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        study2 · /posts
      </p>
      <h1 className="text-2xl font-bold tracking-tight">게시글 목록</h1>
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
