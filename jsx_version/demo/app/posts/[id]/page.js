import { notFound } from "next/navigation";
import { findSamplePost } from "@/lib/sample-posts";

export default async function PostPage({ params }) {
  const { id } = await params;
  const post = findSamplePost(id);
  if (!post) {
    notFound();
  }

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        study2 · /posts/{id}
      </p>
      <h1 className="text-2xl font-bold tracking-tight">{post.title}</h1>
      <p className="leading-7 text-stone-600">{post.body}</p>
    </article>
  );
}
