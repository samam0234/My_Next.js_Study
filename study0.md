# study0 — Next.js 기초 이론

이 문서는 실습 없이 개념만 정리합니다.
[React 학습](../../frontend_study/react/study0.md)과 [NestJS 학습](../../backend_study/nest.js/study0.md)을 이미 봤다면, Next.js는 그 둘을 **한 프로젝트에서 붙인 엔진**이라고 생각하면 출발점이 맞습니다.

Notion 학습 목표:

```
- [ ] App Router 디렉터리 구조
- [ ] Server Component vs Client Component
- [ ] page.tsx / layout.tsx / loading.tsx / error.tsx
- [ ] Route Handler (app/api)
- [ ] 데이터 페치 (서버에서 DB vs 외부 API)
- [ ] 인증 (쿠키 / NextAuth 또는 직접 JWT)
- [ ] 환경 변수, 배포
```

이후 `study1`부터 위 항목을 하나씩 코드로 확인합니다. JSX(`.js`/`.jsx`)와 TSX(`.ts`/`.tsx`) 버전을 같이 만듭니다. 이론 자체는 동일하고, 차이는 타입 어노테이션과 파일 확장자뿐입니다.

---

## 1. Next.js란?

### 한 줄 정의

**React UI + 파일 기반 라우팅 + 서버 렌더링 + API**를 한 저장소에서 처리하는 풀스택 프레임워크입니다.

Vite + React로 만든 SPA는 "화면"만 담당합니다. 데이터와 로그인은 Django/FastAPI/Nest/Spring 같은 별도 서버가 필요합니다. Next.js는 그 경계를 기본값으로 지웁니다. 같은 폴더에 페이지도 두고, `app/api`에 REST 비슷한 엔드포인트도 둘 수 있습니다.

### 왜 그냥 React SPA를 안 쓰고 Next.js를 쓸까?

| | Vite + React SPA | Next.js |
|---|---|---|
| 첫 화면 HTML | `index.html` 껍데기 + JS 번들. 브라우저는 JS를 받은 뒤에야 내용을 그림 | 서버가 이미 내용이 채워진 HTML을 내려줄 수 있음 |
| 라우팅 | `react-router-dom`이 브라우저에서 URL을 가로챔 | 폴더/파일 이름이 URL이 됨 (서버도 URL을 앎) |
| 데이터 | 마운트 후 `fetch` / axios (클라이언트가 API를 때림) | 서버 컴포넌트에서 DB/API를 직접 읽고 HTML에 실어 보냄 |
| 백엔드 | CORS, 별도 포트, 별도 배포 | 같은 프로젝트의 Route Handler / Server Action |
| SEO / 공유 미리보기 | JS 실행 전엔 내용이 비어 있음 | 서버 HTML + `metadata` API |

Notion에 적힌 차이 그대로입니다.

- **SPA**: 브라우저가 모든 라우팅·데이터를 처리
- **Next**: 서버가 HTML/데이터 일부를 먼저 준비

### Nest/Django와는 무엇이 다른가

Next.js의 `app/api`는 Nest 컨트롤러를 대체할 수 있을 만큼은 됩니다. 다만 Next는 **페이지를 그리는 일**이 본업이고, Nest는 **API 계층을 크게 키우는 일**이 본업입니다.

그래서 Notion 예제처럼 **게시판 + 로그인을 Next.js 하나로 합쳤다가**, 트래픽이나 팀 분리가 필요해지면 Nest/Django API로 백엔드만 떼는 경로가 자연스럽습니다. 이 강의의 `demo/`는 "한 프로젝트로 합친 상태"를 끝까지 갑니다. 분리 자체는  copilot 과제가 아닙니다.

---

## 2. 렌더링 모델을 먼저 구분한다

같은 "페이지를 보여 준다"에도 시점이 다릅니다.

