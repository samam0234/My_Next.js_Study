# study12 — UI·상태·폼 라이브러리 연동

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

Radix UI·Zustand·React Hook Form을 Next.js 클라이언트 경계 안에서 사용한다.

## ② 📖 이론

Radix Dialog는 대화상자의 키보드 포커스와 닫기 동작을 제공한다. Title과 Description을 연결해 보조기술이 내용을 이해하도록 한다. 스타일은 앱의 CSS와 함께 사용한다.

Zustand는 작업실 문서 초안만 저장한다. 서버 전역 저장소에 사용자 상태를 보관하면 요청 간 누출될 수 있으므로 브라우저 컴포넌트에서 사용한다. 인증과 서버 DB의 원본은 API다.

React Hook Form의 register는 입력을 등록하고 handleSubmit은 클라이언트 검증을 거친다. isSubmitting은 비동기 제출이 끝날 때까지 유지된다. 서버 검증은 여전히 필요하다. UI 도구는 잘 맞는 공구이고 보안 검사는 작업장 출입 규칙이다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. project의 의존성을 npm ci로 설치하고 /workbench를 연다.
2. Zustand 초안 textarea에 값을 넣고 다른 상태 변경 중에도 유지되는지 확인한다.
3. 질문을 비워 제출해 React Hook Form의 오류 메시지를 본다.
4. 결제 안내 Dialog를 키보드로 열고 Tab·Escape·닫기를 확인한다.

~~~powershell
cd tsx_version/project
npm ci
npm run dev
# /board에서 로그인 후 /workbench로 이동
~~~



### tsx_version/project/src/course/ui-store.ts

