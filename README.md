# Next.js 학습 저장소

JS / TS 기반 풀스택 엔진 Next.js를 기초 개념부터 단계별로 실습하며 정리하는 개인 학습 저장소입니다.
같은 워크스페이스의 `frontend_study/react/`(Vite SPA)와 `backend_study/nest.js/`(API 서버)를 이미 다룬 전제에서, **React UI와 서버 라우팅·API를 한 프로젝트로 합치는 방법**을 배웁니다.

학습 목표는 [Notion: Next.js](https://app.notion.com/p/Next-js-3d6d7dec5e2e81afb534c64042625cc6)를 기준으로 합니다.

- `studyN.md` 문서에 개념 정리와 실습 과정, **실제로 실행해서 확인한 결과**를 순서대로 기록합니다.
- `jsx_version/` · `tsx_version/` 아래에 같은 기능의 프로젝트를 JavaScript와 TypeScript로 각각 둡니다.
- `demo/`는 각 study에서 다루는 내용을 구현한 Next.js 프로젝트입니다. study가 진행될수록 코드도 함께 발전합니다.
- `project/`는 `studyFinal.md`에 대응하는, `demo/`와는 **다른 구조**로 처음부터 다시 설계한 완결된 미니 웹사이트입니다.

## 사전 준비

```powershell
node -v   # v24.x 확인
npm -v    # 11.x 확인
```

## 기술 스택

### demo/ (study1 ~ study10)

- Next.js 16 App Router
- React Server Components + Client Components
- Tailwind CSS
- Route Handler (`app/api`) + Server Actions
- JSON 파일 저장소 (게시글·회원)
- JWT + HttpOnly 쿠키 인증
- `middleware.ts` 인가

### project/ (studyFinal)

- `src/` 디렉터리 + feature 폴더 구조
- `node:sqlite` (demo의 JSON과 다른 저장소)
- 학습 노트 도메인 (게시판과 다른 화면/URL)
- 쿠키 세션에 가까운 JWT 인증 + 미들웨어

## 프로젝트 실행

```powershell
# TypeScript 실습
cd tsx_version/demo
npm install
npm run dev          # http://localhost:3000

# JavaScript 실습 (동시에 띄울 때)
cd jsx_version/demo
npm install
npm run dev -- --port 3001
```

최종 프로젝트:

```powershell
cd tsx_version/project
npm install
npm run dev          # http://localhost:3000
```

## 학습 문서 목차

| 문서 | 주제 | 핵심 내용 |
|---|---|---|
| [study0.md](study0.md) | Next.js 기초 이론 | React + 라우팅 + SSR + API, SPA와의 차이, App Router, Server/Client Component, 렌더링 모델, 용어 사전 |
| [study1.md](study1.md) | 만드는 방법 & 명령어, 실습 1 | `create-next-app`, 주요 npm 스크립트, `layout`/`page`, JSX·TSX 동시 생성 |
| [study2.md](study2.md) | 실습 2 — App Router 라우팅 | 중첩 레이아웃, 동적 세그먼트, `Link`, Route Group |
| [study3.md](study3.md) | 실습 3 — Server vs Client | 기본 서버 컴포넌트, `"use client"`, props로 경계 넘기기 |
| [study4.md](study4.md) | 실습 4 — 특수 파일 & Route Handler | `loading`/`error`/`not-found`, `app/api` GET/POST |
| [study5.md](study5.md) | 실습 5 — 데이터 페치 & 게시판 | 서버 페치, JSON 저장소 CRUD, 외부 API vs 서버 DB |
| [study6.md](study6.md) | 고급 1 — JWT 쿠키 인증 | 회원가입/로그인, HttpOnly 쿠키, 작성자 연결 |
| [study7.md](study7.md) | 고급 2 — Server Actions | 폼 뮤테이션, `revalidatePath`, Route Handler와 비교 |
| [study8.md](study8.md) | 고급 3 — 미들웨어 인가 | `middleware.ts`, 보호 라우트, 로그인 리다이렉트 |
| [study9.md](study9.md) | 고급 4 — 환경 변수·이미지·메타 | `.env`, `next/image`, `generateMetadata` |
| [study10.md](study10.md) | 고급 5 — 빌드와 배포 | `next build`, Docker, Vercel 배포 노트 |
| [studyFinal.md](studyFinal.md) | 종합 프로젝트 (구조 다르게) | 학습 노트 웹사이트, `src/` + feature + SQLite |

## 저장소 구조

```
next.js/
├─ study0.md ~ studyFinal.md
├─ jsx_version/
│  ├─ demo/          ← JS 실습 (study1~study10 누적)
│  └─ project/       ← studyFinal (다른 구조)
├─ tsx_version/
│  ├─ demo/          ← TS 실습 (study1~study10 누적)
│  └─ project/       ← studyFinal (다른 구조)
└─ .agent/           ← AI 에이전트 공통 가이드라인
```
