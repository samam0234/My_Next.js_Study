# study6 — 고급 1: JWT 쿠키 인증

Notion 인증 항목: **쿠키 / NextAuth 또는 직접 JWT**. demo는 **직접 JWT + HttpOnly 쿠키**를 구현합니다. Auth.js(NextAuth)는 소셜 로그인·세션 테이블이 필요할 때 쓰는 풀서비스이고, 이 강의의 게시판+로그인은 직접 구현이 학습에 더 맞습니다.

시드 계정: `demo@example.com` / `demo1234`

---

## 1. SPA 때와 다른 점

Vite React에서는 JWT를 `localStorage`에 두고 axios 헤더에 붙였습니다. XSS로 스크립트가 토큰을 읽을 수 있습니다.

Next에서는 서버가 `Set-Cookie`로 심고, 브라우저는 같은 오리진 요청에 쿠키를 자동으로 붙입니다. `httpOnly: true`면 `document.cookie`로 못 읽습니다.

```
로그인 POST /api/auth/login
  → 비밀번호 확인 (bcrypt)
  → jwt.sign({ sub, email, name })
  → Set-Cookie: session_token=...; HttpOnly; SameSite=Lax
이후 페이지/API 요청
  → 쿠키 자동 첨부
  → cookies() 또는 middleware가 검증
```

## 2. 파일

| 파일 | 역할 |
|---|---|
| `lib/auth` | 해시, JWT 발급/검증, 쿠키 옵션 |
| `lib/users-store` | `data/users.json` |
| `lib/session` | 서버 컴포넌트에서 현재 사용자 |
| `app/api/auth/register` | 가입 + 즉시 로그인 쿠키 |
| `app/api/auth/login` | 로그인 |
| `app/api/auth/logout` | 쿠키 삭제 |
| `app/api/auth/me` | 현재 사용자 JSON |
| `/login` `/register` | 화면 |

`JWT_SECRET`은 환경 변수입니다. 없으면 개발용 기본값. `study9`에서 `.env`를 정리합니다.

## 3. 헤더와 글 작성

`SiteHeader`는 서버 컴포넌트라 `await getSession()`으로 이름을 그립니다. 로그아웃 버튼만 클라이언트입니다.

`POST /api/posts`는 세션이 없으면 401입니다. 글의 `authorName`은 클라이언트가 보내는 값이 아니라 쿠키에서 꺼낸 이름입니다. 클라이언트가 작성자를 위조하지 못하게 하기 위함입니다.

## 4. Auth.js와 언제 바꾸나

| | 직접 JWT (이번) | Auth.js |
|---|---|---|
| 이메일/비번만 | 단순 | 과함 |
| 구글/깃허브 로그인 | 직접 구현 비용 큼 | 제공자만 설정 |
| 세션을 DB에 저장 | 안 함 (토큰 자체에 정보) | 어댑터 |

나중에 Nest로 API를 분리하면, 쿠키 도메인만 맞추거나 Next는 BFF로 쿠키를 열고 Nest에는 Authorization 헤더를 붙이는 식으로 이어집니다.

## 5. 확인

```powershell
curl.exe -s -c cookie.txt -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" --data-binary "@login.json"
curl.exe -s -b cookie.txt http://localhost:3000/api/auth/me
```

`login.json`: `{"email":"demo@example.com","password":"demo1234"}`

브라우저: `/login` → 헤더에 "데모" → 새 글 작성 시 작성자 이름이 붙음.

로그인 없이 `POST /api/posts`는 401이어야 합니다.

다음: [study7.md](study7.md) — 폼이 `fetch` 대신 Server Action으로 서버 함수를 직접 호출합니다.
