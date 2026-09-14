import Link from "next/link";
import { LogoutButton } from "@/app/ui/logout-button";
import { getSession } from "@/lib/session";

const links = [
  { href: "/", label: "홈" },
  { href: "/about", label: "소개" },
  { href: "/posts", label: "게시판" },
  { href: "/hello/next", label: "인사" },
];

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="border-b border-line bg-stone-900 text-stone-50">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Next.js 실습 데모
        </Link>
        <nav className="flex items-center gap-4 text-sm text-stone-300">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-white">
              {item.label}
            </Link>
          ))}
          {session ? (
            <>
              <span className="text-stone-400">{session.name}</span>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="hover:text-white">
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
