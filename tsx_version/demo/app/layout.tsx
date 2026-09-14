import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Next.js 실습 데모",
  description: "App Router 기초부터 게시판·로그인까지 한 프로젝트에서 실습합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-line bg-stone-900 text-stone-50">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Next.js 실습 데모
            </Link>
            <nav className="flex gap-4 text-sm text-stone-300">
              <Link href="/" className="hover:text-white">
                홈
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-line px-4 py-4 text-center text-xs text-stone-500">
          study1 · App Router · tsx_version/demo
        </footer>
      </body>
    </html>
  );
}
