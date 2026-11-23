import Link from 'next/link';
export default function Home() { return <section className="course"><h1>Next.js 학습 서비스</h1><p>기본 개념을 익히고 로그인 게시판을 만든 뒤 문서·AI 기능으로 확장합니다.</p><Link href="/lab">기초 실습</Link><Link href="/board">게시판·로그인</Link><Link href="/workbench">문서·AI 작업실</Link></section>; }
