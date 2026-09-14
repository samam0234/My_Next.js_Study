# study5 — 실습 5: 데이터 페치와 게시판 CRUD

Notion의 "데이터 페치 (서버에서 DB vs 외부 API)"를 코드로 확인합니다.
미니 DB는 SQLite 대신 **JSON 파일**입니다. 나중에 Nest/Django로 분리할 때는 `lib/posts-store`의 구현만 HTTP 호출로 바꾸면 됩니다.

---

## 1. 두 위치

| 위치 | 이 실습 | 언제 |
|---|---|---|
| 서버 컴포넌트 → 파일/DB | `listPosts()`가 `data/posts.json`을 읽음 | 이 앱의 본문. 비밀키·왕복이 없음 |
| 서버 컴포넌트 → 외부 API | `fetch("https://jsonplaceholder.typicode.com/posts?_limit=3")` | 남의 서버, 또는 나중에 Nest |
| 브라우저 → Route Handler | `PostForm`이 `fetch("/api/posts")` | 클라이언트 컴포넌트가 글을 쓸 때 |

목록 페이지는 API를 거치지 않습니다. 서버가 파일을 읽고 HTML을 만듭니다. curl으로 JSON이 필요하면 `GET /api/posts`를 씁니다. 같은 `listPosts()`입니다.

외부 `fetch`에는 `{ next: { revalidate: 60 } }`를 붙였습니다. 60초 동안은 서버가 결과를 재사용합니다. 브라우저 캐시가 아닙니다.

---

## 2. JSON 저장소

```
lib/posts-store.ts   읽기/쓰기 함수 (서버 전용. fs)
data/posts.json      실제 데이터
```

`createPost` / `updatePost` / `deletePost`가 파일을 고칩니다. 서버를 재시작해도 글이 남습니다. Git에는 시드 두 건만 커밋합니다.

이 모듈은 브라우저에서 import하면 안 됩니다. `fs`가 없습니다. Route Handler와 서버 페이지/Server Action만 사용합니다.

---

## 3. HTTP 계약

| 메서드 | URL | 역할 |
|---|---|---|
| GET | `/api/posts` | 목록 |
| POST | `/api/posts` | 등록 `{ title, body }` |
| GET | `/api/posts/:id` | 상세 |
| PATCH | `/api/posts/:id` | 수정 |
| DELETE | `/api/posts/:id` | 삭제 |

화면:

- `/posts/new` — 클라이언트 폼이 POST
- `/posts/[id]/edit` — PATCH
- 상세의 삭제 버튼 — DELETE 후 `/posts`로 이동

`router.refresh()`를 호출하는 이유: App Router는 서버 컴포넌트 결과를 캐시합니다. API만 성공하고 목록을 안 고치면 이전 HTML이 남습니다.

---

## 4. 확인

```powershell
curl.exe -s http://localhost:3000/api/posts
curl.exe -s -X POST http://localhost:3000/api/posts -H "Content-Type: application/json" -d "{\"title\":\"from curl\",\"body\":\"hello\"}"
```

브라우저에서 `/posts` → 새 글 → 상세 → 수정 → 삭제.

목록 하단 "외부 API" 칸에 jsonplaceholder 글 제목 세 개가 보이면 서버 `fetch`가 된 것입니다.

다음: [study6.md](study6.md) — JWT를 HttpOnly 쿠키에 넣고 회원가입/로그인을 붙입니다.
