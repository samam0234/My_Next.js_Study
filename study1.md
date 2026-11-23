# study1 — Hello World와 JSX 기본 문법

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

서버에서 첫 화면을 그리고 JSX 표현식·조건·반복을 이해한다.

## ② 📖 이론

page.tsx의 default export가 URL의 화면이다. JSX의 중괄호는 문자열, 숫자, 계산 결과를 화면에 끼우는 자리다. 속성은 className, 이벤트 이름은 onClick처럼 작성한다.

컴포넌트 함수는 화면 조각을 반환한다. 배열은 map으로 li 목록을 만들고 각 항목에 안정적인 key를 준다. 조건식은 삼항 연산자 또는 조건부 렌더링으로 표시한다.

템플릿을 빈 편지지에 비유하면 JSX는 양식이고 중괄호는 수신인과 날짜를 적는 칸이다. 서버가 준비한 텍스트도 초기 HTML에 들어가며 브라우저 이벤트는 별도로 연결된다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. demo를 실행하고 /lab에서 Hello, Next.js!를 확인한다.
2. page의 제목을 바꾸고 저장해 Fast Refresh가 결과를 반영하는지 본다.
3. 개발자도구 Elements에서 h1과 버튼을, Network에서 문서와 /api/hello 응답을 확인한다.
4. 서버 로그는 터미널에서, 브라우저 이벤트 로그는 개발자도구 Console에서 확인한다. 서버 출력과 브라우저 출력을 구분한다.

~~~powershell
cd tsx_version/demo
npm run dev
# 다른 터미널
curl.exe -i http://localhost:3000/api/hello
curl.exe -s http://localhost:3000/lab
~~~

### 문법을 직접 바꾸기

/lab의 return 안에서 {1 + 2}, {true ? "표시" : "숨김"}, {["라우팅", "컴포넌트"].map(item => <p key={item}>{item}</p>)}를 각각 넣어 결과를 본다. 문자열로 넣은 HTML은 텍스트로 표시되며 실행되지 않는다. 태그는 하나의 부모나 Fragment로 감싼다. 정상 응답은 200과 JSON의 data.message이다.

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

## ④ 🔗 연동 포인트

page가 데이터와 초기 props를 준비하고 Counter가 클릭을 처리한다. Fast Refresh와 개발자도구로 확인한 방식은 이후 API 폼 디버깅에도 그대로 쓴다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| Adjacent JSX elements | 부모 없이 여러 태그 반환 | 부모 section 또는 Fragment로 감싼다 |
| 화면이 갱신되지 않음 | 다른 앱·포트를 보고 있음 | 터미널 경로와 브라우저 URL 확인 |
| key 경고 | map 항목의 식별자 없음 | 항목 고유 id를 key로 지정 |

## ⑥ 직접 해보기

1. 이름 변수를 만들고 환영 문장을 표시한다.
2. 학습 주제 세 개를 map으로 렌더링한다.
3. 조건에 따라 시작 안내를 표시하고 Network의 200 응답을 확인한다.

## ⑦ ☐ 체크리스트

- [ ] JSX 중괄호와 태그를 구분한다.
- [ ] 조건과 반복 결과를 표시했다.
- [ ] Fast Refresh와 개발자도구로 결과를 확인했다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study2](study2.md)에서 페이지·컴포넌트·모듈을 나누고 props와 이벤트로 연결한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
