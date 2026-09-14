# study2 — 실습 2: App Router 라우팅

[study1.md](study1.md)에서 `/` 하나만 있었습니다. 이번엔 폴더를 늘려 URL을 만듭니다.

대응하는 코드: `tsx_version/demo`, `jsx_version/demo` (기능 동일)

---

## 1. 규칙 한 줄

**폴더 이름 = URL 세그먼트, `page` 파일 = 그 주소의 화면.**

```
app/about/page.tsx          →  /about
app/hello/[name]/page.tsx   →  /hello/아무이름
app/posts/page.tsx          →  /posts
app/posts/[id]/page.tsx     →  /posts/1
app/posts/layout.tsx        →  /posts 아래를 감싸는 중첩 레이아웃
```

JSX는 확장자만 `.js`입니다.

---

## 2. `<Link>` vs `<a>`

같은 앱 안 이동은 `next/link`의 `<Link>`를 씁니다. 레이아웃(헤더)을 유지한 채 페이지만 바꿉니다. 외부 URL만 일반 `<a>`입니다.

헤더는 `app/ui/site-header`로 빼 두었습니다. 루트 레이아웃이 이 컴포넌트를 렌더하므로 모든 페이지에 같은 메뉴가 보입니다.

---

## 3. 정적 페이지 `/about`

`app/about/page.tsx` — 세그먼트에 대괄호가 없으면 주소가 고정입니다.

---

## 4. 동적 세그먼트 `/hello/[name]`

폴더 이름 `[name]`의 `name`이 `params.name`이 됩니다.

```tsx
type HelloPageProps = {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function HelloPage({ params, searchParams }: HelloPageProps) {
  const { name } = await params;
  const { from } = await searchParams;
  // ...
}
```

Next 15부터 `params`와 `searchParams`는 **Promise**입니다. 동기 객체처럼 `params.name`을 바로 읽으면 경고/에러가 납니다. JSX는 타입만 없고 `await params`는 같습니다.

쿼리 예: `/hello/next?from=query` → `searchParams.from === "query"`

---

## 5. 중첩 레이아웃 `/posts`

`app/posts/layout.tsx`는 `/posts`와 `/posts/1`을 같이 감쌉니다. 목록에서 상세로 이동해도 청록색 안내 박스는 리마운트되지 않습니다. 루트 레이아웃의 헤더와 같은 원리입니다.

목록/상세 데이터는 아직 DB가 아닙니다. `lib/sample-posts`의 상수 배열입니다. `study5`에서 JSON 파일 저장소로 바꿉니다.

없는 id는 `notFound()`를 호출합니다. 지금은 Next 기본 404입니다. `study4`에서 `not-found.tsx`를 직접 그립니다.

---

## 6. Route Group (이번엔 폴더만 알아 두기)

`(이름)` 폴더는 URL에 안 들어갑니다.

```
app/(marketing)/about/page.tsx  →  여전히 /about
app/(shop)/about/page.tsx       →  충돌. 같은 URL에 page가 두 개
```

레이아웃만 묶고 싶을 때 씁니다. `demo/`는 구조를 단순하게 유지하려고 이번에는 쓰지 않았습니다. 최종 프로젝트(`studyFinal`)에서 `(app)` 그룹으로 로그인 후 화면을 묶습니다.

---

## 7. 확인

```powershell
cd tsx_version/demo
npm run dev
```

| URL | 보여야 하는 것 |
|---|---|
| `/about` | "이 데모가 가는 길" |
| `/hello/gildong` | "안녕하세요, gildong님" |
| `/hello/next?from=query` | `from = query` |
| `/posts` | 글 두 개 + 청록 레이아웃 박스 |
| `/posts/1` | 첫 글 본문. 레이아웃 박스 유지 |
| `/posts/999` | 404 |

```powershell
curl.exe -s http://localhost:3000/hello/gildong | findstr gildong
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/posts/999
```

다음: [study3.md](study3.md) — 서버 컴포넌트 기본값과 `"use client"` 경계를 버튼으로 확인합니다.
