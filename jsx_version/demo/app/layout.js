import { SiteHeader } from "@/app/ui/site-header";
import "./globals.css";


export const metadata = {
  title: {
    default: "Next.js 실습 데모",
    template: "%s · Next.js 실습",
  },
  description: "App Router 기초부터 게시판·로그인까지 한 프로젝트에서 실습합니다.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-line px-4 py-4 text-center text-xs text-stone-500">
          study2 · App Router · jsx_version/demo
        </footer>
      </body>
    </html>
  );
}
