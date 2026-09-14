# study7 — 고급 2: Server Actions

`study5`의 글쓰기 폼은 브라우저가 `fetch("/api/posts")`를 호출했습니다. 이번엔 **폼이 서버 함수를 직접 호출**합니다. Route Handler는 curl/다른 클라이언트용으로 그대로 둡니다.

---

## 1. `"use server"`

```ts
"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createPostAction(formData: FormData) {
  const session = await getSession()
  if (!session) redirect("/login")
  const post = await createPost({
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    authorName: session.name,
  })
  revalidatePath("/posts")
  redirect(`/posts/${post.id}`)
}
```

- 이 함수는 **서버에서만** 실행됩니다. 비밀번호 해시, `fs`, JWT 검증을 그대로 쓸 수 있습니다.
- `<form action={createPostAction}>` 에 넘기면 Next가 POST 엔드포인트를 몰래 만듭니다. 우리가 `app/api`를 안 열어도 됩니다.
- `revalidatePath` — 서버 컴포넌트 캐시를 깨서 목록이 새 글을 보게 합니다. `study5`의 `router.refresh()`와 같은 목적입니다.
- `redirect`는 throw처럼 동작합니다. 그 아래 코드는 실행되지 않습니다.

## 2. Route Handler vs Server Action

| | Route Handler | Server Action |
|---|---|---|
| 호출 | `fetch("/api/posts")` | `<form action={fn}>` 또는 `fn()` |
| 계약 | HTTP 메서드 + JSON | 같은 앱 전용. 공개 REST가 아님 |
| 다른 클라이언트 | curl, 모바일 | 부적합 |
| 폼 | JS로 조립 | progressive enhancement. JS가 꺼져도 제출됨 |

같은 앱 안의 뮤테이션은 Action, 외부에 열어 줄 API는 Route Handler — 둘 다 이 demo에 있습니다.

## 3. `useFormStatus`

`SubmitButton`만 `"use client"`입니다. `useFormStatus()`로 부모 `<form>`이 제출 중인지 압니다. 페이지 전체를 클라이언트로 올리지 않습니다.

수정은 `updatePostAction.bind(null, post.id)`로 첫 인자에 id를 고정합니다. 숨은 input으로 id를 보내는 방식도 됩니다.

## 4. 확인

로그인 후 `/posts/new`에서 글을 올리면 `/posts/{id}`로 이동합니다. 네트워크 탭에 `/api/posts` POST가 없고 Next 내부 action POST가 보입니다. `curl`로 `/api/posts`는 여전히 동작합니다.

다음: [study8.md](study8.md) — `middleware.ts`로 글쓰기 URL을 로그인 없이 못 들어가게 합니다.
