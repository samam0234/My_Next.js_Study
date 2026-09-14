import Link from "next/link";
import { logoutAction } from "@/features/auth/actions";
import { getSession } from "@/lib/session";

export async function SiteHeader() {
  const session = await getSession();
  return (
    <header className="border-b border-rule bg-card/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          스터디 로그
        </Link>
        <nav className="flex items-center gap-4 text-sm text-ink">
          {session ? (
            <>
              <Link href="/notes">내 노트</Link>
              <span className="text-stone-500">{session.name}</span>
              <form action={logoutAction}>
                <button type="submit" className="underline">
                  나가기
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">로그인</Link>
              <Link href="/register">가입</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
