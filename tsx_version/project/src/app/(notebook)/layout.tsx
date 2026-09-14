import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function NotebookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-dashed border-rule bg-card/70 px-3 py-2 text-xs text-ink">
        Route Group <code>(notebook)</code> — URL에는 안 들어갑니다. 레이아웃에서 로그인만 통과시킵니다.
      </p>
      {children}
    </div>
  );
}
