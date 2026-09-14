export const SAMPLE_POSTS = [
  {
    id: "1",
    title: "App Router는 폴더가 URL이다",
    body: "app/posts/page.js 가 /posts 가 됩니다. Nest의 @Controller('posts')와 같은 일을 파일 시스템이 합니다.",
  },
  {
    id: "2",
    title: "대괄호는 동적 세그먼트",
    body: "app/posts/[id]/page.js 는 /posts/1, /posts/2 처럼 id만 바뀌는 주소를 받습니다.",
  },
];

export function findSamplePost(id) {
  return SAMPLE_POSTS.find((post) => post.id === id) ?? null;
}
