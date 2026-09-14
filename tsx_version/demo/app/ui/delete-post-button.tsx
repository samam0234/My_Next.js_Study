"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeletePostButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!confirm("이 글을 삭제할까요?")) {
      return;
    }
    setPending(true);
    const response = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    setPending(false);
    if (!response.ok) {
      alert("삭제에 실패했습니다.");
      return;
    }
    router.push("/posts");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="text-sm text-red-700 underline disabled:opacity-60"
    >
      {pending ? "삭제 중…" : "삭제"}
    </button>
  );
}
