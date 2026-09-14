# studyFinal — 종합 프로젝트: 스터디 로그 (구조를 다르게)

`study0`~`study10`에서 익힌 개념을 응용하되, `demo/`와는 **의도적으로 다른 구조**로 작은 웹사이트를 다시 만듭니다.

코드:

- TypeScript: [`tsx_version/project`](tsx_version/project)
- JavaScript: [`jsx_version/project`](jsx_version/project)

```powershell
cd tsx_version/project
npm install
npm run dev
```

시드 계정: `demo@example.com` / `demo1234`

---

## 0. demo/ 와 무엇이 다른가

| | `demo/` | `project/` |
|---|---|---|
| 도메인 | 공개 게시판 | **개인 학습 노트** (태그, 본인 글만) |
| 폴더 | `app/` 가 루트 | **`src/app` + `src/features`** |
| 저장소 | JSON 파일 | **`node:sqlite`** (Node 24 내장) |
| 라우트 묶음 | 거의 안 씀 | `(marketing)` / `(notebook)` Route Group |
| 인증 UI | `fetch` + 쿠키 | **Server Action만** (가입/로그인/로그아웃) |
| 인가 | `proxy.ts` + Action | 레이아웃에서 세션 검사 + `proxy.ts` |
| 소유권 | 누구나 글을 고침 | **user_id가 맞는 노트만** 읽고 고침 |

Notion 예제 "게시판 + 로그인"을 한 번 더 하되, 화면·URL·저장소를 바꿔서 **같은 엔진으로 다른 제품을 조립하는 감각**을 목표로 합니다.

---

## 1. 폴더

```
src/
├─ app/
│  ├─ layout.tsx              루트 (폰트, 헤더)
│  ├─ (marketing)/page.tsx    랜딩 `/`
│  ├─ (marketing)/login
│  ├─ (marketing)/register
│  └─ (notebook)/
│     ├─ layout.tsx           로그인 없으면 /login
│     └─ notes/...            `/notes`
├─ features/
│  ├─ auth/                   회원 저장소 + 액션
│  └─ notes/                  노트 저장소 + 액션
├─ lib/                       sqlite, jwt, session
└─ components/
```

`(marketing)`과 `(notebook)`은 URL에 안 들어갑니다. `/notes`이지 `/(notebook)/notes`가 아닙니다.

---

## 2. SQLite

`src/lib/db.ts`가 `data/studylog.db`를 만듭니다. 첫 실행 때 테이블과 시드 사용자를 넣습니다.

```ts
import { DatabaseSync } from "node:sqlite"
```

JSON과 달리 SQL로 본인 글만 고릅니다.

```sql
SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC
```

DB 파일은 gitignore입니다. `data/.gitkeep`만 커밋합니다.

---

## 3. 흐름

1. `/` 랜딩 — 서버 컴포넌트, 로그인 불필요
2. `/login` — Server Action이 JWT 쿠키를 심고 `/notes`로
3. `/notes` — `(notebook)/layout`이 세션을 확인하고 본인 노트만 목록
4. `/notes/new` — 태그 + 본문. Action이 sqlite INSERT
5. 상세/수정/삭제 — `user_id`가 다르면 `notFound()`

`proxy.ts`는 `/notes`에 쿠키가 없으면 `/login`으로 보냅니다. 진짜 검증과 소유권은 레이아웃·Action에 있습니다.

---

## 4. 확인

- 홈이 노트 테마(줄무늬 배경)인지. demo의 청록 게시판과 다르게 보여야 합니다.
- 로그인 없이 `/notes` → `/login`
- 로그인 후 노트 작성 → 목록에 태그가 보임
- 다른 계정으로 가입하면 그 노트는 안 보임

```powershell
npm run build
```

`node:sqlite`는 실험적 API라 빌드 로그에 ExperimentalWarning이 날 수 있습니다. 동작에는 문제 없습니다.

이 저장소의 Next.js 강의는 여기까지입니다. 나중에 백엔드를 Nest/Django로 분리할 때는 `features/*/store`의 sqlite 호출만 HTTP로 바꾸면 됩니다.
