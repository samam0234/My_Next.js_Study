import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { SiteHeader } from "@/app/ui/site-header";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Next.js 실습 데모",
    template: "%s · Next.js 실습",
  },
  description: "App Router 기초부터 게시판·로그인까지 한 프로젝트에서 실습합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-line px-4 py-4 text-center text-xs text-stone-500">
          study2 · App Router · tsx_version/demo
        </footer>
      </body>
    </html>
  );
}
