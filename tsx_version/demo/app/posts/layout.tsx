import Link from "next/link";

export default function PostsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <aside className="rounded-xl border border-line bg-teal-50 px-4 py-3 text-sm text-teal-900">
        이 박스는 <code className="rounded bg-white px-1">app/posts/layout.tsx</code> 입니다.
        목록과 상세를 오가도 이 레이아웃은 유지됩니다.{" "}
        <Link href="/posts" className="underline">
          목록으로
        </Link>
      </aside>
      {children}
    </div>
  );
}