[실행 파일](tsx_version/project/src/course/ui-store.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/src/course/ui-store.ts sha256:0a6dd5bd465e2795f82de85fcfe016c3d5e2ad86eda45d27c5bdad57c869c003 -->
~~~ts
"use client";
import { create } from "zustand";
// 서버 전역 상태에 사용자 데이터를 넣지 않는다. 이 스토어는 브라우저 초안 전용이다.
export const useDraftStore = create<{
  text: string;
  setText: (text: string) => void;
}>((set) => ({ text: "", setText: (text) => set({ text }) }));
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 이 모듈과 하위 import를 브라우저 상호작용 경계로 선언한다. |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { create } from "zustand"; |
| 3 | 주석: 서버 전역 상태에 사용자 데이터를 넣지 않는다. 이 스토어는 브라우저 초안 전용이다. |
| 4 | 이름 있는 값·설정·함수 또는 상태를 준비한다: export const useDraftStore = create<{ |
| 5 | 객체·스키마·속성의 값을 지정한다: text: string; |
| 6 | 객체·스키마·속성의 값을 지정한다: setText: (text: string) => void; |
| 7 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }>((set) => ({ text: "", setText: (text) => set({ text }) })); |

### tsx_version/project/src/course/workbench.tsx

[실행 파일](tsx_version/project/src/course/workbench.tsx)

문서 초안은 Zustand, 질문 검증은 React Hook Form, 결제 안내는 Radix Dialog가 맡는다. AI stream reader와 EventSource를 서로 다른 통신 방식으로 정리한다.

<!-- source:tsx_version/project/src/course/workbench.tsx sha256:7173dd1fb23c7b8057e74ec77bff3fcab1c58dbb27cfaf9a2faa3e27473ceed1 -->
~~~tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import * as Dialog from "@radix-ui/react-dialog";
import { useDraftStore } from "./ui-store";
import { api } from "./client";
export function Workbench() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ question: string }>();
  const text = useDraftStore((s) => s.text),
    setText = useDraftStore((s) => s.setText);
  const [answer, setAnswer] = useState(""),
    [message, setMessage] = useState(""),
    [jobs, setJobs] = useState("알림 연결 대기");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onmessage = (e) => setJobs(e.data);
    events.onerror = () => setJobs("로그인 여부와 네트워크를 확인하세요.");
    return () => {
      events.close();
      controller.current?.abort();
    };
  }, []);
  async function summarize(values: { question: string }) {
    setAnswer("");
    setMessage("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, question: values.question }),
        signal: abort.signal,
      });
      if (!response.ok) throw new Error((await response.json()).error.message);
      const reader = response.body!.getReader(),
        decoder = new TextDecoder();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          setAnswer(
            (previous) => previous + decoder.decode(value, { stream: true }),
          );
        }
        setAnswer((previous) => previous + decoder.decode());
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "스트림 오류");
    } finally {
      controller.current = null;
    }
  }
  async function act(fn: () => Promise<unknown>) {
    try {
      const value = await fn();
      setMessage(JSON.stringify(value));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "실패");
    }
  }
  return (
    <section className="course">
      <h1>문서·AI 작업실</h1>
      <a href="/board">게시판·로그인</a>
      <label>
        문서 내용
        <textarea
          value={text}
          maxLength={20_000}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <label>
        txt/md 불러오기
        <input
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 20_000) {
              setMessage("파일은 20KB까지입니다.");
              return;
            }
            void act(async () => {
              const content = await file.text();
              setText(content);
              return api("/api/files", "POST", {
                name: file.name,
                text: content,
              });
            });
          }}
        />
      </label>
      <form
        onSubmit={(event) => {
          void handleSubmit(summarize)(event);
        }}
      >
        <label>
          질문
          <input
            {...register("question", {
              required: "질문을 입력하세요.",
              maxLength: { value: 1000, message: "1000자까지입니다." },
            })}
            defaultValue="핵심을 세 문장으로 요약해 주세요."
          />
        </label>
        <p role="alert">{errors.question?.message}</p>
        <button disabled={isSubmitting || !text.trim()}>요약·질문</button>
        <button type="button" onClick={() => controller.current?.abort()}>
          생성 취소
        </button>
      </form>
      <pre aria-live="polite" style={{ whiteSpace: "pre-wrap" }}>
        {answer}
      </pre>
      <p role="status">{message}</p>
      <button onClick={() => act(() => api("/api/jobs", "POST", { text }))}>
        텍스트 처리 작업 예약
      </button>
      <p>내 작업 알림: {jobs}</p>
      <button
        onClick={() =>
          act(() =>
            fetch("/api/mail", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": crypto.randomUUID(),
              },
              body: JSON.stringify({ text: answer || text }),
            }).then(async (response) => {
              const body = await response.json();
              if (!response.ok) throw new Error(body.error.message);
              return body;
            }),
          )
        }
      >
        내 이메일로 보내기
      </button>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button>테스트 결제 안내</button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay
            style={{ position: "fixed", inset: 0, background: "#0008" }}
          />
          <Dialog.Content
            style={{
              position: "fixed",
              inset: "20% 10% auto",
              padding: 24,
              background: "white",
              color: "#111",
            }}
          >
            <Dialog.Title>Stripe 테스트 결제</Dialog.Title>
            <Dialog.Description>
              테스트 키로 만든 결제 세션으로 이동합니다. 카드 번호는 테스트
              카드만 입력하세요. 돌아온 URL은 결제 성공의 증거가 아닙니다.
            </Dialog.Description>
            <button
              onClick={() =>
                act(async () => {
                  const response = await fetch("/api/payments/checkout", {
                    method: "POST",
                    headers: { "Idempotency-Key": crypto.randomUUID() },
                  });
                  const body = await response.json();
                  if (!response.ok) throw new Error(body.error.message);
                  if (new URL(body.data.url).hostname !== "checkout.stripe.com")
                    throw new Error("결제 주소 오류");
                  window.location.assign(body.data.url);
                })
              }
            >
              테스트 세션 생성
            </button>
            <Dialog.Close asChild>
              <button>닫기</button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 이 모듈과 하위 import를 브라우저 상호작용 경계로 선언한다. |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { useEffect, useRef, useState } from "react"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { useForm } from "react-hook-form"; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: * as Dialog from "@radix-ui/react-dialog"; |
