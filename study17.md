# study17 — 실시간 알림·WebSocket·파일 확장

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

SSE 작업 알림과 선택적 WebSocket을 인증 경계 안에서 연결한다.

## ② 📖 이론

SSE는 서버→브라우저 단방향 알림이다. EventSource는 끊김 뒤 자동 재연결하며 같은 출처 쿠키를 보낸다. /api/events는 사용자 본인 작업의 id·상태만 보낸다. 30초마다 닫고 다음 연결에서 세션을 다시 확인한다.

WebSocket은 양방향 연결이다. 선택적 custom Next 서버의 /ws 예제는 Upgrade 시 Origin과 세션을 검사하고 메시지마다 세션을 다시 확인한다. 본인에게만 echo하며 다른 사용자에게 broadcast하지 않는다. 연결·메시지 크기·종료를 제한한다.

알림은 전광판, WebSocket은 무전기다. SSE 스트림과 업로드 처리 모두 프로세스·호스트 제한을 확인해야 한다. 장기 연결을 지원하지 않는 호스트에서 custom WebSocket 서버를 그대로 배포할 수는 없다. 기본 standalone 배포는 SSE를 사용한다.

파일 확장은 업로드 허용 형식·크기·소유자·보관 정책이 먼저다. 현재 txt/md를 DB에 보관하며 바이너리 업로드를 추가하려면 개체 저장소, 서명 URL, 악성 파일 검사, MIME 실검증이 필요하다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. project에서 로그인하고 /workbench를 연다. Network에서 text/event-stream을 확인한다.
2. 텍스트 작업을 예약하고 별도 워커를 실행해 상태 알림이 바뀌는지 본다.
3. 다른 계정에서는 원 계정 작업이 보이지 않는지 확인한다. 페이지를 나가면 EventSource·타이머가 정리되는지 본다.
4. 선택 실습은 기본 서버를 끄고 scripts/ws-server.ts를 실행한다. 같은 출처 로그인 후 브라우저에서 WebSocket /ws를 연결해 echo를 확인한다.

~~~powershell
cd tsx_version/project
npm run dev
# 다른 터미널
npm run worker
# 선택적 WebSocket 실습: 기존 서버 종료 후
# node --env-file-if-exists=.env.local --import tsx scripts/ws-server.ts
# 브라우저 콘솔: const socket = new WebSocket("ws://localhost:3000/ws")
# socket.onmessage = event => console.log(event.data)
# socket.onopen = () => socket.send("hello")
~~~



### tsx_version/project/src/course/advanced.ts

