import Link from 'next/link';
export function SiteHeader() { return <header className="border-b p-4"><nav aria-label="주 메뉴" className="flex gap-4"><Link href="/">Next.js 학습</Link><Link href="/lab">기초</Link><Link href="/board">게시판·로그인</Link><Link href="/api-docs">API 문서</Link></nav></header>; }
