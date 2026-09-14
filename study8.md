# study8 — 고급 3: 미들웨어 인가

`study6`의 Action/API는 쿠키가 없으면 401 또는 `/login`으로 보냅니다. 그래도 `/posts/new` HTML은 로그인 전에 내려갈 수 있습니다. **요청이 페이지에 닿기 전**에 막는 층이 Next.js 16의 `proxy.ts`입니다. (15까지는 `middleware.ts`라는 이름이었고, 16.3에서 파일/함수 이름이 `proxy`로 바뀌었습니다. 하는 일은 같습니다.)

파일 위치: `app/`이 아니라 **프로젝트 루트** (`demo/proxy.ts`). JSX는 `proxy.js`. Nest의 Guard와 가장 가깝습니다.

---

## 1. 하는 일

```ts
export function proxy(request: NextRequest) {
  // /posts/new, /posts/:id/edit 에 쿠키가 없으면 /login?from=... 으로 보냄
}

export const config = {
  matcher: ["/posts/new", "/posts/:id/edit"],
}
```

- `matcher`에 안 걸린 요청은 미들웨어를 실행하지 않습니다. 정적 파일·이미지까지 전부 타면 느려집니다.
- Edge 런타임입니다. `fs`, `jsonwebtoken`(Node API)을 여기서 돌리지 않습니다. **쿠키가 있는지만** 보고, 서명 검증은 서버 컴포넌트/`getSession()`이 합니다.
- 목록 `/posts`와 상세는 공개입니다. 쓰기다만 막습니다.

## 2. 인증 vs 인가

| | 이 demo |
|---|---|
| 인증 Authentication | JWT가 유효한 사용자인가 (`getSession`) |
| 인가 Authorization | 이 URL을 열 자격이 있는가 (미들웨어 + Action 안 재확인) |

미들웨어만 믿으면 쿠키 위조(서명 없는 값)를 통과할 수 있으므로, Action에서 `getSession()`을 한 번 더 합니다. Guard를 컨트롤러와 서비스 양쪽에서 거는 것과 같습니다.

## 3. 확인

로그인하지 않은 브라우저에서 `/posts/new` → `/login?from=/posts/new` 로 이동합니다.

```powershell
curl.exe -s -o NUL -w "%{http_code} %{redirect_url}" http://localhost:3000/posts/new
```

307(또는 308)과 `login`이 보이면 됩니다. 쿠키를 붙이면 200입니다.

다음: [study9.md](study9.md) — 환경 변수, `next/image`, 페이지 메타데이터.
