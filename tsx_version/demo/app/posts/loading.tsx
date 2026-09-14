export default function PostsLoading() {
  return (
    <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-sm font-medium text-stone-500">게시글을 불러오는 중…</p>
      <div className="mt-4 space-y-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-stone-200" />
      </div>
    </div>
  );
}
