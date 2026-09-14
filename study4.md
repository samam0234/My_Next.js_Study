# study4 — 실습 4: 특수 파일과 Route Handler

Notion 학습 목표의 `loading` / `error` / `not-found` 와 `app/api`를 한 번에 붙입니다.

---

## 1. 같은 폴더에 나란히 두는 파일

```
app/posts/
├─ layout.tsx     공통 껍데기 (study2)
├─ page.tsx       목록
├─ loading.tsx    page가 await하는 동안
├─ error.tsx      page가 throw하면
├─ not-found.tsx  notFound() 호출 시
└─ [id]/page.tsx  상세
```

Next가 React의 Suspense / Error Boundary를 이 파일 이름으로 연결합니다.

### loading

`/posts?slow=1` 은 서버에서 1.5초를 기다립니다. 그 동안 `loading.tsx`의 스켈레톤이 먼저 내려옵니다. 스트리밍입니다. 헤더(루트 레이아웃)는 이미 그려져 있습니다.

### error

`error.tsx`는 **반드시** `"use client"`입니다. 에러 경계가 브라우저에서 복구 버튼을 눌러야 하기 때문입니다.

`/posts?boom=1` 이 `throw new Error(...)`를 일으킵니다. "다시 시도"는 `reset()`입니다.

### not-found

`/posts/999`는 상세 페이지가 `notFound()`를 호출합니다. 가까운 `app/posts/not-found.tsx`가 기본 404 대신 뜹니다.

---

## 2. Route Handler

페이지가 아닌 HTTP 엔드포인트입니다. Nest 컨트롤러 메서드와 같습니다.

```
app/api/hello/route.ts   →  GET /api/hello
app/api/posts/route.ts   →  GET /api/posts
```

`page`와 `route`는 같은 폴더에 둘 수 없습니다. API는 `app/api` 아래로 분리합니다.

```ts
import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ message: "hello from Route Handler" })
}
```

`POST` `PATCH` `DELETE`도 같은 파일에 export하면 됩니다. 쓰기는 `study5`에서 붙입니다.

서버 컴포넌트가 목록을 그릴 때는 `/api/posts`를 다시 fetch할 필요가 없습니다. 같은 `SAMPLE_POSTS`를 import하면 됩니다. API는 **다른 클라이언트**(curl, 모바일, 나중에 분리할 Nest 대체)를 위한 문입니다.

---

## 3. 확인

```powershell
curl.exe -s http://localhost:3000/api/hello
curl.exe -s http://localhost:3000/api/posts
```

브라우저:

- `/posts?slow=1` — 스켈레톤 후 목록
- `/posts?boom=1` — 빨간 에러 UI
- `/posts/999` — 커스텀 "글을 찾을 수 없습니다"

다음: [study5.md](study5.md) — JSON 파일에 글을 저장하고 서버 페치와 CRUD를 연결합니다.
