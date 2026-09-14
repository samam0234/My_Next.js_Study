# study1 — 만드는 방법 및 명령어, 실습 1

[study0.md](study0.md)에서 개념을 봤으니 이제 프로젝트를 만들고 첫 HTML을 서버에서 내려 봅니다.
**JSX와 TSX를 같은 구조로 둘 다** 만듭니다.

대응하는 코드:

- TypeScript: [`tsx_version/demo`](tsx_version/demo)
- JavaScript: [`jsx_version/demo`](jsx_version/demo)

---

## 1. 사전 준비

```powershell
node -v   # v24.14.0 확인
npm -v    # 11.9.0 확인
```

NestJS의 Node, Spring의 JDK와 같은 역할입니다. Next.js 16은 Node 20+ 가 필요합니다.

---

## 2. 프로젝트 생성 명령어

이미 Git 저장소인 이 폴더 안에서 생성하므로 **`--disable-git`** 을 붙입니다. 안 붙이면 `demo/` 안에 중첩 `.git`이 생깁니다.

### TypeScript (기본값)

```powershell
npx -y create-next-app@16.3.5 tsx_version/demo --ts --tailwind --eslint --app --import-alias "@/*" --use-npm --disable-git --yes
```

### JavaScript

```powershell
npx -y create-next-app@16.3.5 jsx_version/demo --js --tailwind --eslint --app --import-alias "@/*" --use-npm --disable-git --yes
```

| 옵션 | 의미 |
|---|---|
| `--ts` / `--js` | TypeScript 또는 JavaScript |
| `--tailwind` | Tailwind CSS (Next 16 기본) |
| `--eslint` | 린트 설정 |
| `--app` | App Router (`app/` 폴더). Pages Router를 쓰지 않음 |
| `--import-alias "@/*"` | `import x from "@/..."` 경로 별칭 |
| `--use-npm` | 패키지 매니저를 npm으로 고정 |
| `--disable-git` | 하위 폴더에 `.git`을 만들지 않음 |
| `--yes` | 나머지 질문을 기본값으로 |

`--src-dir`는 넣지 않았습니다. `demo/`는 `app/`이 프로젝트 루트에 바로 있습니다. `src/` 구조는 최종 프로젝트(`studyFinal`)에서 일부러 다르게 씁니다.

이 저장소를 처음 받은 사람은 생성 명령을 다시 돌릴 필요 없습니다. 아래만 하면 됩니다.

```powershell
cd tsx_version/demo
npm install
npm run dev
```

---

## 3. 생성된 구조 (핵심만)

```
demo/
├─ app/
│  ├─ layout.tsx   (JS: layout.js)   ← 루트 레이아웃. <html> <body>
│  ├─ page.tsx     (JS: page.js)     ← URL `/`
│  └─ globals.css                    ← Tailwind 진입점
├─ public/                           ← 정적 파일. URL `/파일명`
├─ package.json
├─ next.config.ts  (JS: next.config.mjs)
└─ tsconfig.json   (JS: jsconfig.json)
```

Next.js는 JSX가 들어 있어도 JS 버전 파일명을 `page.js`로 둡니다. `.jsx`로 바꿔도 동작하지만, 스캐폴드 기본값을 그대로 따릅니다.

### package.json 주요 스크립트

| 명령 | 역할 |
|---|---|
| `npm run dev` | 개발 서버. 파일 저장 시 즉시 반영. 기본 `http://localhost:3000` |
| `npm run build` | 프로덕션 빌드 (`.next/`) |
| `npm run start` | 빌드 결과로 서버 실행. `build` 이후 |
| `npm run lint` | ESLint |

두 버전을 동시에 띄울 때:

```powershell
# 터미널 1
cd tsx_version/demo; npm run dev
# 터미널 2
cd jsx_version/demo; npm run dev -- --port 3001
```

Vite의 `npm run dev`(보통 5173)와 같고, Nest의 `npm run start:dev`에 대응합니다. 차이는 **이 서버가 HTML과 API를 같이** 준다는 점입니다.

---

## 4. `layout`과 `page`

### 루트 레이아웃

`app/layout.tsx`는 모든 페이지를 감쌉니다. `<html>`과 `<body>`는 여기에만 둡니다.

```tsx
import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Next.js 실습 데모",
  description: "App Router 기초부터 게시판·로그인까지 한 프로젝트에서 실습합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header>...</header>
        <main>{children}</main>
        <footer>...</footer>
      </body>
    </html>
  );
}
```

JSX 버전은 `LayoutProps`, `Metadata` 타입만 없고 파일명이 `layout.js`입니다. `children`은 그냥 props로 받습니다.

- `export const metadata` — 탭 제목, 검색 엔진/카톡 미리보기에 쓰입니다. `study9`에서 페이지별로 세분화합니다.
- `next/font` — 구글 폰트를 빌드 타임에 받아와 **런타임에 Google로 나가지 않습니다**.
- `{children}` — 지금 URL의 `page`가 여기로 들어옵니다. React Router의 `<Outlet />`과 같습니다.

### 홈 페이지

`app/page.tsx`가 `/`입니다. `"use client"`가 없으므로 **서버 컴포넌트**입니다.

```tsx
export default function HomePage() {
  const renderedAt = new Date().toISOString();
  return <p>renderedAt = {renderedAt}</p>;
}
```

`new Date()`는 서버에서 실행됩니다. 페이지 소스를 보기(Ctrl+U)하면 그 시각 문자열이 **이미 HTML에 박혀** 있습니다. Vite SPA는 빈 `<div id="root">`만 주고 JS가 그린 뒤에야 내용이 생깁니다.

---

## 5. 실습에서 바꾼 것

`create-next-app` 기본 템플릿(영문 랜딩, Vercel 링크)을 지우고 강의용 홈으로 교체했습니다.

1. `lang="ko"`, Noto Sans KR
2. 공통 헤더/푸터를 루트 레이아웃에 배치 (`next/link`의 `<Link>`)
3. 홈에 서버에서 만든 `renderedAt`을 표시
4. 라이트 톤 배경(`globals.css`) — 이후 실습 UI의 기준

`<Link>`는 브라우저 전체를 새로고침하지 않고 App Router 안에서 이동합니다. 지금은 홈 하나라 티가 안 나고, `study2`에서 페이지가 늘어나면 차이가 보입니다.

---

## 6. 실행해서 확인

```powershell
cd tsx_version/demo
npm run dev
```

브라우저: `http://localhost:3000`

확인 포인트:

- 제목 "Next.js에 오신 것을 환영합니다"
- 검은 박스의 `renderedAt`이 ISO 시각
- 새로고침하면 시각이 바뀜 (SSR)
- 페이지 소스 보기에도 `renderedAt` 문자열이 있음 (클라이언트가 나중에 넣은 게 아님)

```powershell
curl.exe -s http://localhost:3000 | findstr renderedAt
```

HTML 안에 `renderedAt = 2026-...`가 보이면 서버 렌더링이 된 것입니다.

---

## 7. JSX와 TSX 차이 (이번 실습)

| | TSX | JSX |
|---|---|---|
| 페이지 | `app/page.tsx` | `app/page.js` |
| 레이아웃 | `LayoutProps<"/"`, `Metadata` | 타입 없음 |
| 설정 | `next.config.ts`, `tsconfig.json` | `next.config.mjs`, `jsconfig.json` |
| 화면 | 동일 | 동일 |

다음: [study2.md](study2.md) — `/about`, `/hello/[name]`, 게시글 목록 뼈대와 `Link`로 페이지를 연결합니다.
