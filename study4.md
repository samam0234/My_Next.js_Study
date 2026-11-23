# study4 — 라우팅·요청·오류 화면

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

동적 URL과 쿼리를 처리하고 화면 경로와 API 경로를 구분한다.

## ② 📖 이론

app/hello/[name]/page.tsx는 /hello/이름에 대응한다. params와 searchParams는 Promise이므로 await한다. layout은 자식 페이지를 감싸고 이동 중 유지된다. (group)은 URL에 드러나지 않는 레이아웃 분류다.

Route Handler는 GET, POST 같은 HTTP 함수를 export하며 화면용 page와 같은 경로에 함께 둘 수 없다. 본 과정의 /board는 화면, /api/posts는 JSON 계약이다.

우편주소의 건물 번호가 동적 params라면 배달 요청 메모가 query다. 없는 주소는 not-found, 처리 실패는 error, 기다리는 동안은 loading으로 알려 준다. error 파일은 복구 버튼을 다루므로 클라이언트다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. /hello/next?from=study4를 열고 경로와 쿼리를 따로 확인한다.
2. /posts?slow=1, /posts?boom=1로 기존 특수 파일 실습을 관찰한다. 이 경로는 이전 JSON 실습이며 새 게시판은 /board다.
3. /api/hello와 /api/posts를 호출해 화면 HTML과 JSON 응답을 구분한다.
4. 없는 API는 공통 404 JSON, 없는 페이지는 not-found 화면을 반환하는지 확인한다.

~~~powershell
cd tsx_version/demo
npm run dev
# 별도 터미널
curl.exe -i "http://localhost:3000/hello/next?from=study4"
curl.exe -i http://localhost:3000/api/posts/no-number
curl.exe -i http://localhost:3000/api/absent
~~~



### tsx_version/demo/app/hello/[name]/page.tsx

[실행 파일](tsx_version/demo/app/hello/[name]/page.tsx)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/app/hello/[name]/page.tsx sha256:17c9ede01a714aee83ae9f54325e2ee7d12fbb3b8e36b8de04b750756fb905eb -->
~~~tsx
import Link from "next/link";