[실행 파일](tsx_version/project/src/course/advanced.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/src/course/advanced.ts sha256:64aeef4bbbb03b40df3ce5acecbcf7c600df7b226faa02739b6c9b873835b2e9 -->
~~~ts
import { ApiError, identifier, text } from "./domain";
import { getRepository } from "./repository";
import { authenticate, rateLimit } from "./security";
import { jsonBody, reply } from "./http";
import { summarize } from "./ai";
import { checkout, sendMail } from "./services";

export async function advanced(request: Request): Promise<Response> {
  const repo = await getRepository(),
    state = await repo.read(),
    { user } = authenticate(request, state);
  const pathname = new URL(request.url).pathname.replace(
    /^\/api\/v1\//,
    "/api/",
  );
  rateLimit(`advanced:${user.id}`, 30);
  if (pathname === "/api/files" && request.method === "POST") {
    // 작은 텍스트 문서만 허용한다. PDF/OCR은 별도 파서·악성 파일 검사 단계가 필요하다.
    if (Number(request.headers.get("content-length")) > 100_000)
      throw new ApiError(
        413,
        "PAYLOAD_TOO_LARGE",
        "파일 요청은 100KB 이하입니다.",
      );
    const body = await jsonBody(request); // 실제 읽기 64KB 제한. base64 대신 UTF-8 JSON 업로드.
    const name = text(body.name, "name", 100),
      content = text(body.text, "text", 20_000);
    if (!/^[\w가-힣 .-]+\.(txt|md)$/i.test(name))
      throw new ApiError(400, "VALIDATION_ERROR", "txt/md 파일만 허용합니다.");
    const file = await repo.change((s) => {
      const file = { id: ++s.seq, ownerId: user.id, name, text: content };
      s.files.push(file);
      return file;
    });
    return reply({ data: file }, 201);
  }
  if (pathname === "/api/files" && request.method === "GET")
    return reply({ data: state.files.filter((f) => f.ownerId === user.id) });
  if (pathname === "/api/ai/summary" && request.method === "POST") {
    const body = await jsonBody(request);
    let content: string;
    if (body.fileId !== undefined) {
      const file = state.files.find(
        (f) =>
          f.id === identifier(String(body.fileId)) && f.ownerId === user.id,
      );
      if (!file)
        throw new ApiError(404, "NOT_FOUND", "내 문서를 찾을 수 없습니다.");
      content = file.text;
    } else content = text(body.text, "text", 20_000);
    const question =
      body.question === undefined
        ? undefined
        : text(body.question, "question", 1000);
    return summarize(content, question);
  }
  if (pathname === "/api/mail" && request.method === "POST") {
    const body = await jsonBody(request),
      content = text(body.text, "text", 5000);
    // 목적지는 세션 사용자로 고정하여 임의 주소 스팸 발송을 막는다.
    return reply({
      data: await sendMail(
        user.email,
        content,
        text(request.headers.get("idempotency-key"), "idempotency-key", 100),
      ),
    });
  }
  if (pathname === "/api/payments/checkout" && request.method === "POST")
    return reply(
      {
        data: await checkout(
          user.id,
          text(request.headers.get("idempotency-key"), "idempotency-key", 100),
        ),
      },
      201,
    );
  if (pathname === "/api/jobs" && request.method === "POST") {
    const content = text((await jsonBody(request)).text, "text", 20_000);
    const job = await repo.change((s) => {
      const job = {
        id: ++s.seq,
        ownerId: user.id,
        status: "pending" as const,
        attempts: 0,
        text: content,
      };
      s.jobs.push(job);
      return job;
    });
    return reply({ data: job }, 202, { Location: `/api/jobs/${job.id}` });
  }
  const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
  if (jobMatch && request.method === "GET") {
    const job = state.jobs.find(
      (j) => j.id === identifier(jobMatch[1]) && j.ownerId === user.id,
    );
    if (!job) throw new ApiError(404, "NOT_FOUND", "작업이 없습니다.");
    return reply({ data: job });
  }
  if (pathname === "/api/events" && request.method === "GET") {
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    let busy = false,
      stopped = false,
      ticks = 0;
    const stop = () => {
      stopped = true;
      if (timer) clearInterval(timer);
      request.signal.removeEventListener("abort", abort);
    };
    let closeStream: (() => void) | undefined;
    const abort = () => {
      stop();
      closeStream?.();
    };
    return new Response(
      new ReadableStream({
        start(controller) {
          closeStream = () => {
            try {
              controller.close();
            } catch {}
          };
          controller.enqueue(encoder.encode("retry: 3000\n\n"));
          timer = setInterval(async () => {
            if (busy || stopped) return;
            busy = true;
            try {
              const current = await repo.read();
              authenticate(request, current);
              if (stopped) return;
              const jobs = current.jobs
                .filter((j) => j.ownerId === user.id)
                .map((j) => ({ id: j.id, status: j.status }));
              controller.enqueue(
                encoder.encode(
                  `id: ${Date.now()}\ndata: ${JSON.stringify(jobs)}\n\n`,
                ),
              );
              if (++ticks >= 15) {
                stop();
                closeStream?.();
              }
            } catch {
              stop();
              closeStream?.();
            } finally {
              busy = false;
            }
          }, 2000);
          request.signal.addEventListener("abort", abort, { once: true });
        },
        cancel() {
          stop();
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      },
    );
  }
  throw new ApiError(404, "NOT_FOUND", "없는 확장 API 경로입니다.");
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { ApiError, identifier, text } from "./domain"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { getRepository } from "./repository"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { authenticate, rateLimit } from "./security"; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: { jsonBody, reply } from "./http"; |
| 5 | 외부 모듈 또는 공용 함수·타입을 가져온다: { summarize } from "./ai"; |
| 6 | 외부 모듈 또는 공용 함수·타입을 가져온다: { checkout, sendMail } from "./services"; |
| 8 | advanced의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 9 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const repo = await getRepository(), |
| 10 | 현재 구문에서 다음 값·인자·표현식을 연결한다: state = await repo.read(), |
| 11 | 현재 요청의 토큰·서명·만료·로그아웃 상태와 사용자 존재를 확인한다. |
| 12 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const pathname = new URL(request.url).pathname.replace( |
| 13 | 현재 구문에서 다음 값·인자·표현식을 연결한다: /^\/api\/v1\//, |
| 14 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/", |
| 15 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 16 | 현재 구문에서 다음 값·인자·표현식을 연결한다: rateLimit(ˋadvanced:${user.id}ˋ, 30); |
| 17 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/files" && request.method === "POST") { |
| 18 | 주석: 작은 텍스트 문서만 허용한다. PDF/OCR은 별도 파서·악성 파일 검사 단계가 필요하다. |
| 19 | 입력·상태 조건에 따라 처리 경로를 고른다: if (Number(request.headers.get("content-length")) > 100_000) |
| 20 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 21 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 413, |
| 22 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "PAYLOAD_TOO_LARGE", |
| 23 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "파일 요청은 100KB 이하입니다.", |
| 24 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 25 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const body = await jsonBody(request); // 실제 읽기 64KB 제한. base64 대신 UTF-8 JSON 업로드. |
| 26 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const name = text(body.name, "name", 100), |
| 27 | 현재 구문에서 다음 값·인자·표현식을 연결한다: content = text(body.text, "text", 20_000); |
| 28 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: if (!/^[\w가-힣 .-]+\.(txt\|md)$/i.test(name)) |
| 29 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(400, "VALIDATION_ERROR", "txt/md 파일만 허용합니다."); |
| 30 | Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다. |
| 31 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const file = { id: ++s.seq, ownerId: user.id, name, text: content }; |
| 32 | 현재 구문에서 다음 값·인자·표현식을 연결한다: s.files.push(file); |
| 33 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return file; |
| 34 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 35 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ data: file }, 201); |
| 36 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 37 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/files" && request.method === "GET") |
| 38 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ data: state.files.filter((f) => f.ownerId === user.id) }); |
| 39 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/ai/summary" && request.method === "POST") { |
| 40 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const body = await jsonBody(request); |
| 41 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let content: string; |
| 42 | 입력·상태 조건에 따라 처리 경로를 고른다: if (body.fileId !== undefined) { |
| 43 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const file = state.files.find( |
| 44 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (f) => |
| 45 | 현재 구문에서 다음 값·인자·표현식을 연결한다: f.id === identifier(String(body.fileId)) && f.ownerId === user.id, |
| 46 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 47 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!file) |
| 48 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(404, "NOT_FOUND", "내 문서를 찾을 수 없습니다."); |
| 49 | 현재 구문에서 다음 값·인자·표현식을 연결한다: content = file.text; |
| 50 | 현재 구문에서 다음 값·인자·표현식을 연결한다: } else content = text(body.text, "text", 20_000); |
| 51 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const question = |
| 52 | 현재 구문에서 다음 값·인자·표현식을 연결한다: body.question === undefined |
| 53 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ? undefined |
| 54 | 현재 구문에서 다음 값·인자·표현식을 연결한다: : text(body.question, "question", 1000); |
| 55 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return summarize(content, question); |
| 56 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 57 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/mail" && request.method === "POST") { |
| 58 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const body = await jsonBody(request), |
| 59 | 현재 구문에서 다음 값·인자·표현식을 연결한다: content = text(body.text, "text", 5000); |
| 60 | 주석: 목적지는 세션 사용자로 고정하여 임의 주소 스팸 발송을 막는다. |
| 61 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ |
| 62 | 객체·스키마·속성의 값을 지정한다: data: await sendMail( |
| 63 | 현재 구문에서 다음 값·인자·표현식을 연결한다: user.email, |
| 64 | 현재 구문에서 다음 값·인자·표현식을 연결한다: content, |
| 65 | 현재 구문에서 다음 값·인자·표현식을 연결한다: text(request.headers.get("idempotency-key"), "idempotency-key", 100), |
| 66 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 67 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 68 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 69 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/payments/checkout" && request.method === "POST") |
| 70 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply( |
| 71 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 72 | 객체·스키마·속성의 값을 지정한다: data: await checkout( |
| 73 | 현재 구문에서 다음 값·인자·표현식을 연결한다: user.id, |
| 74 | 현재 구문에서 다음 값·인자·표현식을 연결한다: text(request.headers.get("idempotency-key"), "idempotency-key", 100), |
| 75 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 76 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 77 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 201, |
| 78 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 79 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/jobs" && request.method === "POST") { |
| 80 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const content = text((await jsonBody(request)).text, "text", 20_000); |
| 81 | Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다. |
| 82 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const job = { |
| 83 | 객체·스키마·속성의 값을 지정한다: id: ++s.seq, |
| 84 | 객체·스키마·속성의 값을 지정한다: ownerId: user.id, |
| 85 | 객체·스키마·속성의 값을 지정한다: status: "pending" as const, |
| 86 | 객체·스키마·속성의 값을 지정한다: attempts: 0, |
| 87 | 객체·스키마·속성의 값을 지정한다: text: content, |
| 88 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 89 | 현재 구문에서 다음 값·인자·표현식을 연결한다: s.jobs.push(job); |
| 90 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return job; |
| 91 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 92 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ data: job }, 202, { Location: ˋ/api/jobs/${job.id}ˋ }); |
| 93 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 94 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/); |
| 95 | 입력·상태 조건에 따라 처리 경로를 고른다: if (jobMatch && request.method === "GET") { |
| 96 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const job = state.jobs.find( |
| 97 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (j) => j.id === identifier(jobMatch[1]) && j.ownerId === user.id, |
| 98 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 99 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: if (!job) throw new ApiError(404, "NOT_FOUND", "작업이 없습니다."); |
| 100 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ data: job }); |
| 101 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 102 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/events" && request.method === "GET") { |
| 103 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const encoder = new TextEncoder(); |
| 104 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let timer: ReturnType<typeof setInterval> \| undefined; |
| 105 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let busy = false, |
| 106 | 현재 구문에서 다음 값·인자·표현식을 연결한다: stopped = false, |
| 107 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ticks = 0; |
| 108 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const stop = () => { |
| 109 | 현재 구문에서 다음 값·인자·표현식을 연결한다: stopped = true; |
| 110 | 스트림 데이터를 전달하거나 연결·타이머·이벤트를 정리한다. |
| 111 | 스트림 데이터를 전달하거나 연결·타이머·이벤트를 정리한다. |
| 112 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 113 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let closeStream: (() => void) \| undefined; |
| 114 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const abort = () => { |
| 115 | 현재 구문에서 다음 값·인자·표현식을 연결한다: stop(); |
| 116 | 현재 구문에서 다음 값·인자·표현식을 연결한다: closeStream?.(); |
| 117 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 118 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return new Response( |
| 119 | 현재 구문에서 다음 값·인자·표현식을 연결한다: new ReadableStream({ |
| 120 | 현재 구문에서 다음 값·인자·표현식을 연결한다: start(controller) { |
| 121 | 현재 구문에서 다음 값·인자·표현식을 연결한다: closeStream = () => { |
| 122 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 123 | 스트림 데이터를 전달하거나 연결·타이머·이벤트를 정리한다. |
| 124 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 125 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 126 | 스트림 데이터를 전달하거나 연결·타이머·이벤트를 정리한다. |
| 127 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: timer = setInterval(async () => { |
| 128 | 입력·상태 조건에 따라 처리 경로를 고른다: if (busy \|\| stopped) return; |
| 129 | 현재 구문에서 다음 값·인자·표현식을 연결한다: busy = true; |
| 130 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 131 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const current = await repo.read(); |
| 132 | 현재 요청의 토큰·서명·만료·로그아웃 상태와 사용자 존재를 확인한다. |
| 133 | 입력·상태 조건에 따라 처리 경로를 고른다: if (stopped) return; |
| 134 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const jobs = current.jobs |
| 135 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .filter((j) => j.ownerId === user.id) |
| 136 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .map((j) => ({ id: j.id, status: j.status })); |
| 137 | 스트림 데이터를 전달하거나 연결·타이머·이벤트를 정리한다. |
| 138 | 현재 구문에서 다음 값·인자·표현식을 연결한다: encoder.encode( |
| 139 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ˋid: ${Date.now()}\ndata: ${JSON.stringify(jobs)}\n\nˋ, |
| 140 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 141 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 142 | 입력·상태 조건에 따라 처리 경로를 고른다: if (++ticks >= 15) { |
| 143 | 현재 구문에서 다음 값·인자·표현식을 연결한다: stop(); |
| 144 | 현재 구문에서 다음 값·인자·표현식을 연결한다: closeStream?.(); |
| 145 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 146 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 147 | 현재 구문에서 다음 값·인자·표현식을 연결한다: stop(); |
| 148 | 현재 구문에서 다음 값·인자·표현식을 연결한다: closeStream?.(); |
| 149 | 성공·실패에 관계없이 잠금·연결·mock을 정리한다. |
| 150 | 현재 구문에서 다음 값·인자·표현식을 연결한다: busy = false; |
| 151 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 152 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }, 2000); |
| 153 | 현재 구문에서 다음 값·인자·표현식을 연결한다: request.signal.addEventListener("abort", abort, { once: true }); |
| 154 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 155 | 현재 구문에서 다음 값·인자·표현식을 연결한다: cancel() { |
| 156 | 현재 구문에서 다음 값·인자·표현식을 연결한다: stop(); |
| 157 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 158 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 159 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 160 | 객체·스키마·속성의 값을 지정한다: headers: { |
| 161 | 서버가 보내는 작업 알림 SSE 연결 또는 응답 형식을 구성한다. |
| 162 | 객체·스키마·속성의 값을 지정한다: "Cache-Control": "no-cache, no-transform", |
| 163 | 객체·스키마·속성의 값을 지정한다: "X-Accel-Buffering": "no", |
| 164 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 165 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 166 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 167 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 168 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(404, "NOT_FOUND", "없는 확장 API 경로입니다."); |
| 169 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/project/scripts/ws-server.ts

[실행 파일](tsx_version/project/scripts/ws-server.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/scripts/ws-server.ts sha256:ad363c5102968825a56dc3e4f53e5af793174fb8680f21c8254b48fd5f8d7e2b -->
~~~ts
import next from "next";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { authenticate } from "../src/course/security";
import { getRepository } from "../src/course/repository";
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
await app.prepare();
const server = createServer(app.getRequestHandler());
const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on("upgrade", async (request, socket, head) => {
  if (request.url?.split("?")[0] !== "/ws") {
    app.getUpgradeHandler()(request, socket, head);
    return;
  }
  try {
    if (request.headers.origin !== process.env.APP_ORIGIN)
      throw new Error("Origin");
    const headers = new Headers();
    if (request.headers.cookie) headers.set("Cookie", request.headers.cookie);
    const state = await (await getRepository()).read();
    authenticate(
      new Request(`${process.env.APP_ORIGIN}/ws`, { headers }),
      state,
    );
    sockets.handleUpgrade(request, socket, head, (ws) => {
      ws.send(JSON.stringify({ type: "connected" }));
      // 학습용 echo. 사용자 간 브로드캐스트는 하지 않는다.
      ws.on("message", async (data) => {
        try {
          authenticate(
            new Request(`${process.env.APP_ORIGIN}/ws`, { headers }),
            await (await getRepository()).read(),
          );
          ws.send(
            JSON.stringify({
              type: "echo",
              text: data.toString().slice(0, 1000),
            }),
          );
        } catch {
          ws.close(1008, "Session expired");
        }
      });
      const timer = setTimeout(() => ws.close(1000, "Reconnect"), 30_000);
      ws.on("close", () => clearTimeout(timer));
    });
  } catch {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});
server.listen(Number(process.env.PORT ?? 3000), "127.0.0.1", () =>
  console.log("Next.js + WebSocket /ws 시작"),
);
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: next from "next"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { createServer } from "node:http"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { WebSocketServer } from "ws"; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: { authenticate } from "../src/course/security"; |
| 5 | 외부 모듈 또는 공용 함수·타입을 가져온다: { getRepository } from "../src/course/repository"; |
| 6 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const dev = process.env.NODE_ENV !== "production"; |
| 7 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const app = next({ dev }); |
| 8 | DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: await app.prepare(); |
| 9 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const server = createServer(app.getRequestHandler()); |
| 10 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 }); |
| 11 | 현재 구문에서 다음 값·인자·표현식을 연결한다: server.on("upgrade", async (request, socket, head) => { |
| 12 | 입력·상태 조건에 따라 처리 경로를 고른다: if (request.url?.split("?")[0] !== "/ws") { |
| 13 | 현재 구문에서 다음 값·인자·표현식을 연결한다: app.getUpgradeHandler()(request, socket, head); |
| 14 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return; |
| 15 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 16 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 17 | 입력·상태 조건에 따라 처리 경로를 고른다: if (request.headers.origin !== process.env.APP_ORIGIN) |
| 18 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: throw new Error("Origin"); |
| 19 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const headers = new Headers(); |
| 20 | 입력·상태 조건에 따라 처리 경로를 고른다: if (request.headers.cookie) headers.set("Cookie", request.headers.cookie); |
| 21 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const state = await (await getRepository()).read(); |
| 22 | 현재 요청의 토큰·서명·만료·로그아웃 상태와 사용자 존재를 확인한다. |
| 23 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: new Request(ˋ${process.env.APP_ORIGIN}/wsˋ, { headers }), |
| 24 | 현재 구문에서 다음 값·인자·표현식을 연결한다: state, |
| 25 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 26 | 현재 구문에서 다음 값·인자·표현식을 연결한다: sockets.handleUpgrade(request, socket, head, (ws) => { |
| 27 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ws.send(JSON.stringify({ type: "connected" })); |
| 28 | 주석: 학습용 echo. 사용자 간 브로드캐스트는 하지 않는다. |
| 29 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ws.on("message", async (data) => { |
| 30 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 31 | 현재 요청의 토큰·서명·만료·로그아웃 상태와 사용자 존재를 확인한다. |
| 32 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: new Request(ˋ${process.env.APP_ORIGIN}/wsˋ, { headers }), |
| 33 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await (await getRepository()).read(), |
| 34 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 35 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ws.send( |
| 36 | 현재 구문에서 다음 값·인자·표현식을 연결한다: JSON.stringify({ |
| 37 | 객체·스키마·속성의 값을 지정한다: type: "echo", |
| 38 | 객체·스키마·속성의 값을 지정한다: text: data.toString().slice(0, 1000), |
| 39 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 40 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 41 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 42 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ws.close(1008, "Session expired"); |
| 43 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 44 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 45 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: const timer = setTimeout(() => ws.close(1000, "Reconnect"), 30_000); |
| 46 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ws.on("close", () => clearTimeout(timer)); |
| 47 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 48 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 49 | 현재 구문에서 다음 값·인자·표현식을 연결한다: socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); |
| 50 | 현재 구문에서 다음 값·인자·표현식을 연결한다: socket.destroy(); |
| 51 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 52 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 53 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: server.listen(Number(process.env.PORT ?? 3000), "127.0.0.1", () => |
| 54 | 현재 구문에서 다음 값·인자·표현식을 연결한다: console.log("Next.js + WebSocket /ws 시작"), |
| 55 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

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

SSE는 study15의 DB 작업 상태를 전달하며 실제 작업은 워커가 수행한다. AI 생성 텍스트 스트림은 study18의 fetch reader로 읽고 SSE 이벤트와 혼동하지 않는다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| 알림이 한 번에 몰림 | reverse proxy buffering | X-Accel-Buffering·스트림 timeout·압축 정책 확인 |
| 연결이 계속 남음 | cleanup 누락 | EventSource.close·AbortController·timer 정리 |
| WebSocket 401 | Origin·쿠키·세션 불일치 | 같은 출처·로그인·APP_ORIGIN 확인 |

## ⑥ 직접 해보기

1. 알림 연결을 끊고 재연결 후 최신 상태를 확인한다.
2. 다른 Origin의 WebSocket Upgrade가 거절되는지 확인한다.
3. 파일 한도 초과와 금지 확장자를 요청해 413/400을 확인한다.

## ⑦ ☐ 체크리스트

- [ ] SSE·WebSocket의 방향·수명·호스트 조건을 설명한다.
- [ ] 알림과 파일에 사용자 소유권을 적용했다.
- [ ] 연결 종료·재연결·크기 제한을 확인한다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study18](study18.md)에서 문서 요약·질문 스트림과 MCP 서버·클라이언트를 Next.js 학습 서비스에 붙인다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