| 이름 | 언제 HTML이 만들어지나 | 이 강의에서 |
|---|---|---|
| **CSR** (Client Side Rendering) | 브라우저가 JS를 실행한 뒤 | `"use client"` 컴포넌트, SPA와 동일 |
| **SSR** (Server Side Rendering) | **요청이 올 때마다** 서버가 HTML 생성 | 동적 게시글, 로그인된 헤더 |
| **SSG** (Static Site Generation) | **빌드 시점**에 HTML 생성 | 소개 페이지, 바뀌지 않는 문서 |
| **RSC** (React Server Components) | 서버에서 컴포넌트 함수가 실행되고, 결과는 클라이언트로 직렬화 | App Router의 **기본값** |

핵심: App Router에서 `page.tsx`/`page.jsx`는 **기본적으로 서버 컴포넌트**입니다. `useState`를 쓰려면 그 파일(또는 자식)에 `"use client"`를 명시해야 합니다.

Vite React 앱의 `App.tsx`는 전부 클라이언트입니다. Next.js는 반대로 **서버가 기본, 클라이언트는 옵트인**입니다. 이 한 줄이 이후 모든 실습의 기준입니다.

---

## 3. App Router 디렉터리 구조

Next.js 13 이후 기본은 **App Router**입니다. 구버전 자료의 `pages/` 폴더(Pages Router)는 이 강의에서 쓰지 않습니다.

```
app/
├─ layout.tsx          ← 모든 페이지를 감싸는 루트 레이아웃 (html, body)
├─ page.tsx            ← URL `/`
├─ loading.tsx         ← 해당 세그먼트가 준비되는 동안 보여 줄 UI
├─ error.tsx           ← 해당 세그먼트에서 에러가 났을 때 (클라이언트 컴포넌트)
├─ not-found.tsx       ← notFound() 또는 없는 URL
├─ about/
│  └─ page.tsx         ← URL `/about`
├─ posts/
│  ├─ page.tsx         ← URL `/posts`
│  ├─ layout.tsx       ← `/posts` 아래만 감싸는 중첩 레이아웃
│  └─ [id]/
│     └─ page.tsx      ← URL `/posts/1`, `/posts/abc` ...
└─ api/
   └─ posts/
      └─ route.ts      ← Route Handler. HTTP 메서드 export. URL `/api/posts`
```

JSX 버전은 확장자만 `.jsx` / `.js`입니다. 폴더 규칙과 파일 이름은 같습니다.

### 파일 이름 = 프레임워크와 약속

| 파일 | 역할 |
|---|---|
| `page` | 이 폴더가 URL이 된다. 없으면 그 경로는 페이지가 아님 |
| `layout` | 자식 `page`와 자식 `layout`을 감싼다. 이동해도 레이아웃은 유지 |
| `loading` | React `Suspense` fallback. 스트리밍되는 동안 스켈레톤 |
| `error` | 에러 경계. `"use client"` 필수 |
| `not-found` | 404 UI |
| `route` | 페이지가 아니라 HTTP 핸들러 (GET/POST/…) |
| `template` | layout과 비슷하지만 이동할 때마다 다시 마운트 |
| `default` | 병렬 라우트 기본 슬롯 (이 강의 후반에 다루지 않음) |

**폴더 이름 = URL 세그먼트**입니다. Nest의 `@Controller('posts')` + `@Get(':id')`가 파일 시스템으로 바뀐 것과 같습니다.

특별한 폴더 문법:

| 문법 | 예 | 의미 |
|---|---|---|
| `[id]` | `app/posts/[id]/page.tsx` | 동적 세그먼트. `params.id` |
| `[...slug]` | `app/docs/[...slug]/page.tsx` | 나머지 경로 전부 |
| `(marketing)` | `app/(marketing)/about/page.tsx` | **Route Group**. URL에는 안 들어감. 레이아웃만 묶음 |
| `_components` | `app/_components/Button.tsx` | `_`로 시작하면 라우트가 아님 (관례) |
| `@modal` | 병렬 라우트 슬롯 | 이 강의 범위 밖 |

---

## 4. Server Component vs Client Component

Notion 학습 목표의 두 번째 항목이자, Next.js에서 가장 많이 헷갈리는 지점입니다.

### 서버 컴포넌트 (기본)

```tsx
// app/posts/page.tsx  — "use client"가 없음 = 서버
export default async function PostsPage() {
  const posts = await getPosts() // 서버에서 DB/파일/외부 API
  return (
    <ul>
      {posts.map((p) => (
        <li key={p.id}>{p.title}</li>
      ))}
    </ul>
  )
}
```

