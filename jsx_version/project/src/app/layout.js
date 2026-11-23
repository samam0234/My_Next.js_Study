import { SiteHeader } from "@/components/header";
import "./globals.css";


export const metadata = {
  title: {
    default: "스터디 로그",
    template: "%s · 스터디 로그",
  },
  description: "Next.js 최종 실습 — 학습 노트를 한 프로젝트에서 씁니다.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
