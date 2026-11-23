# study3 — 상태·바인딩·로컬 초안 저장

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

입력 상태를 화면과 연결하고 localStorage에 초안을 저장한다.

## ② 📖 이론

변수만 바꾸면 화면은 자동으로 다시 그려지지 않는다. useState의 setter로 상태를 갱신하면 컴포넌트가 새 값으로 렌더링된다. value와 onChange를 연결한 입력을 제어 입력이라고 한다.

localStorage는 브라우저·출처별 영속 저장 공간이다. 서버에는 없고 비밀 토큰을 저장할 장소도 아니다. 예제는 비민감 초안만 저장하며 저장 실패도 사용자에게 보여 준다.

상태는 작업대 위의 메모, localStorage는 개인 서랍이다. 화면 새로고침은 작업대를 비우지만 서랍은 남는다. 첫 렌더는 빈 문자열로 고정해 서버 HTML과 브라우저 첫 HTML을 일치시킨다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. /lab 또는 /board 하단의 초안 textarea에 입력한다.
2. 로컬 저장 후 새로고침하고 불러오기를 누른다.
3. 개발자도구 Application → Local Storage에서 next-study-draft를 확인한다.
4. 브라우저 저장 공간을 막은 경우에도 try/catch가 오류 상태 문장을 표시하는지 본다.

~~~powershell
cd tsx_version/demo
npm run dev
# http://localhost:3000/lab → 초안 입력 → 저장 → 새로고침 → 불러오기
~~~



### tsx_version/demo/course/draft.tsx

[실행 파일](tsx_version/demo/course/draft.tsx)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/course/draft.tsx sha256:5261855d69aff12cd11e08d37569ec418714d9e4ca21f05f8be28d6ccc052f2b -->
~~~tsx
"use client";
import { useState } from "react";
// 첫 렌더는 서버와 동일한 빈 문자열. localStorage는 클릭 이벤트에서만 읽는다.
export function Draft() {
  const [draft, setDraft] = useState(""),
    [status, setStatus] = useState("");
  function save() {
    try {
      localStorage.setItem("next-study-draft", draft);
      setStatus("저장했습니다.");
    } catch {
      setStatus("브라우저 저장 공간을 사용할 수 없습니다.");
    }
  }
  function load() {
    try {
      setDraft(localStorage.getItem("next-study-draft") ?? "");
      setStatus("불러왔습니다.");
    } catch {
      setStatus("불러오기에 실패했습니다.");
    }
  }
  return (
    <section>
      <h2>초안</h2>
      <textarea
        aria-label="초안"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button onClick={save}>로컬 저장</button>
      <button onClick={load}>불러오기</button>
      <p role="status">{status}</p>
    </section>
  );
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 이 모듈과 하위 import를 브라우저 상호작용 경계로 선언한다. |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { useState } from "react"; |
| 3 | 주석: 첫 렌더는 서버와 동일한 빈 문자열. localStorage는 클릭 이벤트에서만 읽는다. |
| 4 | Draft의 입력·반환 경계를 정의한다. |
| 5 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 6 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 7 | save의 입력·반환 경계를 정의한다. |
| 8 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 9 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: localStorage.setItem("next-study-draft", draft); |
| 10 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setStatus("저장했습니다."); |
| 11 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 12 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setStatus("브라우저 저장 공간을 사용할 수 없습니다."); |
| 13 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 14 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 15 | load의 입력·반환 경계를 정의한다. |
| 16 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 17 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setDraft(localStorage.getItem("next-study-draft") ?? ""); |
| 18 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setStatus("불러왔습니다."); |
| 19 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 20 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setStatus("불러오기에 실패했습니다."); |
| 21 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 22 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 23 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return ( |
| 24 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <section> |
| 25 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <h2>초안</h2> |
| 26 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <textarea |
| 27 | 현재 구문에서 다음 값·인자·표현식을 연결한다: aria-label="초안" |
| 28 | 현재 구문에서 다음 값·인자·표현식을 연결한다: value={draft} |
| 29 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: onChange={(e) => setDraft(e.target.value)} |
| 30 | 현재 구문에서 다음 값·인자·표현식을 연결한다: /> |
| 31 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button onClick={save}>로컬 저장</button> |
| 32 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button onClick={load}>불러오기</button> |
| 33 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p role="status">{status}</p> |
| 34 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </section> |
| 35 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 36 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

## ④ 🔗 연동 포인트

초안은 개인 브라우저에만 있다. study5의 API 제출을 성공시키면 서버 DB가 공유 원본이 되며 localStorage를 인증 저장소로 사용하지 않는다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| localStorage is not defined | 서버 렌더에서 브라우저 API 실행 | 클릭 이벤트 또는 effect 안으로 이동 |
| hydration mismatch | 첫 서버·클라이언트 값 불일치 | 동일한 초기값으로 시작 후 명시적으로 불러오기 |
| 다른 포트에서 초안 없음 | 저장소가 origin 단위 | 같은 프로토콜·호스트·포트로 접속 |

## ⑥ 직접 해보기

1. 초안 지우기 버튼을 추가한다.
2. 마지막 저장 시각을 함께 저장한다.
3. 브라우저 두 탭에서 저장·불러오기 결과를 확인한다.

## ⑦ ☐ 체크리스트

- [ ] 제어 입력의 value와 onChange를 설명한다.
- [ ] 브라우저에서 초안을 저장·불러왔다.
- [ ] 개인 초안과 서버 DB 데이터의 역할을 구분한다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study4](study4.md)에서 동적 URL과 쿼리를 처리하고 화면 경로와 API 경로를 구분한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
