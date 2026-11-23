# study2 — 컴포넌트와 서버·클라이언트 경계

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

페이지·컴포넌트·모듈을 나누고 props와 이벤트로 연결한다.

## ② 📖 이론

App Router의 page와 layout은 기본적으로 Server Component다. 데이터 읽기와 초기 화면 준비를 맡는다. useState, onClick, localStorage가 필요한 파일에는 use client를 선언한다.

서버가 Counter에 label과 initial을 넘기고 클라이언트는 자신의 이벤트에서 상태를 바꾼다. 서버에서 만든 일반 이벤트 함수를 클라이언트 props로 넘기지 않는다. 서버 전용 모듈을 클라이언트에서 import하면 DB·비밀키 경계를 깨뜨릴 수 있다.

레고에 비유하면 page는 조립 설명서, 컴포넌트는 블록, props는 결합 규격이다. 데이터를 위에서 내려주고 사용자 이벤트는 브라우저 안에서 처리한다. 서버 화면을 클라이언트 영역에 배치해야 하면 서버에서 구성한 children을 전달한다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. course/counter.tsx의 use client와 props 타입을 확인한다.
2. /lab에서 initial=3을 전달한 버튼을 클릭한다. 최초 HTML과 클릭 뒤 DOM 값의 차이를 확인한다.
3. Counter를 두 개 배치해 각 상태가 독립적인지 확인한다.
4. 재사용 데이터·검증은 domain 모듈로, UI 이벤트는 client 모듈로 분리한다.

~~~powershell
cd tsx_version/demo
npm run dev
# /lab에서 Counter 두 개를 배치하고 클릭한다.
~~~

### 렌더링 용어

SSR은 요청 시 HTML 준비, SSG는 빌드 시 준비, CSR은 브라우저에서 화면 갱신, RSC는 서버 컴포넌트 실행 결과다. 서로 같은 분류 축이 아니며 use client도 최초 HTML을 서버에서 미리 그릴 수 있다. 모든 페이지가 요청마다 새 시각으로 렌더링된다고 가정하지 않는다. Route Group은 URL을 늘리지 않고 레이아웃을 묶는다.

### tsx_version/demo/course/counter.tsx