- `async` 함수여도 됩니다. 서버에서 await하고 HTML을 만듭니다.
- `useState`, `useEffect`, `onClick`을 **쓸 수 없습니다**. 브라우저가 없기 때문입니다.
- 번들에 이 파일의 JS가 거의 안 실립니다. 비밀키, DB 접속 정보를 여기에 둬도 클라이언트로 안 내려갑니다.

### 클라이언트 컴포넌트 (명시)

```tsx
"use client"

import { useState } from "react"

export function LikeButton() {
  const [n, setN] = useState(0)
  return <button onClick={() => setN(n + 1)}>좋아요 {n}</button>
}
```

파일 **최상단**의 `"use client"`는 "이 모듈과, 이 모듈이 import하는 모듈은 클라이언트 경계 안쪽"이라는 선언입니다. Vue의 `<script setup>`이나 React SPA의 기본 컴포넌트와 같습니다.

### 경계를 넘는 규칙

```
서버 컴포넌트
  └─ 서버 컴포넌트     ← 가능
  └─ 클라이언트 컴포넌트 ← 가능 (JSX로 끼워 넣기)
클라이언트 컴포넌트
  └─ 클라이언트 컴포넌트 ← 가능
  └─ 서버 컴포넌트     ← 직접 import 불가. children으로만 통과
```

서버 → 클라이언트로 넘기는 props는 **직렬화 가능**해야 합니다. 함수, Date 인스턴스(버전에 따라 주의), 클래스 인스턴스는 못 넘깁니다. 데이터는 평범한 객체/문자/숫자로 내려 보내고, 이벤트 핸들러는 클라이언트 쪽에 둡니다.

한 줄 요약: **데이터를 읽는 일 = 서버, 클릭·입력·브라우저 API = 클라이언트.**

---

## 5. `page` / `layout` / `loading` / `error`

네 파일은 같은 폴더에 나란히 둡니다. Next가 조립합니다.

```
app/posts/layout.tsx    게시판 공통 사이드바
app/posts/page.tsx      목록
app/posts/loading.tsx   목록을 기다리는 동안
app/posts/error.tsx     목록 로딩 실패
app/posts/[id]/page.tsx 상세
```

- `layout`은 자식으로 이동해도 **리마운트되지 않습니다**. 헤더 속 로그인 상태를 유지하기 좋습니다.
- `loading`은 그 세그먼트의 `page`가 await하는 동안 스트리밍 폴백입니다.
- `error`는 반드시 클라이언트 컴포넌트입니다. 에러 경계가 브라우저에서 복구 UI를 그리기 때문입니다.
- 없는 id는 `notFound()`를 호출하면 가까운 `not-found.tsx`가 뜹니다.

Vite React Router의 `<Outlet />` + 에러 엘리먼트 + fallback이 파일 네 개로 쪼개진 형태입니다.

---

## 6. Route Handler (`app/api`)

페이지가 아니라 **HTTP 엔드포인트**가 필요할 때 씁니다. Nest의 컨트롤러 메서드와 역할이 같습니다.

```ts
// app/api/posts/route.ts
import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ posts: [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  return NextResponse.json({ ok: true, body }, { status: 201 })
}
```

- 파일 이름은 반드시 `route.js` / `route.ts`입니다. `page`와 같은 폴더에 둘 수 없습니다.
- `GET` `POST` `PUT` `PATCH` `DELETE` `HEAD` `OPTIONS`를 export하면 그 메서드가 연결됩니다.
- 같은 오리진이므로 브라우저 CORS를 신경 쓸 일이 거의 없습니다. (외부 도메인 프론트를 붙이면 그때 CORS)

페이지에서 데이터를 읽을 때는 **굳이 API를 거치지 않아도** 됩니다. 서버 컴포넌트가 `getPosts()`를 직접 호출하면 한 번의 서버 왕복이 줄어듭니다. API는 다음이 필요할 때 둡니다.

