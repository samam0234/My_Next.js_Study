"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ label }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
    >
      {pending ? "처리 중…" : label}
    </button>
  );
}
