import { notFound } from "next/navigation";
import { PostForm } from "@/app/ui/post-form";
import { getPost } from "@/lib/posts-store";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    notFound();
  }

  return (
    <article className="rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">study5</p>
      <h1 className="mt-2 text-2xl font-bold">글 수정</h1>
      <div className="mt-4">
        <PostForm post={post} />
      </div>
    </article>
  );
}