- 모바일 앱, 다른 프론트가 같은 데이터를 쓸 때
- 웹훅, 외부 서비스 콜백
- 클라이언트 컴포넌트가 브라우저에서 `fetch("/api/...")` 해야 할 때

---

## 7. 데이터 페치 — 서버 DB vs 외부 API

Notion 문장의 "데이터 포치"는 **데이터 페치(fetch)** 입니다. 위치 선택이 Next의 핵심입니다.

```
[브라우저]
    │  1) HTML 요청
    ▼
[Next 서버 컴포넌트]
    ├─ 같은 머신의 DB / 파일  ← 비밀키 안전, 왕복 최소
    └─ 외부 API (Nest, Django, 공개 JSON)
         └─ fetch(url, { next: { revalidate: 60 } })
```

| 위치 | 언제 쓰나 |
|---|---|
| 서버 컴포넌트에서 파일/DB 직접 | 이 강의 `demo/` 기본. 게시글을 JSON 파일에 저장 |
| 서버 컴포넌트에서 외부 API `fetch` | 백엔드를 Nest로 분리한 뒤, Next는 BFF처럼 읽기만 |
| 클라이언트 `useEffect` + `fetch` | 차트 폴링, 타이핑할 때마다 검색. 첫 페인트에는 비권장 |
| Route Handler | 다른 클라이언트를 위한 HTTP 계약 |

서버의 `fetch`는 Next가 캐시/재검증 힌트를 붙일 수 있습니다. 브라우저 `fetch`와 같은 함수처럼 보이지만, **어디서 실행되느냐**가 다릅니다.

이 강의 진행:

1. `study5` — 서버에서 JSON 파일을 읽고 쓰기 (미니 DB)
2. 같은 study에서 외부 JSON placeholder도 한 번 호출해 비교
3. 나중에 진짜 Nest로 분리할 때는 서버 컴포넌트의 `getPosts()` 구현만 HTTP 호출로 바꾸면 됩니다.

---

## 8. 인증 — 쿠키 / JWT

SPA 시절 자주 쓰던 `localStorage`에 JWT를 넣는 방식은 XSS에 취약합니다. Next는 **서버가 쿠키를 읽고 쓰는 것**이 기본 설계에 맞습니다.

| 방식 | 요약 | 이 강의 |
|---|---|---|
| **직접 JWT + HttpOnly 쿠키** | 로그인 시 서버가 JWT를 만들고 `Set-Cookie`. JS에서 토큰을 못 읽음 | `study6`에서 구현 |
| **Auth.js (NextAuth)** | 소셜 로그인, 세션 테이블, 콜백이 많은 풀서비스 | 개념만 `study6`에서 비교. demo는 직접 JWT |
| **서버 세션 저장소** | 쿠키에는 세션 id만, 서버 메모리/Redis에 사용자 | 최종 프로젝트에서 쿠키 계약은 비슷하게 유지 |

흐름:

1. `POST /api/auth/login` — 비밀번호 확인, JWT 발급, HttpOnly 쿠키 설정
2. 이후 요청마다 브라우저가 쿠키를 자동 첨부
3. 서버 컴포넌트 / Route Handler / `middleware.ts`가 쿠키를 열어 사용자 확인
4. 글쓰기처럼 브라우저 API가 필요한 페이지만 로그인 여부로 가드

`middleware.ts`는 요청이 페이지/API에 닿기 **전**에 실행됩니다. Nest의 Guard와 가장 가까운 층입니다. `study8`에서 다룹니다.

---

## 9. 환경 변수와 배포

- `.env.local` — 비밀키, DB 경로. Git에 안 넣음 (`.env.example`만 커밋)
- `NEXT_PUBLIC_` 접두사 — **브라우저 번들에 노출**됩니다. 공개돼도 되는 값만.
- 접두사 없는 변수 — 서버 전용. `JWT_SECRET` 같은 것.

배포는 Node 서버로 `next start` 하거나, Vercel처럼 App Router를 아는 호스트에 올립니다. Docker로 감싸는 방법은 `study10`에서 다룹니다.

---

## 10. JSX 버전과 TSX 버전

