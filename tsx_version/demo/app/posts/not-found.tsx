import Link from "next/link";

export default function PostsNotFound() {
  return (
    <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">글을 찾을 수 없습니다</h2>
      <p className="mt-2 text-stone-600">id가 없거나 삭제된 글입니다.</p>
      <Link href="/posts" className="mt-4 inline-block text-sm text-accent underline">
        목록으로
      </Link>
    </div>
  );
}
