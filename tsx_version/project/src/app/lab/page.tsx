import { Counter } from '@/course/counter';
import { Draft } from '@/course/draft';
import { readGlossary } from '@/course/cache';
export default async function Lab() { const glossary = await readGlossary(); return <section className="course"><h1>Hello, Next.js!</h1><p>{glossary.routing}</p><p>공개 캐시 시각: {glossary.generatedAt}</p><Counter label="클릭" initial={3} /><Draft /><a href="/board">게시판으로</a></section>; }
