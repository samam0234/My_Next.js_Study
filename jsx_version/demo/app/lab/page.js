import { Counter } from '@/course/counter';
import { Draft } from '@/course/draft';
export default function Lab() { const topic = 'Next.js'; return <section className="course"><h1>Hello, {topic}!</h1><p>app 폴더와 page 파일이 URL을 만듭니다.</p><Counter label="클릭" initial={3} /><Draft /><a href="/board">게시판으로</a></section>; }
