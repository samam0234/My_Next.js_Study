"use client";

export default function PostsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-semibold text-red-800">게시판에서 오류가 났습니다</h2>
      <p className="mt-2 font-mono text-sm text-red-700">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-red-800 px-3 py-1.5 text-sm text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