type HelloPageProps = {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function HelloPage({ params, searchParams }: HelloPageProps) {
  const { name } = await params;
  const { from } = await searchParams;
  const decoded = decodeURIComponent(name);

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        study2 · /hello/[name]
      </p>
      <h1 className="text-3xl font-bold tracking-tight">안녕하세요, {decoded}님</h1>
      <p className="leading-7 text-stone-600">
        <code className="rounded bg-stone-100 px-1">params.name</code> = {decoded}
        {from ? (
          <>
            {" "}
            · <code className="rounded bg-stone-100 px-1">searchParams.from</code> = {from}
          </>
        ) : null}
      </p>
      <p className="text-sm text-stone-500">
        Next 15부터 <code>params</code>와 <code>searchParams</code>는 Promise라서 await 합니다.
      </p>
      <Link href="/hello/next?from=query" className="text-sm text-accent underline">
        쿼리스트링 예제 보기
      </Link>
    </article>
  );
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: Link from "next/link"; |
| 3 | 현재 구문에서 다음 값·인자·표현식을 연결한다: type HelloPageProps = { |
| 4 | 객체·스키마·속성의 값을 지정한다: params: Promise<{ name: string }>; |
| 5 | 객체·스키마·속성의 값을 지정한다: searchParams: Promise<{ from?: string }>; |
| 6 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: export default async function HelloPage({ params, searchParams }: HelloPageProps) { |
| 9 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const { name } = await params; |
| 10 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const { from } = await searchParams; |
| 11 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const decoded = decodeURIComponent(name); |
| 13 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return ( |
| 14 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <article className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm"> |
| 15 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p className="text-xs font-semibold uppercase tracking-widest text-accent"> |
| 16 | 현재 구문에서 다음 값·인자·표현식을 연결한다: study2 · /hello/[name] |
| 17 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </p> |
| 18 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <h1 className="text-3xl font-bold tracking-tight">안녕하세요, {decoded}님</h1> |
| 19 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p className="leading-7 text-stone-600"> |
| 20 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <code className="rounded bg-stone-100 px-1">params.name</code> = {decoded} |
| 21 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: {from ? ( |
| 22 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <> |
| 23 | 현재 구문에서 다음 값·인자·표현식을 연결한다: {" "} |
| 24 | 현재 구문에서 다음 값·인자·표현식을 연결한다: · <code className="rounded bg-stone-100 px-1">searchParams.from</code> = {from} |
| 25 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </> |
| 26 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ) : null} |
| 27 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </p> |
| 28 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p className="text-sm text-stone-500"> |
| 29 | 현재 구문에서 다음 값·인자·표현식을 연결한다: Next 15부터 <code>params</code>와 <code>searchParams</code>는 Promise라서 await 합니다. |
| 30 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </p> |
| 31 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <Link href="/hello/next?from=query" className="text-sm text-accent underline"> |
| 32 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 쿼리스트링 예제 보기 |
| 33 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </Link> |
| 34 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </article> |
| 35 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 36 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/demo/app/posts/loading.tsx

[실행 파일](tsx_version/demo/app/posts/loading.tsx)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/app/posts/loading.tsx sha256:23c08d5f4779b31eca5fac324e553b8b3b492c4f7d5b2179c55fa24809f61d63 -->
~~~tsx
export default function PostsLoading() {
  return (
    <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-sm font-medium text-stone-500">게시글을 불러오는 중…</p>
      <div className="mt-4 space-y-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-stone-200" />
      </div>
    </div>
  );
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 현재 구문에서 다음 값·인자·표현식을 연결한다: export default function PostsLoading() { |
| 2 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return ( |
| 3 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <div className="rounded-2xl border border-line bg-card p-6 shadow-sm"> |
| 4 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p className="text-sm font-medium text-stone-500">게시글을 불러오는 중…</p> |
| 5 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <div className="mt-4 space-y-3"> |
| 6 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200" /> |
| 7 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <div className="h-4 w-1/2 animate-pulse rounded bg-stone-200" /> |
| 8 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </div> |
| 9 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </div> |
| 10 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 11 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/demo/app/posts/error.tsx

[실행 파일](tsx_version/demo/app/posts/error.tsx)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/app/posts/error.tsx sha256:56652ce057b76d5fbe63efe007de370af914dded17d3c75699bb827a0d3efcd8 -->
~~~tsx
"use client";

export default function PostsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-semibold text-red-800">게시판에서 오류가 났습니다</h2>
      <p className="mt-2 font-mono text-sm text-red-700">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-red-800 px-3 py-1.5 text-sm text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 이 모듈과 하위 import를 브라우저 상호작용 경계로 선언한다. |
| 3 | 현재 구문에서 다음 값·인자·표현식을 연결한다: export default function PostsError({ |
| 4 | 현재 구문에서 다음 값·인자·표현식을 연결한다: error, |
| 5 | 현재 구문에서 다음 값·인자·표현식을 연결한다: reset, |
| 6 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }: { |
| 7 | 객체·스키마·속성의 값을 지정한다: error: Error & { digest?: string }; |
| 8 | 객체·스키마·속성의 값을 지정한다: reset: () => void; |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }) { |
| 10 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return ( |
| 11 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <div className="rounded-2xl border border-red-200 bg-red-50 p-6"> |
| 12 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <h2 className="text-lg font-semibold text-red-800">게시판에서 오류가 났습니다</h2> |
| 13 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p className="mt-2 font-mono text-sm text-red-700">{error.message}</p> |
| 14 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button |
| 15 | 현재 구문에서 다음 값·인자·표현식을 연결한다: type="button" |
| 16 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onClick={reset} |
| 17 | 현재 구문에서 다음 값·인자·표현식을 연결한다: className="mt-4 rounded-lg bg-red-800 px-3 py-1.5 text-sm text-white" |
| 18 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 19 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 다시 시도 |
| 20 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 21 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </div> |
| 22 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 23 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/demo/app/posts/not-found.tsx

[실행 파일](tsx_version/demo/app/posts/not-found.tsx)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/app/posts/not-found.tsx sha256:1f15d57c93a8b79643050296cbd8ce739a1b127bc0f9e33a5010662584729009 -->
~~~tsx
import Link from "next/link";

export default function PostsNotFound() {
  return (
    <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">글을 찾을 수 없습니다</h2>
      <p className="mt-2 text-stone-600">id가 없거나 삭제된 글입니다.</p>
      <Link href="/posts" className="mt-4 inline-block text-sm text-accent underline">
        목록으로
      </Link>
    </div>
  );
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: Link from "next/link"; |
| 3 | 현재 구문에서 다음 값·인자·표현식을 연결한다: export default function PostsNotFound() { |
| 4 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return ( |
| 5 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <div className="rounded-2xl border border-line bg-card p-6 shadow-sm"> |
| 6 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <h2 className="text-lg font-semibold">글을 찾을 수 없습니다</h2> |
| 7 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p className="mt-2 text-stone-600">id가 없거나 삭제된 글입니다.</p> |
| 8 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <Link href="/posts" className="mt-4 inline-block text-sm text-accent underline"> |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 목록으로 |
| 10 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </Link> |
| 11 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </div> |
| 12 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 13 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/demo/app/api/[...path]/route.ts

[실행 파일](tsx_version/demo/app/api/[...path]/route.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/app/api/[...path]/route.ts sha256:a6fe6c02c42bea6a545f265e8f74caf423bc8325f7eaa7dfb27b059e0ed49944 -->
~~~ts
import { handle } from '@/course/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Next의 두 번째 인자(context)를 내부 extension 콜백으로 넘기지 않는다.
function dispatch(request: Request) { return handle(request); }
export { dispatch as GET, dispatch as POST, dispatch as PATCH, dispatch as DELETE, dispatch as OPTIONS, dispatch as PUT };
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { handle } from '@/course/api'; |
| 2 | 이름 있는 값·설정·함수 또는 상태를 준비한다: export const runtime = 'nodejs'; |
| 3 | 이름 있는 값·설정·함수 또는 상태를 준비한다: export const dynamic = 'force-dynamic'; |
| 4 | 주석: Next의 두 번째 인자(context)를 내부 extension 콜백으로 넘기지 않는다. |
| 5 | dispatch의 입력·반환 경계를 정의한다. |
| 6 | 현재 구문에서 다음 값·인자·표현식을 연결한다: export { dispatch as GET, dispatch as POST, dispatch as PATCH, dispatch as DELETE, dispatch as OPTIONS, dispatch as PUT }; |

## ④ 🔗 연동 포인트

쿼리는 목록의 q/page/limit로 이어진다. 클라이언트 fetch의 URL과 Route Handler 경로를 같이 바꿔야 하며, 응답 객체는 study6의 v1 계약에 맞춘다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| params 접근 경고 | Promise를 동기 객체로 사용 | await params 후 구조 분해 |
| page와 route 충돌 | 같은 URL에 화면·HTTP 파일 중복 | API를 app/api로 옮긴다 |
| error 화면이 안 잡음 | 같은 layout 또는 이벤트 오류를 기대 | 세그먼트 경계·이벤트 try/catch 위치를 확인 |

## ⑥ 직접 해보기

1. 동적 이름 경로에 from 쿼리를 추가한다.
2. 없는 페이지와 없는 API의 Content-Type을 비교한다.
3. 목록 검색 쿼리를 URLSearchParams로 만든다.

## ⑦ ☐ 체크리스트

- [ ] App Router 디렉터리 구조
- [ ] `page.tsx` / `layout.tsx` / `loading.tsx` / `error.tsx`
- [ ] Route Handler (`app/api`)
- [ ] 동적 params와 searchParams를 await한다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study5](study5.md)에서 폼 값을 JSON으로 보내고 성공·검증·통신 실패를 화면에 표시한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
