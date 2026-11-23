# study6 — SQLite·공통 API v1·CRUD

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

환경변수로 DB를 연결하고 게시글·댓글 CRUD를 공통 v1 계약으로 제공한다.

## ② 📖 이론

Repository는 저장 방식의 경계다. 기본 SQLite는 data/course.db 파일을 생성하고 BEGIN IMMEDIATE로 읽기·수정·쓰기를 한 트랜잭션으로 묶는다. 입력을 SQL 문자열에 이어 붙이지 않고 바인딩한다.

모델은 User, Post, Comment와 시간·작성자·태그 필드다. 학습용 저장소는 전체 상태를 course_state의 JSON 문자열 한 행에 보관한다. 정규화 테이블과 DB 인덱스가 없으므로 큰 데이터에는 적합하지 않지만, DB 교체와 갱신 충돌 제어를 한 코드에서 관찰할 수 있다.

API 계약은 식당의 주문 번호 체계다. 화면을 바꾸어도 같은 /api/posts 경로와 {data,meta}, {error:{code,message,fields,requestId}} 형식을 유지한다. 회원·작성자 기능은 다음 study7에서 원리를 설명하며, 현재 코드는 누적 완성본이다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. .env.local의 DB_DRIVER=sqlite와 COURSE_DB_PATH=data/course.db를 확인한다. 서버를 실행해 /health에서 DB 연결을 확인한다.
2. /board에서 가입·로그인하고 목록·등록·상세·수정·삭제를 순서대로 실행한다.
3. Network에서 등록 201과 Location, 수정 200, 삭제 204와 빈 본문을 확인한다.
4. 댓글을 등록하고 게시글의 commentCount 변화를 확인한다. 재시작 후 데이터가 남는지 본다.

~~~powershell
cd tsx_version/demo
npm run dev
# 별도 터미널
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod "http://localhost:3000/api/posts?q=next&page=1&limit=10&sort=-createdAt"
# 쓰기 요청은 /board에서 로그인 후 수행하거나 study7의 Bearer 예제를 사용한다.
~~~

### 공통 API 스펙 v1 매핑

| 요청 | 성공 | 권한·계약 |
|---|---|---|
| GET /health | 200 | 접두어 없이 {status:"ok"} |
| POST /api/auth/signup · login | 201 · 200 | email/password/nickname, 로그인은 data.user/accessToken |
| POST /api/auth/logout · GET /api/auth/me | 204 · 200 | 쿠키 또는 Bearer |
| GET /api/posts · /api/posts/{id} | 200 | data, 목록 meta.page/limit/total/totalPages/q |
| POST /api/posts | 201 | Location 헤더, 로그인 필요 |
| PATCH · DELETE /api/posts/{id} | 200 · 204 | 작성자만, 부분 수정 |
| GET · POST /api/posts/{id}/comments | 200 · 201 | 쓰기는 로그인 필요 |
| DELETE /api/comments/{id} | 204 | 댓글 작성자만 |

목록은 q 대소문자 무시 부분 검색, page≥1, limit 기본 10·최대 50, sort=createdAt/-createdAt/-commentCount를 지원한다. 모든 응답은 X-Request-Id를 포함한다. 잘못된 숫자 id는 400, 없는 자원은 404다. [원문 공통 스펙](https://app.notion.com/p/3d6d7dec5e2e8139adbfd36dd506c65e)을 기준으로 구현했다.

### tsx_version/demo/course/domain.ts

[실행 파일](tsx_version/demo/course/domain.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/course/domain.ts sha256:2fc8388465af58fb08e336cbed41d6c05a2cda1c324d3397a4a16d5b74bf4a14 -->
~~~ts
export type User = {
  id: number;
  email: string;
  nickname: string;
  passwordHash: string;
  githubId?: number;
};
export type Post = {
  id: number;
  title: string;
  body: string;
  tags: string[];
  authorId: number;
  createdAt: string;
  updatedAt: string;
};
export type Comment = {
  id: number;
  postId: number;
  authorId: number;
  body: string;
  createdAt: string;
};
export type Job = {
  id: number;
  ownerId: number;
  status: "pending" | "done" | "failed";
  attempts: number;
  text: string;
  result?: string;
};
export type State = {
  seq: number;
  users: User[];
  posts: Post[];
  comments: Comment[];
  files: { id: number; ownerId: number; name: string; text: string }[];
  jobs: Job[];
  revoked: string[];
  webhookIds: string[];
};
export const emptyState = (): State => ({
  seq: 0,
  users: [],
  posts: [],
  comments: [],
  files: [],
  jobs: [],
  revoked: [],
  webhookIds: [],
});
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}
export function text(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new ApiError(400, "VALIDATION_ERROR", "입력값을 확인하세요.", {
      [field]: [`1~${max}자로 입력하세요.`],
    });
  return value.trim();
}
export function identifier(value: string) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new ApiError(400, "BAD_REQUEST", "id는 양의 정수입니다.");
  return Number(value);
}
export function publicUser(user: User) {
  return { id: user.id, email: user.email, nickname: user.nickname };
}
export function postView(state: State, post: Post) {
  const user = state.users.find((u) => u.id === post.authorId)!;
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    tags: post.tags,
    author: { id: user.id, nickname: user.nickname },
    commentCount: state.comments.filter((c) => c.postId === post.id).length,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}
