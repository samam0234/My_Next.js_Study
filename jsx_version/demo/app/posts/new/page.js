import { PostForm } from "@/app/ui/post-form";

export default function NewPostPage() {
  return (
    <article className="rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">study5</p>
      <h1 className="mt-2 text-2xl font-bold">새 글</h1>
      <div className="mt-4">
        <PostForm />
      </div>
    </article>
  );
}