| | `jsx_version/` | `tsx_version/` |
|---|---|---|
| 생성 | `create-next-app --js` | `create-next-app --ts` (기본값) |
| 페이지 | `app/page.jsx` | `app/page.tsx` |
| Route Handler | `app/api/posts/route.js` | `app/api/posts/route.ts` |
| 동작 | 동일 | 동일 + 컴파일 타임 타입 |

문서 코드 예시는 읽기 쉽게 **TSX를 기본**으로 보여 줍니다. JSX는 다음만 빼면 같습니다.

- `Post`, `Params` 같은 type/interface
- 함수 인자·반환 타입 (`: string`, `: Promise<void>`)
- `as const`, 제네릭 (`<Post[]>`)

React를 JS로 먼저 배운 사람은 `jsx_version/demo`를, TS가 익숙하면 `tsx_version/demo`를 따라가면 됩니다. 진도는 항상 둘 다 맞춰 둡니다.

---

## 11. 다른 스택과 용어 대응

| 하고 싶은 일 | React SPA | NestJS | Next.js App Router |
|---|---|---|---|
| URL → 화면 | `<Route path>` | (해당 없음, API만) | `app/.../page.tsx` |
| 공통 껍데기 | 레이아웃 컴포넌트 | — | `layout.tsx` |
| REST 엔드포인트 | 없음 (axios로 남의 서버) | `@Controller` + `@Get` | `app/api/.../route.ts` |
| 요청 가드 | Router `loader` / 직접 분기 | `AuthGuard` | `proxy.ts`(구 middleware) + 서버에서 쿠키 |
| 폼 제출 | `onSubmit` + `fetch` | DTO + Pipe | Server Action 또는 Route Handler |
| HTML 먼저 주기 | 못 함 (CSR) | 템플릿 엔진을 따로 쓸 때 | 서버 컴포넌트 SSR |
| DI 컨테이너 | 없음 | `@Injectable` | 없음. 모듈에서 함수를 import |

Nuxt.js는 Vue 진영에서 Next와 같은 자리입니다. 풀스택 Notion 페이지의 다음 항목이 Nuxt입니다. 개념(파일 라우팅, 서버/클라이언트 경계, 라우트 룰)은 거의 1:1로 옮길 수 있습니다.

---

## 12. 용어 사전

| 용어 | 의미 |
|---|---|
| App Router | `app/` 폴더 기반 라우팅. 이 강의의 기본 |
| Pages Router | 구 `pages/` 방식. 여기서 사용하지 않음 |
| Server Component | 서버에서만 실행되는 React 컴포넌트. 기본값 |
| Client Component | `"use client"`. 브라우저에서 훅/이벤트를 씀 |
| Route Handler | `route.ts`에 HTTP 메서드를 export한 API |
| Server Action | `"use server"` 함수. 폼/버튼이 서버 함수를 직접 호출 |
| RSC payload | 서버 컴포넌트 결과를 클라이언트가 이해할 형태로 직렬화한 것 |
| Streaming | HTML을 한 번에 안 기다리고 `loading`과 본문을 나눠 보냄 |
| `params` / `searchParams` | 동적 세그먼트, 쿼리스트링. Next 15+ 에서는 Promise (await 필요) |
| `revalidatePath` | 서버 데이터가 바뀐 뒤 해당 URL 캐시를 무효화 |
| HttpOnly 쿠키 | JavaScript로 못 읽는 쿠키. XSS로 토큰을 훔치기 어렵게 함 |
| `NEXT_PUBLIC_` | 브라우저에 노출되는 환경 변수 접두사 |

---

## 13. 이 강의가 만드는 것

Notion 예제 그대로 **게시판 + 로그인**을 Next.js 하나로 만듭니다.

- `study1`~`study5`: 앱 생성, 라우팅, 서버/클라이언트, API, 게시글 CRUD
- `study6`~`study10`: JWT 쿠키, Server Actions, 미들웨어, 메타데이터, 배포
- `studyFinal`: 같은 기술을 **학습 노트 웹사이트**로, 폴더 구조와 저장소를 바꿔 다시 조립

다음: [study1.md](study1.md) — `create-next-app`으로 JSX/TSX 프로젝트를 만들고 첫 페이지를 띄웁니다.