| 5 | 외부 모듈 또는 공용 함수·타입을 가져온다: { useDraftStore } from "./ui-store"; |
| 6 | 외부 모듈 또는 공용 함수·타입을 가져온다: { api } from "./client"; |
| 7 | Workbench의 입력·반환 경계를 정의한다. |
| 8 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const { |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: register, |
| 10 | 입력을 폼 라이브러리에 등록하거나 검증을 거쳐 제출한다. |
| 11 | 객체·스키마·속성의 값을 지정한다: formState: { errors, isSubmitting }, |
| 12 | 입력을 폼 라이브러리에 등록하거나 검증을 거쳐 제출한다. |
| 13 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const text = useDraftStore((s) => s.text), |
| 14 | 현재 구문에서 다음 값·인자·표현식을 연결한다: setText = useDraftStore((s) => s.setText); |
| 15 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 16 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 17 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 18 | 외부 호출 시간 제한 또는 사용자 취소 신호를 준비한다. |
| 19 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 20 | 서버가 보내는 작업 알림 SSE 연결 또는 응답 형식을 구성한다. |
| 21 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: events.onmessage = (e) => setJobs(e.data); |
| 22 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: events.onerror = () => setJobs("로그인 여부와 네트워크를 확인하세요."); |
| 23 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return () => { |
| 24 | 현재 구문에서 다음 값·인자·표현식을 연결한다: events.close(); |
| 25 | 현재 구문에서 다음 값·인자·표현식을 연결한다: controller.current?.abort(); |
| 26 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 27 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }, []); |
| 28 | summarize의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 29 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setAnswer(""); |
| 30 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setMessage(""); |
| 31 | 외부 호출 시간 제한 또는 사용자 취소 신호를 준비한다. |
| 32 | 현재 구문에서 다음 값·인자·표현식을 연결한다: controller.current = abort; |
| 33 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 34 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: const response = await fetch("/api/ai/summary", { |
| 35 | 객체·스키마·속성의 값을 지정한다: method: "POST", |
| 36 | 객체·스키마·속성의 값을 지정한다: headers: { "Content-Type": "application/json" }, |
| 37 | 객체·스키마·속성의 값을 지정한다: body: JSON.stringify({ text, question: values.question }), |
| 38 | 객체·스키마·속성의 값을 지정한다: signal: abort.signal, |
| 39 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 40 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: if (!response.ok) throw new Error((await response.json()).error.message); |
| 41 | 응답 스트림을 순서대로 읽거나 읽기 잠금을 정리한다. |
| 42 | UTF-8 조각 경계를 유지하며 스트림 바이트를 문자열로 바꾼다. |
| 43 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 44 | 배열·반복 요청·스트림을 순서대로 처리하며 종료 조건을 확인한다. |
| 45 | 응답 스트림을 순서대로 읽거나 읽기 잠금을 정리한다. |
| 46 | 입력·상태 조건에 따라 처리 경로를 고른다: if (done) break; |
| 47 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setAnswer( |
| 48 | UTF-8 조각 경계를 유지하며 스트림 바이트를 문자열로 바꾼다. |
| 49 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 50 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 51 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setAnswer((previous) => previous + decoder.decode()); |
| 52 | 성공·실패에 관계없이 잠금·연결·mock을 정리한다. |
| 53 | 응답 스트림을 순서대로 읽거나 읽기 잠금을 정리한다. |
| 54 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 55 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 56 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setMessage(error instanceof Error ? error.message : "스트림 오류"); |
| 57 | 성공·실패에 관계없이 잠금·연결·mock을 정리한다. |
| 58 | 현재 구문에서 다음 값·인자·표현식을 연결한다: controller.current = null; |
| 59 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 60 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 61 | act의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 62 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 63 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const value = await fn(); |
| 64 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setMessage(JSON.stringify(value)); |
| 65 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 66 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setMessage(error instanceof Error ? error.message : "실패"); |
| 67 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 68 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 69 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return ( |
| 70 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <section className="course"> |
| 71 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <h1>문서·AI 작업실</h1> |
| 72 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <a href="/board">게시판·로그인</a> |
| 73 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <label> |
| 74 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 문서 내용 |
| 75 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <textarea |
| 76 | 현재 구문에서 다음 값·인자·표현식을 연결한다: value={text} |
| 77 | 현재 구문에서 다음 값·인자·표현식을 연결한다: maxLength={20_000} |
| 78 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: onChange={(e) => setText(e.target.value)} |
| 79 | 현재 구문에서 다음 값·인자·표현식을 연결한다: /> |
| 80 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </label> |
| 81 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <label> |
| 82 | 현재 구문에서 다음 값·인자·표현식을 연결한다: txt/md 불러오기 |
| 83 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <input |
| 84 | 현재 구문에서 다음 값·인자·표현식을 연결한다: type="file" |
| 85 | 현재 구문에서 다음 값·인자·표현식을 연결한다: accept=".txt,.md,text/plain,text/markdown" |
| 86 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onChange={(e) => { |
| 87 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const file = e.target.files?.[0]; |
| 88 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!file) return; |
| 89 | 입력·상태 조건에 따라 처리 경로를 고른다: if (file.size > 20_000) { |
| 90 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setMessage("파일은 20KB까지입니다."); |
| 91 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return; |
| 92 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 93 | 현재 구문에서 다음 값·인자·표현식을 연결한다: void act(async () => { |
| 94 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const content = await file.text(); |
| 95 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setText(content); |
| 96 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return api("/api/files", "POST", { |
| 97 | 객체·스키마·속성의 값을 지정한다: name: file.name, |
| 98 | 객체·스키마·속성의 값을 지정한다: text: content, |
| 99 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 100 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 101 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 102 | 현재 구문에서 다음 값·인자·표현식을 연결한다: /> |
| 103 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </label> |
| 104 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <form |
| 105 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onSubmit={(event) => { |
| 106 | 입력을 폼 라이브러리에 등록하거나 검증을 거쳐 제출한다. |
| 107 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 108 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 109 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <label> |
| 110 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 질문 |
| 111 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <input |
| 112 | 입력을 폼 라이브러리에 등록하거나 검증을 거쳐 제출한다. |
| 113 | 객체·스키마·속성의 값을 지정한다: required: "질문을 입력하세요.", |
| 114 | 객체·스키마·속성의 값을 지정한다: maxLength: { value: 1000, message: "1000자까지입니다." }, |
| 115 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 116 | 현재 구문에서 다음 값·인자·표현식을 연결한다: defaultValue="핵심을 세 문장으로 요약해 주세요." |
| 117 | 현재 구문에서 다음 값·인자·표현식을 연결한다: /> |
| 118 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </label> |
| 119 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p role="alert">{errors.question?.message}</p> |
| 120 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button disabled={isSubmitting \|\| !text.trim()}>요약·질문</button> |
| 121 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button type="button" onClick={() => controller.current?.abort()}> |
| 122 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 생성 취소 |
| 123 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 124 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </form> |
| 125 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <pre aria-live="polite" style={{ whiteSpace: "pre-wrap" }}> |
| 126 | 현재 구문에서 다음 값·인자·표현식을 연결한다: {answer} |
| 127 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </pre> |
| 128 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p role="status">{message}</p> |
| 129 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button onClick={() => act(() => api("/api/jobs", "POST", { text }))}> |
| 130 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 텍스트 처리 작업 예약 |
| 131 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 132 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p>내 작업 알림: {jobs}</p> |
| 133 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button |
| 134 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onClick={() => |
| 135 | 현재 구문에서 다음 값·인자·표현식을 연결한다: act(() => |
| 136 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: fetch("/api/mail", { |
| 137 | 객체·스키마·속성의 값을 지정한다: method: "POST", |
| 138 | 객체·스키마·속성의 값을 지정한다: headers: { |
| 139 | 객체·스키마·속성의 값을 지정한다: "Content-Type": "application/json", |
| 140 | 객체·스키마·속성의 값을 지정한다: "Idempotency-Key": crypto.randomUUID(), |
| 141 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 142 | 객체·스키마·속성의 값을 지정한다: body: JSON.stringify({ text: answer \|\| text }), |
| 143 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }).then(async (response) => { |
| 144 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const body = await response.json(); |
| 145 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: if (!response.ok) throw new Error(body.error.message); |
| 146 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return body; |
| 147 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 148 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 149 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 150 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 151 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 내 이메일로 보내기 |
| 152 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 153 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <Dialog.Root> |
| 154 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <Dialog.Trigger asChild> |
| 155 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button>테스트 결제 안내</button> |
| 156 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </Dialog.Trigger> |
| 157 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <Dialog.Portal> |
| 158 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <Dialog.Overlay |
| 159 | 현재 구문에서 다음 값·인자·표현식을 연결한다: style={{ position: "fixed", inset: 0, background: "#0008" }} |
| 160 | 현재 구문에서 다음 값·인자·표현식을 연결한다: /> |
| 161 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <Dialog.Content |
| 162 | 현재 구문에서 다음 값·인자·표현식을 연결한다: style={{ |
| 163 | 객체·스키마·속성의 값을 지정한다: position: "fixed", |
| 164 | 객체·스키마·속성의 값을 지정한다: inset: "20% 10% auto", |
| 165 | 객체·스키마·속성의 값을 지정한다: padding: 24, |
| 166 | 객체·스키마·속성의 값을 지정한다: background: "white", |
| 167 | 객체·스키마·속성의 값을 지정한다: color: "#111", |
| 168 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 169 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 170 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <Dialog.Title>Stripe 테스트 결제</Dialog.Title> |
| 171 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <Dialog.Description> |
| 172 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 테스트 키로 만든 결제 세션으로 이동합니다. 카드 번호는 테스트 |
| 173 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 카드만 입력하세요. 돌아온 URL은 결제 성공의 증거가 아닙니다. |
| 174 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </Dialog.Description> |
| 175 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button |
| 176 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onClick={() => |
| 177 | 현재 구문에서 다음 값·인자·표현식을 연결한다: act(async () => { |
| 178 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: const response = await fetch("/api/payments/checkout", { |
| 179 | 객체·스키마·속성의 값을 지정한다: method: "POST", |
| 180 | 객체·스키마·속성의 값을 지정한다: headers: { "Idempotency-Key": crypto.randomUUID() }, |
| 181 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 182 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const body = await response.json(); |
| 183 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: if (!response.ok) throw new Error(body.error.message); |
| 184 | 입력·상태 조건에 따라 처리 경로를 고른다: if (new URL(body.data.url).hostname !== "checkout.stripe.com") |
| 185 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: throw new Error("결제 주소 오류"); |
| 186 | 현재 구문에서 다음 값·인자·표현식을 연결한다: window.location.assign(body.data.url); |
| 187 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 188 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 189 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 190 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 테스트 세션 생성 |
| 191 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 192 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <Dialog.Close asChild> |
| 193 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button>닫기</button> |
| 194 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </Dialog.Close> |
| 195 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </Dialog.Content> |
| 196 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </Dialog.Portal> |
| 197 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </Dialog.Root> |
| 198 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </section> |
| 199 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 200 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

## ④ 🔗 연동 포인트

라이브러리 폼의 질문·초안이 study18의 /api/ai/summary에 전달된다. 서버 세션은 /api/auth/me, 파일·작업은 DB가 원본이며 UI store에 토큰을 넣지 않는다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| 서버에서 hook 오류 | use client 누락 | UI 진입 모듈에 클라이언트 경계 지정 |
| 다른 사용자의 초안 공유 | 서버 전역 store 사용 | 브라우저 상태로 제한 |
| Dialog 접근성 경고 | Title·Description 없음 | 제목·설명을 명시 |

## ⑥ 직접 해보기

1. 질문 길이 오류를 입력 아래에 표시한다.
2. Dialog를 마우스 없이 열고 닫는다.
3. 초안 지우기 동작을 store에 추가한다.

## ⑦ ☐ 체크리스트

- [ ] UI·상태·폼 라이브러리를 클라이언트 경계에 연결했다.
- [ ] 포커스·레이블·오류 표시를 확인했다.
- [ ] 서버 데이터와 브라우저 초안 상태를 구분한다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study13](study13.md)에서 서버 전용 키로 외부 서비스를 호출하고 콜백·업로드 경계를 검증한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
