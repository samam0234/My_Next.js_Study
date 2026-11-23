import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError } from './domain';
import { authenticate, COOKIE } from './security';
import { getRepository } from './repository';
import { addQuickPost } from './note-action';
// 서버 컴포넌트가 자기 API를 다시 fetch하지 않고 저장소를 직접 읽는 예제다.
export async function ServerPage() {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token)
        redirect('/board');
    const state = await (await getRepository()).read();
    let user;
    try {
        user = authenticate(new Request('http://internal/private-lab', { headers: { cookie: `${COOKIE}=${token}` } }), state).user;
    }
    catch (error) {
        if (error instanceof ApiError && error.status === 401)
            redirect('/board');
        throw error;
    }
    const posts = state.posts.filter(post => post.authorId === user.id);
    return <section className="course"><h1>{user.nickname}님의 서버 실습</h1><ul>{posts.map(post => <li key={post.id}>{post.title}</li>)}</ul><form action={addQuickPost}><label>제목<input name="title" required maxLength={200}/></label><label>본문<textarea name="body" required maxLength={20000}/></label><button>Server Action으로 등록</button></form></section>;
}
