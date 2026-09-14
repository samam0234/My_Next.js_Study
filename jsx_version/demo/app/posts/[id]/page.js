import Link from "next/link";
import { notFound } from "next/navigation";
import { DeletePostButton } from "@/app/ui/delete-post-button";
import { getPost } from "@/lib/posts-store";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return { title: "글을 찾을 수 없음" };
  }
  return {
    title: post.title,
    description: post.body.slice(0, 80),
  };
}

export default async function PostPage({ params }) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    notFound();
  }

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        study5 · /posts/{id}
      </p>
      <h1 className="text-2xl font-bold tracking-tight">{post.title}</h1>
      {post.authorName ? (
        <p className="text-sm text-stone-500">작성자 {post.authorName}</p>
      ) : null}
      <p className="leading-7 whitespace-pre-wrap text-stone-600">{post.body}</p>
      <div className="flex gap-4">
        <Link href={`/posts/${post.id}/edit`} className="text-sm text-accent underline">
          수정
        </Link>
        <DeletePostButton id={post.id} />
      </div>
    </article>
  );
}