export function listPosts(state: State, query: URLSearchParams) {
  const number = (key: string, fallback: number) => {
    const raw = query.get(key);
    if (raw === null) return fallback;
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      throw new ApiError(400, "BAD_REQUEST", `${key}는 양의 정수입니다.`);
    return Number(raw);
  };
  const page = number("page", 1),
    limit = Math.min(number("limit", 10), 50),
    q = query.get("q") ?? "";
  const sort = query.get("sort") ?? "-createdAt";
  if (!["createdAt", "-createdAt", "-commentCount"].includes(sort))
    throw new ApiError(400, "BAD_REQUEST", "정렬 값을 확인하세요.");
  const rows = state.posts
    .filter((p) =>
      `${p.title}\n${p.body}`.toLowerCase().includes(q.toLowerCase()),
    )
    .map((p) => postView(state, p));
  rows.sort((a, b) =>
    sort === "-commentCount"
      ? b.commentCount - a.commentCount || b.id - a.id
      : (sort === "createdAt" ? 1 : -1) *
        (a.createdAt.localeCompare(b.createdAt) || a.id - b.id),
  );
  return {
    data: rows.slice((page - 1) * limit, page * limit),
    meta: {
      page,
      limit,
      total: rows.length,
      totalPages: Math.ceil(rows.length / limit),
      q,
    },
  };
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 다른 모듈이 공유할 데이터 구조를 선언한다: export type User = { |
| 2 | 객체·스키마·속성의 값을 지정한다: id: number; |
| 3 | 객체·스키마·속성의 값을 지정한다: email: string; |
| 4 | 객체·스키마·속성의 값을 지정한다: nickname: string; |
| 5 | 객체·스키마·속성의 값을 지정한다: passwordHash: string; |
| 6 | 현재 구문에서 다음 값·인자·표현식을 연결한다: githubId?: number; |
| 7 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 8 | 다른 모듈이 공유할 데이터 구조를 선언한다: export type Post = { |
| 9 | 객체·스키마·속성의 값을 지정한다: id: number; |
| 10 | 객체·스키마·속성의 값을 지정한다: title: string; |
| 11 | 객체·스키마·속성의 값을 지정한다: body: string; |
| 12 | 객체·스키마·속성의 값을 지정한다: tags: string[]; |
| 13 | 객체·스키마·속성의 값을 지정한다: authorId: number; |
| 14 | 객체·스키마·속성의 값을 지정한다: createdAt: string; |
| 15 | 객체·스키마·속성의 값을 지정한다: updatedAt: string; |
| 16 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 17 | 다른 모듈이 공유할 데이터 구조를 선언한다: export type Comment = { |
| 18 | 객체·스키마·속성의 값을 지정한다: id: number; |
| 19 | 객체·스키마·속성의 값을 지정한다: postId: number; |
| 20 | 객체·스키마·속성의 값을 지정한다: authorId: number; |
| 21 | 객체·스키마·속성의 값을 지정한다: body: string; |
| 22 | 객체·스키마·속성의 값을 지정한다: createdAt: string; |
| 23 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 24 | 다른 모듈이 공유할 데이터 구조를 선언한다: export type Job = { |
| 25 | 객체·스키마·속성의 값을 지정한다: id: number; |
| 26 | 객체·스키마·속성의 값을 지정한다: ownerId: number; |
| 27 | 객체·스키마·속성의 값을 지정한다: status: "pending" \| "done" \| "failed"; |
| 28 | 객체·스키마·속성의 값을 지정한다: attempts: number; |
| 29 | 객체·스키마·속성의 값을 지정한다: text: string; |
| 30 | 현재 구문에서 다음 값·인자·표현식을 연결한다: result?: string; |
| 31 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 32 | 다른 모듈이 공유할 데이터 구조를 선언한다: export type State = { |
| 33 | 객체·스키마·속성의 값을 지정한다: seq: number; |
| 34 | 객체·스키마·속성의 값을 지정한다: users: User[]; |
| 35 | 객체·스키마·속성의 값을 지정한다: posts: Post[]; |
| 36 | 객체·스키마·속성의 값을 지정한다: comments: Comment[]; |
| 37 | 객체·스키마·속성의 값을 지정한다: files: { id: number; ownerId: number; name: string; text: string }[]; |
| 38 | 객체·스키마·속성의 값을 지정한다: jobs: Job[]; |
| 39 | 객체·스키마·속성의 값을 지정한다: revoked: string[]; |
| 40 | 객체·스키마·속성의 값을 지정한다: webhookIds: string[]; |
| 41 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 42 | 이름 있는 값·설정·함수 또는 상태를 준비한다: export const emptyState = (): State => ({ |
| 43 | 객체·스키마·속성의 값을 지정한다: seq: 0, |
| 44 | 객체·스키마·속성의 값을 지정한다: users: [], |
| 45 | 객체·스키마·속성의 값을 지정한다: posts: [], |
| 46 | 객체·스키마·속성의 값을 지정한다: comments: [], |
| 47 | 객체·스키마·속성의 값을 지정한다: files: [], |
| 48 | 객체·스키마·속성의 값을 지정한다: jobs: [], |
| 49 | 객체·스키마·속성의 값을 지정한다: revoked: [], |
| 50 | 객체·스키마·속성의 값을 지정한다: webhookIds: [], |
| 51 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 52 | 상태 코드·오류 code·필드 오류를 함께 전달할 오류 객체를 정의한다. |
| 53 | 현재 구문에서 다음 값·인자·표현식을 연결한다: constructor( |
| 54 | 현재 구문에서 다음 값·인자·표현식을 연결한다: public status: number, |
| 55 | 현재 구문에서 다음 값·인자·표현식을 연결한다: public code: string, |
| 56 | 객체·스키마·속성의 값을 지정한다: message: string, |
| 57 | 현재 구문에서 다음 값·인자·표현식을 연결한다: public fields: Record<string, string[]> = {}, |
| 58 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ) { |
| 59 | 현재 구문에서 다음 값·인자·표현식을 연결한다: super(message); |
| 60 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 61 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 62 | text의 입력·반환 경계를 정의한다. |
| 63 | 입력·상태 조건에 따라 처리 경로를 고른다: if (typeof value !== "string" \|\| !value.trim() \|\| value.trim().length > max) |
| 64 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(400, "VALIDATION_ERROR", "입력값을 확인하세요.", { |
| 65 | 현재 구문에서 다음 값·인자·표현식을 연결한다: [field]: [ˋ1~${max}자로 입력하세요.ˋ], |
| 66 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 67 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return value.trim(); |
| 68 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 69 | identifier의 입력·반환 경계를 정의한다. |
| 70 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: if (!/^[1-9]\d*$/.test(value) \|\| !Number.isSafeInteger(Number(value))) |
| 71 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(400, "BAD_REQUEST", "id는 양의 정수입니다."); |
| 72 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return Number(value); |
| 73 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 74 | publicUser의 입력·반환 경계를 정의한다. |
| 75 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return { id: user.id, email: user.email, nickname: user.nickname }; |
| 76 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 77 | postView의 입력·반환 경계를 정의한다. |
| 78 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const user = state.users.find((u) => u.id === post.authorId)!; |
| 79 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return { |
| 80 | 객체·스키마·속성의 값을 지정한다: id: post.id, |
| 81 | 객체·스키마·속성의 값을 지정한다: title: post.title, |
| 82 | 객체·스키마·속성의 값을 지정한다: body: post.body, |
| 83 | 객체·스키마·속성의 값을 지정한다: tags: post.tags, |
| 84 | 객체·스키마·속성의 값을 지정한다: author: { id: user.id, nickname: user.nickname }, |
| 85 | 객체·스키마·속성의 값을 지정한다: commentCount: state.comments.filter((c) => c.postId === post.id).length, |
| 86 | 객체·스키마·속성의 값을 지정한다: createdAt: post.createdAt, |
| 87 | 객체·스키마·속성의 값을 지정한다: updatedAt: post.updatedAt, |
| 88 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 89 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 90 | listPosts의 입력·반환 경계를 정의한다. |
| 91 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const number = (key: string, fallback: number) => { |
| 92 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const raw = query.get(key); |
| 93 | 입력·상태 조건에 따라 처리 경로를 고른다: if (raw === null) return fallback; |
| 94 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: if (!/^[1-9]\d*$/.test(raw) \|\| !Number.isSafeInteger(Number(raw))) |
| 95 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(400, "BAD_REQUEST", ˋ${key}는 양의 정수입니다.ˋ); |
| 96 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return Number(raw); |
| 97 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 98 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const page = number("page", 1), |
| 99 | 현재 구문에서 다음 값·인자·표현식을 연결한다: limit = Math.min(number("limit", 10), 50), |
| 100 | 현재 구문에서 다음 값·인자·표현식을 연결한다: q = query.get("q") ?? ""; |
| 101 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const sort = query.get("sort") ?? "-createdAt"; |
| 102 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!["createdAt", "-createdAt", "-commentCount"].includes(sort)) |
| 103 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(400, "BAD_REQUEST", "정렬 값을 확인하세요."); |
| 104 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const rows = state.posts |
| 105 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .filter((p) => |
| 106 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ˋ${p.title}\n${p.body}ˋ.toLowerCase().includes(q.toLowerCase()), |
| 107 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 108 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .map((p) => postView(state, p)); |
| 109 | 현재 구문에서 다음 값·인자·표현식을 연결한다: rows.sort((a, b) => |
| 110 | 현재 구문에서 다음 값·인자·표현식을 연결한다: sort === "-commentCount" |
| 111 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ? b.commentCount - a.commentCount \|\| b.id - a.id |
| 112 | 현재 구문에서 다음 값·인자·표현식을 연결한다: : (sort === "createdAt" ? 1 : -1) * |
| 113 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (a.createdAt.localeCompare(b.createdAt) \|\| a.id - b.id), |
| 114 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 115 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return { |
| 116 | 객체·스키마·속성의 값을 지정한다: data: rows.slice((page - 1) * limit, page * limit), |
| 117 | 객체·스키마·속성의 값을 지정한다: meta: { |
| 118 | 현재 구문에서 다음 값·인자·표현식을 연결한다: page, |
| 119 | 현재 구문에서 다음 값·인자·표현식을 연결한다: limit, |
| 120 | 객체·스키마·속성의 값을 지정한다: total: rows.length, |
| 121 | 객체·스키마·속성의 값을 지정한다: totalPages: Math.ceil(rows.length / limit), |
| 122 | 현재 구문에서 다음 값·인자·표현식을 연결한다: q, |
| 123 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 124 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 125 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/demo/course/repository.ts

[실행 파일](tsx_version/demo/course/repository.ts)

read는 현재 상태를 읽고 change는 원자적인 읽기·수정·쓰기를 제공한다. 드라이버별 잠금 또는 revision 비교가 동시 갱신의 유실을 막는다.

<!-- source:tsx_version/demo/course/repository.ts sha256:20739512abb6a63a59f943f4560d172e3c9cc0b0659ecb23ef0e73d7885caba9 -->
~~~ts
import type { State } from './domain';
export type Repository = { read(): Promise<State>; change<T>(fn: (state: State) => T): Promise<T> };
export { getSqliteRepository as getRepository } from './sqlite-repository';
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: type { State } from './domain'; |
| 2 | 다른 모듈이 공유할 데이터 구조를 선언한다: export type Repository = { read(): Promise<State>; change<T>(fn: (state: State) => T): Promise<T> }; |
| 3 | 현재 구문에서 다음 값·인자·표현식을 연결한다: export { getSqliteRepository as getRepository } from './sqlite-repository'; |

### tsx_version/demo/course/api.ts

[실행 파일](tsx_version/demo/course/api.ts)

요청의 URL·메서드에 맞는 분기를 고른 뒤 모델 검증·세션·소유권·저장을 연결한다. 반환값은 공통 v1 계약이며 모든 실패는 handle의 failure 경로로 모인다.

<!-- source:tsx_version/demo/course/api.ts sha256:3e04ac2d064ec505905c4e907291325e0e11ae34a7472d615a08f26eb41df48b -->
~~~ts
import {
  ApiError,
  identifier,
  listPosts,
  postView,
  publicUser,
  text,
} from "./domain";
import { getRepository } from "./repository";
import {
  authenticate,
  checkPassword,
  hashPassword,
  issueToken,
  protectOrigin,
  rateLimit,
  sessionCookie,
} from "./security";
import { failure, jsonBody, reply } from "./http";

export async function handle(
  request: Request,
  extension?: (request: Request) => Promise<Response | null>,
): Promise<Response> {
  const requestId =
    request.headers.get("x-request-id")?.slice(0, 100) || crypto.randomUUID();
  const started = performance.now();
  let response: Response;
  try {
    response = (await extension?.(request)) ?? (await dispatch(request));
  } catch (error) {
    response = failure(error, requestId);
  }
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  const origin = request.headers.get("origin");
  if (origin && origin === process.env.CORS_ORIGIN) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Request-Id",
    );
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
  }
  console.info(
    JSON.stringify({
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      status: response.status,
      ms: Math.round(performance.now() - started),
    }),
  );
  return response;
}
async function dispatch(request: Request): Promise<Response> {
  const url = new URL(request.url),
    method = request.method;
  const pathname = url.pathname.replace(/^\/api\/v1\//, "/api/"); // v1 별칭도 동일 계약을 쓴다.
  if (method === "OPTIONS") return new Response(null, { status: 204 });
  if (pathname === "/health" && method === "GET") {
    await (await getRepository()).read();
    return reply({ status: "ok" });
  }
  if (pathname === "/api/openapi" && method === "GET") {
    const { openapi } = await import("./openapi");
    return reply(openapi);
  }
  protectOrigin(request);
  const repo = await getRepository();
  if (
    /^\/api\/auth\/(signup|register|login)$/.test(pathname) &&
    method === "POST"
  ) {
    const body = await jsonBody(request);
    const email = text(body.email, "email", 254).toLowerCase(),
      password = text(body.password, "password", 72);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new ApiError(400, "VALIDATION_ERROR", "이메일 형식을 확인하세요.", {
        email: ["올바른 이메일이 필요합니다."],
      });
    rateLimit(`auth:${email}`, 15);
    if (pathname.endsWith("/login")) {
      const user = (await repo.read()).users.find((u) => u.email === email);
      if (!user || !(await checkPassword(password, user.passwordHash)))
        throw new ApiError(
          401,
          "INVALID_CREDENTIALS",
          "이메일 또는 비밀번호를 확인하세요.",
        );
      const token = issueToken(user.id);
      return reply(
        { data: { user: publicUser(user), accessToken: token } },
        200,
        { "Set-Cookie": sessionCookie(token) },
      );
    }
    if (password.length < 8 || Buffer.byteLength(password) > 72)
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "비밀번호는 8자 이상, UTF-8 72바이트 이하입니다.",
        { password: ["길이를 확인하세요."] },
      );
    const nickname = text(body.nickname ?? body.name, "nickname", 40),
      passwordHash = await hashPassword(password);
    const user = await repo.change((state) => {
      if (state.users.some((u) => u.email === email))
        throw new ApiError(409, "EMAIL_TAKEN", "이미 가입한 이메일입니다.");
      const user = { id: ++state.seq, email, nickname, passwordHash };
      state.users.push(user);
      return user;
    });
    return reply({ data: publicUser(user) }, 201);
  }
  if (pathname === "/api/auth/me" && method === "GET")
    return reply({
      data: publicUser(authenticate(request, await repo.read()).user),
    });
  if (pathname === "/api/auth/logout" && method === "POST") {
    await repo.change((state) => {
      const { jti } = authenticate(request, state);
      state.revoked.push(jti);
    });
    return new Response(null, {
      status: 204,
      headers: { "Set-Cookie": sessionCookie("", 0) },
    });
  }
  if (pathname === "/api/posts" && method === "GET")
    return reply(listPosts(await repo.read(), url.searchParams));
  if (pathname === "/api/posts" && method === "POST") {
    const body = await jsonBody(request),
      title = text(body.title, "title", 200),
      content = text(body.body, "body", 20_000),
      tags = validateTags(body.tags ?? []);
    const result = await repo.change((state) => {
      const { user } = authenticate(request, state),
        now = new Date().toISOString();
      const post = {
        id: ++state.seq,
        title,
        body: content,
        tags,
        authorId: user.id,
        createdAt: now,
        updatedAt: now,
      };
      state.posts.push(post);
      return postView(state, post);
    });
    return reply({ data: result }, 201, {
      Location: `/api/posts/${result.id}`,
    });
  }
  const postMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (postMatch) {
    const id = identifier(postMatch[1]);
    if (method === "GET") {
      const state = await repo.read(),
        post = state.posts.find((p) => p.id === id);
      if (!post) throw new ApiError(404, "NOT_FOUND", "게시글이 없습니다.");
      return reply({ data: postView(state, post) });
    }
    if (method === "PATCH" || method === "DELETE") {
      const body = method === "PATCH" ? await jsonBody(request) : {};
      const data = await repo.change((state) => {
        const { user } = authenticate(request, state),
          post = state.posts.find((p) => p.id === id);
        if (!post) throw new ApiError(404, "NOT_FOUND", "게시글이 없습니다.");
        if (post.authorId !== user.id)
          throw new ApiError(403, "FORBIDDEN", "작성자만 변경할 수 있습니다.");
        if (method === "DELETE") {
          state.posts = state.posts.filter((p) => p.id !== id);
          state.comments = state.comments.filter((c) => c.postId !== id);
          return null;
        }
        if (!["title", "body", "tags"].some((k) => k in body))
          throw new ApiError(
            400,
            "VALIDATION_ERROR",
            "수정할 필드가 필요합니다.",
          );
        if ("title" in body) post.title = text(body.title, "title", 200);
        if ("body" in body) post.body = text(body.body, "body", 20_000);
        if ("tags" in body) post.tags = validateTags(body.tags);
        post.updatedAt = new Date().toISOString();
        return postView(state, post);
      });
      return method === "DELETE"
        ? new Response(null, { status: 204 })
        : reply({ data });
    }
    throw new ApiError(
      405,
      "METHOD_NOT_ALLOWED",
      "지원하지 않는 메서드입니다.",
    );
  }
  const commentsMatch = pathname.match(/^\/api\/posts\/([^/]+)\/comments$/);
  if (commentsMatch) {
    const postId = identifier(commentsMatch[1]);
    if (method === "GET") {
      const state = await repo.read();
      if (!state.posts.some((p) => p.id === postId))
        throw new ApiError(404, "NOT_FOUND", "게시글이 없습니다.");
      return reply({
        data: state.comments
          .filter((c) => c.postId === postId)
          .map((c) => ({
            ...c,
            author: publicUser(state.users.find((u) => u.id === c.authorId)!),
          })),
      });
    }
    if (method === "POST") {
      const body = text((await jsonBody(request)).body, "body", 2000);
      const data = await repo.change((state) => {
        const { user } = authenticate(request, state);
        if (!state.posts.some((p) => p.id === postId))
          throw new ApiError(404, "NOT_FOUND", "게시글이 없습니다.");
        const comment = {
          id: ++state.seq,
          postId,
          authorId: user.id,
          body,
          createdAt: new Date().toISOString(),
        };
        state.comments.push(comment);
        return { ...comment, author: publicUser(user) };
      });
      return reply({ data }, 201);
    }
  }
  const commentMatch = pathname.match(/^\/api\/comments\/([^/]+)$/);
  if (commentMatch && method === "DELETE") {
    const id = identifier(commentMatch[1]);
    await repo.change((state) => {
      const { user } = authenticate(request, state),
        comment = state.comments.find((c) => c.id === id);
      if (!comment) throw new ApiError(404, "NOT_FOUND", "댓글이 없습니다.");
      if (comment.authorId !== user.id)
        throw new ApiError(403, "FORBIDDEN", "작성자만 삭제할 수 있습니다.");
      state.comments = state.comments.filter((c) => c.id !== id);
    });
    return new Response(null, { status: 204 });
  }
  if (pathname === "/api/hello" && method === "GET")
    return reply({ data: { message: "Hello, Next.js!" } });
  throw new ApiError(404, "NOT_FOUND", "없는 API 경로입니다.");
}
function validateTags(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 10 ||
    value.some((t) => typeof t !== "string" || !t.trim() || t.length > 30)
  )
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "태그는 30자 이하 문자열 10개까지입니다.",
      { tags: ["태그 형식을 확인하세요."] },
    );
  return [...new Set(value.map((t) => t.trim()))];
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { |
| 2 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ApiError, |
| 3 | 현재 구문에서 다음 값·인자·표현식을 연결한다: identifier, |
| 4 | 현재 구문에서 다음 값·인자·표현식을 연결한다: listPosts, |
| 5 | 현재 구문에서 다음 값·인자·표현식을 연결한다: postView, |
| 6 | 현재 구문에서 다음 값·인자·표현식을 연결한다: publicUser, |
| 7 | 현재 구문에서 다음 값·인자·표현식을 연결한다: text, |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: } from "./domain"; |
| 9 | 외부 모듈 또는 공용 함수·타입을 가져온다: { getRepository } from "./repository"; |
| 10 | 외부 모듈 또는 공용 함수·타입을 가져온다: { |
| 11 | 현재 구문에서 다음 값·인자·표현식을 연결한다: authenticate, |
| 12 | 현재 구문에서 다음 값·인자·표현식을 연결한다: checkPassword, |
| 13 | 현재 구문에서 다음 값·인자·표현식을 연결한다: hashPassword, |
| 14 | 현재 구문에서 다음 값·인자·표현식을 연결한다: issueToken, |
| 15 | 현재 구문에서 다음 값·인자·표현식을 연결한다: protectOrigin, |
| 16 | 현재 구문에서 다음 값·인자·표현식을 연결한다: rateLimit, |
| 17 | 현재 구문에서 다음 값·인자·표현식을 연결한다: sessionCookie, |
| 18 | 현재 구문에서 다음 값·인자·표현식을 연결한다: } from "./security"; |
| 19 | 외부 모듈 또는 공용 함수·타입을 가져온다: { failure, jsonBody, reply } from "./http"; |
| 21 | handle의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 22 | 객체·스키마·속성의 값을 지정한다: request: Request, |
| 23 | 현재 구문에서 다음 값·인자·표현식을 연결한다: extension?: (request: Request) => Promise<Response \| null>, |
| 24 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ): Promise<Response> { |
| 25 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const requestId = |
| 26 | 현재 구문에서 다음 값·인자·표현식을 연결한다: request.headers.get("x-request-id")?.slice(0, 100) \|\| crypto.randomUUID(); |
| 27 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const started = performance.now(); |
| 28 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let response: Response; |
| 29 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 30 | 현재 구문에서 다음 값·인자·표현식을 연결한다: response = (await extension?.(request)) ?? (await dispatch(request)); |
| 31 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 32 | 현재 구문에서 다음 값·인자·표현식을 연결한다: response = failure(error, requestId); |
| 33 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 34 | 현재 구문에서 다음 값·인자·표현식을 연결한다: response.headers.set("X-Request-Id", requestId); |
| 35 | 현재 구문에서 다음 값·인자·표현식을 연결한다: response.headers.set("Cache-Control", "no-store"); |
| 36 | 현재 구문에서 다음 값·인자·표현식을 연결한다: response.headers.set("X-Content-Type-Options", "nosniff"); |
| 37 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const origin = request.headers.get("origin"); |
| 38 | 입력·상태 조건에 따라 처리 경로를 고른다: if (origin && origin === process.env.CORS_ORIGIN) { |
| 39 | 현재 구문에서 다음 값·인자·표현식을 연결한다: response.headers.set("Access-Control-Allow-Origin", origin); |
| 40 | 현재 구문에서 다음 값·인자·표현식을 연결한다: response.headers.set("Vary", "Origin"); |
| 41 | 현재 구문에서 다음 값·인자·표현식을 연결한다: response.headers.set( |
| 42 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "Access-Control-Allow-Headers", |
| 43 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "Content-Type, Authorization, X-Request-Id", |
| 44 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 45 | 현재 구문에서 다음 값·인자·표현식을 연결한다: response.headers.set( |
| 46 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "Access-Control-Allow-Methods", |
| 47 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "GET, POST, PATCH, DELETE, OPTIONS", |
| 48 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 49 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 50 | 현재 구문에서 다음 값·인자·표현식을 연결한다: console.info( |
| 51 | 현재 구문에서 다음 값·인자·표현식을 연결한다: JSON.stringify({ |
| 52 | 현재 구문에서 다음 값·인자·표현식을 연결한다: requestId, |
| 53 | 객체·스키마·속성의 값을 지정한다: method: request.method, |
| 54 | 객체·스키마·속성의 값을 지정한다: path: new URL(request.url).pathname, |
| 55 | 객체·스키마·속성의 값을 지정한다: status: response.status, |
| 56 | 객체·스키마·속성의 값을 지정한다: ms: Math.round(performance.now() - started), |
| 57 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 58 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 59 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return response; |
| 60 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 61 | dispatch의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 62 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const url = new URL(request.url), |
| 63 | 현재 구문에서 다음 값·인자·표현식을 연결한다: method = request.method; |
| 64 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const pathname = url.pathname.replace(/^\/api\/v1\//, "/api/"); // v1 별칭도 동일 계약을 쓴다. |
| 65 | 입력·상태 조건에 따라 처리 경로를 고른다: if (method === "OPTIONS") return new Response(null, { status: 204 }); |
| 66 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/health" && method === "GET") { |
| 67 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await (await getRepository()).read(); |
| 68 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ status: "ok" }); |
| 69 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 70 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/openapi" && method === "GET") { |
| 71 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const { openapi } = await import("./openapi"); |
| 72 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply(openapi); |
| 73 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 74 | 쿠키 쓰기 요청의 출처를 확인해 CSRF 경계를 적용한다. |
| 75 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const repo = await getRepository(); |
| 76 | 입력·상태 조건에 따라 처리 경로를 고른다: if ( |
| 77 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: /^\/api\/auth\/(signup\|register\|login)$/.test(pathname) && |
| 78 | 현재 구문에서 다음 값·인자·표현식을 연결한다: method === "POST" |
| 79 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ) { |
| 80 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const body = await jsonBody(request); |
| 81 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const email = text(body.email, "email", 254).toLowerCase(), |
| 82 | 현재 구문에서 다음 값·인자·표현식을 연결한다: password = text(body.password, "password", 72); |
| 83 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) |
| 84 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(400, "VALIDATION_ERROR", "이메일 형식을 확인하세요.", { |
| 85 | 객체·스키마·속성의 값을 지정한다: email: ["올바른 이메일이 필요합니다."], |
| 86 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 87 | 현재 구문에서 다음 값·인자·표현식을 연결한다: rateLimit(ˋauth:${email}ˋ, 15); |
| 88 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname.endsWith("/login")) { |
| 89 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const user = (await repo.read()).users.find((u) => u.email === email); |
| 90 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!user \|\| !(await checkPassword(password, user.passwordHash))) |
| 91 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 92 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 401, |
| 93 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "INVALID_CREDENTIALS", |
| 94 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "이메일 또는 비밀번호를 확인하세요.", |
| 95 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 96 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const token = issueToken(user.id); |
| 97 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply( |
| 98 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { data: { user: publicUser(user), accessToken: token } }, |
| 99 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 200, |
| 100 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { "Set-Cookie": sessionCookie(token) }, |
| 101 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 102 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 103 | 입력·상태 조건에 따라 처리 경로를 고른다: if (password.length < 8 \|\| Buffer.byteLength(password) > 72) |
| 104 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 105 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 400, |
| 106 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "VALIDATION_ERROR", |
| 107 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "비밀번호는 8자 이상, UTF-8 72바이트 이하입니다.", |
| 108 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { password: ["길이를 확인하세요."] }, |
| 109 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 110 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const nickname = text(body.nickname ?? body.name, "nickname", 40), |
| 111 | 현재 구문에서 다음 값·인자·표현식을 연결한다: passwordHash = await hashPassword(password); |
| 112 | Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다. |
| 113 | 입력·상태 조건에 따라 처리 경로를 고른다: if (state.users.some((u) => u.email === email)) |
| 114 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(409, "EMAIL_TAKEN", "이미 가입한 이메일입니다."); |
| 115 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const user = { id: ++state.seq, email, nickname, passwordHash }; |
| 116 | 현재 구문에서 다음 값·인자·표현식을 연결한다: state.users.push(user); |
| 117 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return user; |
| 118 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 119 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ data: publicUser(user) }, 201); |
| 120 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 121 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/auth/me" && method === "GET") |
| 122 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ |
| 123 | 현재 요청의 토큰·서명·만료·로그아웃 상태와 사용자 존재를 확인한다. |
| 124 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 125 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/auth/logout" && method === "POST") { |
| 126 | Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다. |
| 127 | 현재 요청의 토큰·서명·만료·로그아웃 상태와 사용자 존재를 확인한다. |
| 128 | 현재 구문에서 다음 값·인자·표현식을 연결한다: state.revoked.push(jti); |
| 129 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 130 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return new Response(null, { |
| 131 | 객체·스키마·속성의 값을 지정한다: status: 204, |
| 132 | 객체·스키마·속성의 값을 지정한다: headers: { "Set-Cookie": sessionCookie("", 0) }, |
| 133 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 134 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 135 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/posts" && method === "GET") |
| 136 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply(listPosts(await repo.read(), url.searchParams)); |
| 137 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/posts" && method === "POST") { |
| 138 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const body = await jsonBody(request), |
| 139 | 현재 구문에서 다음 값·인자·표현식을 연결한다: title = text(body.title, "title", 200), |
| 140 | 현재 구문에서 다음 값·인자·표현식을 연결한다: content = text(body.body, "body", 20_000), |
| 141 | 현재 구문에서 다음 값·인자·표현식을 연결한다: tags = validateTags(body.tags ?? []); |
| 142 | Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다. |
| 143 | 현재 요청의 토큰·서명·만료·로그아웃 상태와 사용자 존재를 확인한다. |
| 144 | 현재 구문에서 다음 값·인자·표현식을 연결한다: now = new Date().toISOString(); |
| 145 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const post = { |
| 146 | 객체·스키마·속성의 값을 지정한다: id: ++state.seq, |
| 147 | 현재 구문에서 다음 값·인자·표현식을 연결한다: title, |
| 148 | 객체·스키마·속성의 값을 지정한다: body: content, |
| 149 | 현재 구문에서 다음 값·인자·표현식을 연결한다: tags, |
| 150 | 객체·스키마·속성의 값을 지정한다: authorId: user.id, |
| 151 | 객체·스키마·속성의 값을 지정한다: createdAt: now, |
| 152 | 객체·스키마·속성의 값을 지정한다: updatedAt: now, |
| 153 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 154 | 현재 구문에서 다음 값·인자·표현식을 연결한다: state.posts.push(post); |
| 155 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return postView(state, post); |
| 156 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 157 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ data: result }, 201, { |
| 158 | 객체·스키마·속성의 값을 지정한다: Location: ˋ/api/posts/${result.id}ˋ, |
| 159 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 160 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 161 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const postMatch = pathname.match(/^\/api\/posts\/([^/]+)$/); |
| 162 | 입력·상태 조건에 따라 처리 경로를 고른다: if (postMatch) { |
| 163 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const id = identifier(postMatch[1]); |
| 164 | 입력·상태 조건에 따라 처리 경로를 고른다: if (method === "GET") { |
| 165 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const state = await repo.read(), |
| 166 | 현재 구문에서 다음 값·인자·표현식을 연결한다: post = state.posts.find((p) => p.id === id); |
| 167 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: if (!post) throw new ApiError(404, "NOT_FOUND", "게시글이 없습니다."); |
| 168 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ data: postView(state, post) }); |
| 169 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 170 | 입력·상태 조건에 따라 처리 경로를 고른다: if (method === "PATCH" \|\| method === "DELETE") { |
| 171 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const body = method === "PATCH" ? await jsonBody(request) : {}; |
| 172 | Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다. |
| 173 | 현재 요청의 토큰·서명·만료·로그아웃 상태와 사용자 존재를 확인한다. |
| 174 | 현재 구문에서 다음 값·인자·표현식을 연결한다: post = state.posts.find((p) => p.id === id); |
| 175 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: if (!post) throw new ApiError(404, "NOT_FOUND", "게시글이 없습니다."); |
| 176 | 입력·상태 조건에 따라 처리 경로를 고른다: if (post.authorId !== user.id) |
| 177 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(403, "FORBIDDEN", "작성자만 변경할 수 있습니다."); |
| 178 | 입력·상태 조건에 따라 처리 경로를 고른다: if (method === "DELETE") { |
| 179 | 현재 구문에서 다음 값·인자·표현식을 연결한다: state.posts = state.posts.filter((p) => p.id !== id); |
| 180 | 현재 구문에서 다음 값·인자·표현식을 연결한다: state.comments = state.comments.filter((c) => c.postId !== id); |
| 181 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return null; |
| 182 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 183 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!["title", "body", "tags"].some((k) => k in body)) |
| 184 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 185 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 400, |
| 186 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "VALIDATION_ERROR", |
| 187 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "수정할 필드가 필요합니다.", |
| 188 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 189 | 입력·상태 조건에 따라 처리 경로를 고른다: if ("title" in body) post.title = text(body.title, "title", 200); |
| 190 | 입력·상태 조건에 따라 처리 경로를 고른다: if ("body" in body) post.body = text(body.body, "body", 20_000); |
| 191 | 입력·상태 조건에 따라 처리 경로를 고른다: if ("tags" in body) post.tags = validateTags(body.tags); |
| 192 | 현재 구문에서 다음 값·인자·표현식을 연결한다: post.updatedAt = new Date().toISOString(); |
| 193 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return postView(state, post); |
| 194 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 195 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return method === "DELETE" |
| 196 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ? new Response(null, { status: 204 }) |
| 197 | 현재 구문에서 다음 값·인자·표현식을 연결한다: : reply({ data }); |
| 198 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 199 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 200 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 405, |
| 201 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "METHOD_NOT_ALLOWED", |
| 202 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "지원하지 않는 메서드입니다.", |
| 203 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 204 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 205 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const commentsMatch = pathname.match(/^\/api\/posts\/([^/]+)\/comments$/); |
| 206 | 입력·상태 조건에 따라 처리 경로를 고른다: if (commentsMatch) { |
| 207 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const postId = identifier(commentsMatch[1]); |
| 208 | 입력·상태 조건에 따라 처리 경로를 고른다: if (method === "GET") { |
| 209 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const state = await repo.read(); |
| 210 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!state.posts.some((p) => p.id === postId)) |
| 211 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(404, "NOT_FOUND", "게시글이 없습니다."); |
| 212 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ |
| 213 | 객체·스키마·속성의 값을 지정한다: data: state.comments |
| 214 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .filter((c) => c.postId === postId) |
| 215 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .map((c) => ({ |
| 216 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ...c, |
| 217 | 객체·스키마·속성의 값을 지정한다: author: publicUser(state.users.find((u) => u.id === c.authorId)!), |
| 218 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 219 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 220 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 221 | 입력·상태 조건에 따라 처리 경로를 고른다: if (method === "POST") { |
| 222 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const body = text((await jsonBody(request)).body, "body", 2000); |
| 223 | Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다. |
| 224 | 현재 요청의 토큰·서명·만료·로그아웃 상태와 사용자 존재를 확인한다. |
| 225 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!state.posts.some((p) => p.id === postId)) |
| 226 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(404, "NOT_FOUND", "게시글이 없습니다."); |
| 227 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const comment = { |
| 228 | 객체·스키마·속성의 값을 지정한다: id: ++state.seq, |
| 229 | 현재 구문에서 다음 값·인자·표현식을 연결한다: postId, |
| 230 | 객체·스키마·속성의 값을 지정한다: authorId: user.id, |
| 231 | 현재 구문에서 다음 값·인자·표현식을 연결한다: body, |
| 232 | 객체·스키마·속성의 값을 지정한다: createdAt: new Date().toISOString(), |
| 233 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 234 | 현재 구문에서 다음 값·인자·표현식을 연결한다: state.comments.push(comment); |
| 235 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return { ...comment, author: publicUser(user) }; |
| 236 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 237 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ data }, 201); |
| 238 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 239 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 240 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const commentMatch = pathname.match(/^\/api\/comments\/([^/]+)$/); |
| 241 | 입력·상태 조건에 따라 처리 경로를 고른다: if (commentMatch && method === "DELETE") { |
| 242 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const id = identifier(commentMatch[1]); |
| 243 | Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다. |
| 244 | 현재 요청의 토큰·서명·만료·로그아웃 상태와 사용자 존재를 확인한다. |
| 245 | 현재 구문에서 다음 값·인자·표현식을 연결한다: comment = state.comments.find((c) => c.id === id); |
| 246 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: if (!comment) throw new ApiError(404, "NOT_FOUND", "댓글이 없습니다."); |
| 247 | 입력·상태 조건에 따라 처리 경로를 고른다: if (comment.authorId !== user.id) |
| 248 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(403, "FORBIDDEN", "작성자만 삭제할 수 있습니다."); |
| 249 | 현재 구문에서 다음 값·인자·표현식을 연결한다: state.comments = state.comments.filter((c) => c.id !== id); |
| 250 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 251 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return new Response(null, { status: 204 }); |
| 252 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 253 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/hello" && method === "GET") |
| 254 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ data: { message: "Hello, Next.js!" } }); |
| 255 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(404, "NOT_FOUND", "없는 API 경로입니다."); |
| 256 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 257 | validateTags의 입력·반환 경계를 정의한다. |
| 258 | 입력·상태 조건에 따라 처리 경로를 고른다: if ( |
| 259 | 현재 구문에서 다음 값·인자·표현식을 연결한다: !Array.isArray(value) \|\| |
| 260 | 현재 구문에서 다음 값·인자·표현식을 연결한다: value.length > 10 \|\| |
| 261 | 현재 구문에서 다음 값·인자·표현식을 연결한다: value.some((t) => typeof t !== "string" \|\| !t.trim() \|\| t.length > 30) |
| 262 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 263 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 264 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 400, |
| 265 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "VALIDATION_ERROR", |
| 266 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "태그는 30자 이하 문자열 10개까지입니다.", |
| 267 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { tags: ["태그 형식을 확인하세요."] }, |
| 268 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 269 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return [...new Set(value.map((t) => t.trim()))]; |
| 270 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/demo/lib/external-posts.ts

[실행 파일](tsx_version/demo/lib/external-posts.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/lib/external-posts.ts sha256:a093ef20505625cbf60c753895df8ce2d830a523130bff4c13ad8a5be1207893 -->
~~~ts
export type ExternalPost = {
  id: number;
  title: string;
};

export async function fetchExternalPosts(): Promise<ExternalPost[]> {
  const response = await fetch("https://jsonplaceholder.typicode.com/posts?_limit=3", {
    next: { revalidate: 60 },
  });
  if (!response.ok) {
    throw new Error("외부 API를 읽지 못했습니다.");
  }
  return response.json();
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 다른 모듈이 공유할 데이터 구조를 선언한다: export type ExternalPost = { |
| 2 | 객체·스키마·속성의 값을 지정한다: id: number; |
| 3 | 객체·스키마·속성의 값을 지정한다: title: string; |
| 4 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 6 | fetchExternalPosts의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 7 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: const response = await fetch("https://jsonplaceholder.typicode.com/posts?_limit=3", { |
| 8 | 객체·스키마·속성의 값을 지정한다: next: { revalidate: 60 }, |
| 9 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 10 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!response.ok) { |
| 11 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: throw new Error("외부 API를 읽지 못했습니다."); |
| 12 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 13 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return response.json(); |
| 14 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/demo/course/sqlite-repository.ts

[실행 파일](tsx_version/demo/course/sqlite-repository.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/course/sqlite-repository.ts sha256:e21f08c68edff20eb6dadd656f977cd124362404b1e2ac63b717cd93b7c6703b -->
~~~ts
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { emptyState, type State } from "./domain";
import type { Repository } from "./repository";
let repository: Repository | undefined;
export async function getSqliteRepository(): Promise<Repository> {
  if (repository) return repository;
  const file = path.resolve(
    /* turbopackIgnore: true */ process.env.COURSE_DB_PATH ?? "data/course.db",
  );
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS course_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL)",
  );
  db.prepare("INSERT OR IGNORE INTO course_state VALUES (1, ?)").run(
    JSON.stringify(emptyState()),
  );
  const read = () =>
    JSON.parse(
      (
        db.prepare("SELECT data FROM course_state WHERE id=1").get() as {
          data: string;
        }
      ).data,
    ) as State;
  repository = {
    read: async () => read(),
    change: async (fn) => {
      db.exec("BEGIN IMMEDIATE");
      try {
        const state = read(),
          result = fn(state);
        db.prepare("UPDATE course_state SET data=? WHERE id=1").run(
          JSON.stringify(state),
        );
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return repository;
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { DatabaseSync } from "node:sqlite"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { mkdirSync } from "node:fs"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: path from "node:path"; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: { emptyState, type State } from "./domain"; |
| 5 | 외부 모듈 또는 공용 함수·타입을 가져온다: type { Repository } from "./repository"; |
| 6 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let repository: Repository \| undefined; |
| 7 | getSqliteRepository의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 8 | 입력·상태 조건에 따라 처리 경로를 고른다: if (repository) return repository; |
| 9 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const file = path.resolve( |
| 10 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: /* turbopackIgnore: true */ process.env.COURSE_DB_PATH ?? "data/course.db", |
| 11 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 12 | 현재 구문에서 다음 값·인자·표현식을 연결한다: mkdirSync(path.dirname(file), { recursive: true }); |
| 13 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const db = new DatabaseSync(file); |
| 14 | 현재 구문에서 다음 값·인자·표현식을 연결한다: db.exec( |
| 15 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS course_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL)", |
| 16 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 17 | DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: db.prepare("INSERT OR IGNORE INTO course_state VALUES (1, ?)").run( |
| 18 | 현재 구문에서 다음 값·인자·표현식을 연결한다: JSON.stringify(emptyState()), |
| 19 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 20 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const read = () => |
| 21 | 현재 구문에서 다음 값·인자·표현식을 연결한다: JSON.parse( |
| 22 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 23 | DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: db.prepare("SELECT data FROM course_state WHERE id=1").get() as { |
| 24 | 객체·스키마·속성의 값을 지정한다: data: string; |
| 25 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 26 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).data, |
| 27 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ) as State; |
| 28 | 현재 구문에서 다음 값·인자·표현식을 연결한다: repository = { |
| 29 | 객체·스키마·속성의 값을 지정한다: read: async () => read(), |
| 30 | 객체·스키마·속성의 값을 지정한다: change: async (fn) => { |
| 31 | DB 트랜잭션을 시작한다. SQLite는 쓰기 잠금을, 서버 SQL은 행 잠금을 사용한다. |
| 32 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 33 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const state = read(), |
| 34 | 현재 구문에서 다음 값·인자·표현식을 연결한다: result = fn(state); |
| 35 | DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: db.prepare("UPDATE course_state SET data=? WHERE id=1").run( |
| 36 | 현재 구문에서 다음 값·인자·표현식을 연결한다: JSON.stringify(state), |
| 37 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 38 | 검증을 마친 데이터 변경을 트랜잭션으로 확정한다. |
| 39 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return result; |
| 40 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 41 | 실패한 트랜잭션의 데이터 변경을 되돌린다. |
| 42 | 현재 구문에서 다음 값·인자·표현식을 연결한다: throw error; |
| 43 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 44 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 45 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 46 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return repository; |
| 47 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/demo/course/server-page.tsx

[실행 파일](tsx_version/demo/course/server-page.tsx)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/course/server-page.tsx sha256:aacf49121f7ba7084fb0edc4d18ce175d399344e02334fce77876bc85b7a1c62 -->
~~~tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError } from './domain';
import { authenticate, COOKIE } from './security';
import { getRepository } from './repository';
import { addQuickPost } from './note-action';
// 서버 컴포넌트가 자기 API를 다시 fetch하지 않고 저장소를 직접 읽는 예제다.
export async function ServerPage() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) redirect('/board');
  const state = await (await getRepository()).read();
  let user;
  try { user = authenticate(new Request('http://internal/private-lab', { headers: { cookie: `${COOKIE}=${token}` } }), state).user; }
  catch (error) { if (error instanceof ApiError && error.status === 401) redirect('/board'); throw error; }
  const posts = state.posts.filter(post => post.authorId === user.id);
  return <section className="course"><h1>{user.nickname}님의 서버 실습</h1><ul>{posts.map(post => <li key={post.id}>{post.title}</li>)}</ul><form action={addQuickPost}><label>제목<input name="title" required maxLength={200} /></label><label>본문<textarea name="body" required maxLength={20000} /></label><button>Server Action으로 등록</button></form></section>;
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { cookies } from 'next/headers'; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { redirect } from 'next/navigation'; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { ApiError } from './domain'; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: { authenticate, COOKIE } from './security'; |
| 5 | 외부 모듈 또는 공용 함수·타입을 가져온다: { getRepository } from './repository'; |
| 6 | 외부 모듈 또는 공용 함수·타입을 가져온다: { addQuickPost } from './note-action'; |
| 7 | 주석: 서버 컴포넌트가 자기 API를 다시 fetch하지 않고 저장소를 직접 읽는 예제다. |
| 8 | ServerPage의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 9 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const token = (await cookies()).get(COOKIE)?.value; |
| 10 | 인증 또는 저장 결과에 따라 다음 화면으로 이동한다. |
| 11 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const state = await (await getRepository()).read(); |
| 12 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let user; |
| 13 | 현재 요청의 토큰·서명·만료·로그아웃 상태와 사용자 존재를 확인한다. |
| 14 | 인증 또는 저장 결과에 따라 다음 화면으로 이동한다. |
| 15 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const posts = state.posts.filter(post => post.authorId === user.id); |
| 16 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return <section className="course"><h1>{user.nickname}님의 서버 실습</h1><ul>{posts.map(post => <li key={post.id}>{post.title}</li>)}</ul><form action={addQuickPost}><label>제목<input name="title" required maxLength={200} /></label><label>본문<textarea name="body" required maxLength={20000} /></label><button>Server Action으로 등록</button></form></section>; |
| 17 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

## ④ 🔗 연동 포인트

서버 컴포넌트는 Repository를 직접 읽을 수 있고 브라우저는 Route Handler로 접근한다. 외부 API는 서버 fetch와 timeout을 사용하며 DB 연결 문자열·서비스 키는 .env.local에만 둔다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| SQLITE_BUSY | 쓰기 잠금 경합 | 짧은 트랜잭션·busy_timeout, 대량 데이터는 정규화 |
| 목록 meta 누락 | 이전 JSON 응답 형식 사용 | data/meta 계약과 새 /board 사용 |
| 파일 DB 유실 | 임시 배포 파일시스템 | 영속 볼륨 또는 study11 서버 DB 사용 |

## ⑥ 직접 해보기

1. 글 12개를 만들고 page=2와 limit=10의 결과를 확인한다.
2. 제목 일부 검색과 -commentCount 정렬을 확인한다.
3. 서버를 재시작하고 같은 id의 글을 다시 조회한다.

## ⑦ ☐ 체크리스트

- [ ] 데이터 패칭 (서버에서 DB vs 외부 API)
- [ ] 목록·상세·등록·수정·삭제와 댓글을 v1 계약으로 실행했다.
- [ ] DB 연결 정보를 환경변수로 분리했다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study7](study7.md)에서 비밀번호 해시와 JWT 쿠키를 사용하고 API에서 세션·소유권을 검증한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
