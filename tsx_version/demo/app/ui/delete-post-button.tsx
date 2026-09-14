"use client";

import { deletePostAction } from "@/app/actions/posts";

export function DeletePostButton({ id }: { id: string }) {
  return (
    <form
      action={deletePostAction.bind(null, id)}
      onSubmit={(event) => {
        if (!confirm("이 글을 삭제할까요?")) {
          event.preventDefault();
        }
      }}
    >
      <button type="submit" className="text-sm text-red-700 underline">
        삭제
      </button>
    </form>
  );
}