[실행 파일](tsx_version/demo/course/counter.tsx)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/course/counter.tsx sha256:492173c605e14cd8ac2692d6aefe55fee70171a0f96df2a7b0750c993b69c183 -->
~~~tsx
"use client";
import { useState } from "react";
export function Counter({
  label,
  initial = 0,
}: {
  label: string;
  initial?: number;
}) {
  const [count, setCount] = useState(initial);
  return (
    <button onClick={() => setCount((n) => n + 1)}>
      {label}: {count}
    </button>
  );
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 이 모듈과 하위 import를 브라우저 상호작용 경계로 선언한다. |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { useState } from "react"; |
| 3 | Counter의 입력·반환 경계를 정의한다. |
| 4 | 현재 구문에서 다음 값·인자·표현식을 연결한다: label, |
| 5 | 현재 구문에서 다음 값·인자·표현식을 연결한다: initial = 0, |
| 6 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }: { |
| 7 | 객체·스키마·속성의 값을 지정한다: label: string; |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: initial?: number; |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }) { |
| 10 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 11 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return ( |
| 12 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: <button onClick={() => setCount((n) => n + 1)}> |
| 13 | 현재 구문에서 다음 값·인자·표현식을 연결한다: {label}: {count} |
| 14 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 15 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 16 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/demo/app/lab/page.tsx

[실행 파일](tsx_version/demo/app/lab/page.tsx)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/app/lab/page.tsx sha256:11f3432f03fcd2c48e97467de26eebd43db7c66ca95754eea8105f25ff955407 -->
~~~tsx
import { Counter } from '@/course/counter';
import { Draft } from '@/course/draft';
export default function Lab() { const topic = 'Next.js'; return <section className="course"><h1>Hello, {topic}!</h1><p>app 폴더와 page 파일이 URL을 만듭니다.</p><Counter label="클릭" initial={3} /><Draft /><a href="/board">게시판으로</a></section>; }
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { Counter } from '@/course/counter'; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { Draft } from '@/course/draft'; |
| 3 | 현재 구문에서 다음 값·인자·표현식을 연결한다: export default function Lab() { const topic = 'Next.js'; return <section className="course"><h1>Hello, {topic}!</h1><p>app 폴더와 page 파일이 URL을 만듭니다.</p><Counter label="클릭" initial={3} /><Draft /><a href="/board">게시판으로</a></section>; } |

### tsx_version/demo/app/layout.tsx

[실행 파일](tsx_version/demo/app/layout.tsx)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/app/layout.tsx sha256:0fb74f1e585f5a05be84ee481902a24385a3fc8a0bc674138b66e844bda93565 -->
~~~tsx
import type { Metadata } from "next";
import { SiteHeader } from "@/app/ui/site-header";
import "./globals.css";


export const metadata: Metadata = {
  title: {
    default: "Next.js 실습 데모",
    template: "%s · Next.js 실습",
  },
  description: "App Router 기초부터 게시판·로그인까지 한 프로젝트에서 실습합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-line px-4 py-4 text-center text-xs text-stone-500">
          study2 · App Router · tsx_version/demo
        </footer>
      </body>
    </html>
  );
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: type { Metadata } from "next"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { SiteHeader } from "@/app/ui/site-header"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: "./globals.css"; |
| 6 | 이름 있는 값·설정·함수 또는 상태를 준비한다: export const metadata: Metadata = { |
| 7 | 객체·스키마·속성의 값을 지정한다: title: { |
| 8 | 객체·스키마·속성의 값을 지정한다: default: "Next.js 실습 데모", |
| 9 | 객체·스키마·속성의 값을 지정한다: template: "%s · Next.js 실습", |
| 10 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 11 | 객체·스키마·속성의 값을 지정한다: description: "App Router 기초부터 게시판·로그인까지 한 프로젝트에서 실습합니다.", |
| 12 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 14 | 현재 구문에서 다음 값·인자·표현식을 연결한다: export default function RootLayout({ children }: LayoutProps<"/">) { |
| 15 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return ( |
| 16 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <html lang="ko" className="h-full antialiased"> |
| 17 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <body className="min-h-full flex flex-col font-sans"> |
| 18 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <SiteHeader /> |
| 19 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8"> |
| 20 | 현재 구문에서 다음 값·인자·표현식을 연결한다: {children} |
| 21 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </main> |
| 22 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <footer className="border-t border-line px-4 py-4 text-center text-xs text-stone-500"> |
| 23 | 현재 구문에서 다음 값·인자·표현식을 연결한다: study2 · App Router · tsx_version/demo |
| 24 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </footer> |
| 25 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </body> |
| 26 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </html> |
| 27 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 28 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/demo/app/ui/site-header.tsx

[실행 파일](tsx_version/demo/app/ui/site-header.tsx)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/app/ui/site-header.tsx sha256:79bd05c8dcfb0acc6e54a0ebe097a3c039abfb3e10140255de299706d2a1dbaf -->
~~~tsx
import Link from 'next/link';
export function SiteHeader() { return <header className="border-b p-4"><nav aria-label="주 메뉴" className="flex gap-4"><Link href="/">Next.js 학습</Link><Link href="/lab">기초</Link><Link href="/board">게시판·로그인</Link><Link href="/api-docs">API 문서</Link></nav></header>; }
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: Link from 'next/link'; |
| 2 | SiteHeader의 입력·반환 경계를 정의한다. |

## ④ 🔗 연동 포인트

직렬화 가능한 props로 서버 데이터가 화면에 도달한다. 폼에서 서버로 보내는 데이터는 다음 단계의 상태를 거쳐 HTTP 또는 Server Action의 입력이 된다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| useState 오류 | 서버 파일에서 브라우저 훅 사용 | 상호작용 컴포넌트에 use client 지정 |
| Event handlers cannot be passed | 서버 이벤트 함수를 클라이언트에 전달 | 클라이언트 파일 안에 이벤트를 정의 |
| fs 모듈 오류 | 클라이언트가 저장소를 import | Route Handler/서버 컴포넌트로 읽기를 이동 |

## ⑥ 직접 해보기

1. label이 다른 카운터 두 개를 만들고 초기값을 다르게 준다.
2. 버튼 컴포넌트에 리셋 이벤트를 추가한다.
3. 개발자도구에서 초기 HTML과 클릭 후 텍스트를 확인한다.

## ⑦ ☐ 체크리스트

- [ ] Server Component vs Client Component
- [ ] 서버 → 클라이언트 props와 브라우저 이벤트를 구분한다.
- [ ] 서버 전용 모듈을 클라이언트 번들에 넣지 않는다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study3](study3.md)에서 입력 상태를 화면과 연결하고 localStorage에 초안을 저장한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
