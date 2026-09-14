"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PostFormProps = {
  post?: { id: string; title: string; body: string };
};

export function PostForm({ post }: PostFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") ?? ""),
      body: String(form.get("body") ?? ""),
    };
    const response = await fetch(post ? `/api/posts/${post.id}` : "/api/posts", {
      method: post ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "저장에 실패했습니다.");
      return;
    }
    const data = (await response.json()) as { post: { id: string } };
    router.push(`/posts/${data.post.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        제목
        <input
          name="title"
          required
          defaultValue={post?.title}
          className="rounded-lg border border-line bg-white px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        본문
        <textarea
          name="body"
          required
          rows={6}
          defaultValue={post?.body}
          className="rounded-lg border border-line bg-white px-3 py-2"
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-60"
      >
        {pending ? "저장 중…" : post ? "수정" : "등록"}
      </button>
    </form>
  );
}
