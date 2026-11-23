# study9 — 테스트·디버깅·오류 TOP 10

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

단위·요청·실서버 테스트로 API 계약과 보안 회귀를 검증한다.

## ② 📖 이론

도메인 단위 테스트는 문자열 검증·id·페이지네이션을 빠르게 확인한다. 요청 테스트는 실제 Request를 handler에 전달하고 상태·헤더·본문과 DB 변화를 검사한다. 실서버 smoke는 Next의 경로 해석까지 포함한다.

DB는 임시 SQLite 파일을 써 사용자 데이터를 건드리지 않는다. 메일·결제는 fetch를 가짜 응답으로 교체하고 finally에서 원래 fetch로 복구한다. AI_MODE=mock은 테스트라는 응답 헤더와 텍스트를 명시하며 실제 모델 검증과 구분한다.

시험지를 나누듯 작은 함수 시험, 접수 창구 시험, 실제 가게 방문 시험을 따로 한다. 같은 mock만 검사하면 실제 연결을 보장하지 못하므로 서버 DB·외부 계정 검증은 별도 결과로 남긴다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. npm test로 도메인·API·보안·MCP 요청을 실행한다.
2. npm run build 후 npm run test:http로 실제 Next 서버에서 HTML·API를 확인한다.
3. 실패 응답의 X-Request-Id를 터미널 JSON 로그의 requestId와 맞춘다.
4. VS Code JavaScript Debug Terminal에서 dev를 실행하고 Route Handler에 중단점을 건다. Network의 Request Payload와 응답 fields를 함께 본다.

~~~powershell
cd tsx_version/demo
npm test
npm run lint
npm run build
npm run test:http
# 확장 모듈 테스트도 포함하지만 demo HTTP는 기초 API만 연결한다.
~~~

### 자주 나는 오류 TOP 10

| 증상 | 원인 | 해결 |
|---|---|---|
| node/npm 없음 | PATH | 새 터미널·설치 버전 확인 |
| EADDRINUSE | 포트 중복 | 포트·APP_ORIGIN 변경 |
| Cannot find module | 잘못된 폴더·설치 | 앱 폴더에서 npm ci |
| useState 사용 오류 | 서버 경계 | use client 컴포넌트로 이동 |
| hydration mismatch | 첫 렌더 차이 | 동일 초기값·브라우저 API 지연 |
| params Promise | await 누락 | await params/searchParams |
| JSON parse 오류 | 204·깨진 본문 | 204 분기·서버 400 |
| 401 | 쿠키·서명·만료 | JWT_SECRET와 /auth/me 확인 |
| 403 | 다른 작성자·Origin | 세션 소유자와 출처 확인 |
| DB locked/연결 실패 | 잠금·URL·엔진 | timeout·트랜잭션·DB health 확인 |

### tsx_version/project/tests/course.test.ts

[실행 파일](tsx_version/project/tests/course.test.ts)

실제 Request와 임시 DB로 상태·응답·데이터 변화를 확인한다. 외부 fetch는 필요한 시험 안에서만 바꾸고 finally로 원복한다.

<!-- source:tsx_version/project/tests/course.test.ts sha256:9d4b2cd9b90057e59122cc058619bea0aa40e5fdff2ba1915c0648594670d7d2 -->
~~~ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createHmac } from "node:crypto";
import {
  ApiError,
  emptyState,
  identifier,
  listPosts,
  text,
} from "../src/course/domain";
import { route as handle } from "../src/course/entry";
import { runOnce } from "../src/course/worker";
import { createMcpServer } from "../src/course/mcp-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
mkdirSync("data", { recursive: true });
process.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters";
process.env.COURSE_DB_PATH = `data/test-${crypto.randomUUID()}.db`;
process.env.AI_MODE = "mock";
process.env.APP_ORIGIN = "http://localhost:3000";
const email = `test-${crypto.randomUUID()}@example.com`;
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
  extra: Record<string, string> = {},
) {
  const headers = {
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
  return handle(
    new Request(`http://localhost:3000${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}
test("도메인 검증과 페이지네이션", () => {
  assert.equal(text(" hello ", "title", 10), "hello");
  assert.throws(() => identifier("1e2"), ApiError);
  assert.throws(() => identifier("0"), ApiError);
  assert.throws(() => text("", "title", 10), ApiError);
  assert.equal(
    listPosts(emptyState(), new URLSearchParams("limit=99")).meta.limit,
    50,
  );
  assert.throws(
    () => listPosts(emptyState(), new URLSearchParams("page=0")),
    ApiError,
  );
});
test("실제 SQLite를 통과하는 API 계약·보안·확장 흐름", async (t) => {
  let token = "",
    other = "",
    id = 0;
  await t.test("health와 알 수 없는 API", async () => {
    assert.deepEqual(await (await request("/health")).json(), { status: "ok" });
    assert.equal((await request("/api/absent")).status, 404);
  });
  await t.test("가입 응답에서 해시 제외", async () => {
    const response = await request("/api/auth/signup", "POST", {
      email,
      password: "password123",
      nickname: "학습자",
    });
    assert.equal(response.status, 201);
    assert.equal(
      JSON.stringify(await response.json()).includes("passwordHash"),
      false,
    );
  });
  await t.test("동시 중복 가입은 한 건만 201", async () => {
    const input = {
      email: `race-${email}`,
      password: "password123",
      nickname: "중복",
    };
    const results = await Promise.all([
      request("/api/auth/signup", "POST", input),
      request("/api/auth/signup", "POST", input),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  });
  await t.test("로그인·쿠키 속성·실패 401", async () => {
    assert.equal(
      (
        await request("/api/auth/login", "POST", {
          email,
          password: "wrong-pass",
        })
      ).status,
      401,
    );
    const response = await request("/api/auth/login", "POST", {
      email,
      password: "password123",
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie")!, /HttpOnly; SameSite=Lax/);
    token = (await response.json()).data.accessToken;
  });
  await t.test("무인증·위조 토큰 차단", async () => {
    assert.equal((await request("/api/auth/me")).status, 401);
    assert.equal(
      (await request("/api/auth/me", "GET", undefined, `${token}bad`)).status,
      401,
    );
  });
  await t.test("유효성 오류 fields와 requestId 일치", async () => {
    const response = await request(
      "/api/posts",
      "POST",
      { title: "", body: "본문" },
      token,
      { "X-Request-Id": "test-request" },
    );
    const value = await response.json();
    assert.equal(response.status, 400);
    assert.ok(value.error.fields.title);
    assert.equal(value.error.requestId, response.headers.get("x-request-id"));
  });
  await t.test("깨진 JSON 400", async () => {
    const response = await handle(
      new Request("http://localhost:3000/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    assert.equal(response.status, 400);
  });
  await t.test("64KB 넘는 본문 413", async () => {
    assert.equal(
      (
        await request(
          "/api/posts",
          "POST",
          { title: "글", body: "a".repeat(65_000) },
          token,
        )
      ).status,
      413,
    );
  });
  await t.test("등록 201·Location·부분 수정 200", async () => {
    const response = await request(
      "/api/posts",
      "POST",
      { title: "처음", body: "본문", tags: ["next"] },
      token,
    );
    assert.equal(response.status, 201);
    id = (await response.json()).data.id;
    assert.equal(response.headers.get("location"), `/api/posts/${id}`);
    const updated = await request(
      `/api/posts/${id}`,
      "PATCH",
      { title: "수정한 제목" },
      token,
    );
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).data.body, "본문");
  });
  await t.test("목록 검색·v1 별칭·정렬·숫자 검증", async () => {
    const value = await (
      await request("/api/v1/posts?q=수정&limit=999")
    ).json();
    assert.equal(value.meta.limit, 50);
    assert.equal(value.data.length, 1);
    assert.equal((await request("/api/posts?page=1x")).status, 400);
    assert.equal((await request("/api/posts?sort=unknown")).status, 400);
    assert.equal((await request("/api/posts/no-number")).status, 400);
  });
  await t.test("두 번째 사용자의 수정·삭제 403", async () => {
    const second = {
      email: `other-${email}`,
      password: "password123",
      nickname: "다른 사람",
    };
    await request("/api/auth/signup", "POST", second);
    other = (await (await request("/api/auth/login", "POST", second)).json())
      .data.accessToken;
    assert.equal(
      (await request(`/api/posts/${id}`, "PATCH", { title: "공격" }, other))
        .status,
      403,
    );
    assert.equal(
      (await request(`/api/posts/${id}`, "DELETE", undefined, other)).status,
      403,
    );
  });
  await t.test("CSRF: 다른 Origin·Origin 없는 쿠키 쓰기 차단", async () => {
    assert.equal(
      (
        await request(`/api/posts/${id}`, "DELETE", undefined, token, {
          Origin: "https://evil.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(`/api/posts/${id}`, "DELETE", undefined, undefined, {
          Cookie: `course_session=${token}`,
        })
      ).status,
      403,
    );
  });
  await t.test("댓글 작성·목록·개수·소유권", async () => {
    const comment = (
      await (
        await request(
          `/api/posts/${id}/comments`,
          "POST",
          { body: "댓글" },
          token,
        )
      ).json()
    ).data;
    assert.equal(
      (await request(`/api/comments/${comment.id}`, "DELETE", undefined, other))
        .status,
      403,
    );
    assert.equal(
      (await (await request(`/api/posts/${id}`)).json()).data.commentCount,
      1,
    );
    assert.equal(
      (await request(`/api/comments/${comment.id}`, "DELETE", undefined, token))
        .status,
      204,
    );
  });
  await t.test("파일 확장자 제한·사용자 문서 격리", async () => {
    assert.equal(
      (
        await request(
          "/api/files",
          "POST",
          { name: "../bad.exe", text: "test" },
          token,
        )
      ).status,
      400,
    );
    const file = (
      await (
        await request(
          "/api/files",
          "POST",
          { name: "note.md", text: "근거가 있는 학습 내용" },
          token,
        )
      ).json()
    ).data;
    assert.equal(
      (await request("/api/ai/summary", "POST", { fileId: file.id }, other))
        .status,
      404,
    );
    const stream = await request(
      "/api/ai/summary",
      "POST",
      { fileId: file.id },
      token,
    );
    assert.match(await stream.text(), /테스트 응답/);
    assert.equal(stream.headers.get("x-ai-mode"), "mock");
  });
  await t.test("영속 작업 큐→워커→결과", async () => {
    const job = (
      await (
        await request("/api/jobs", "POST", { text: "여러   공백" }, token)
      ).json()
    ).data;
    assert.equal(job.status, "pending");
    await runOnce();
    const done = (
      await (
        await request(`/api/jobs/${job.id}`, "GET", undefined, token)
      ).json()
    ).data;
    assert.equal(done.status, "done");
    assert.equal(done.result, "여러 공백");
    assert.equal(
      (await request(`/api/jobs/${job.id}`, "GET", undefined, other)).status,
      404,
    );
  });
  await t.test("키 없는 외부 연동은 503", async () => {
    assert.equal(
      (
        await request("/api/mail", "POST", { text: "메일" }, token, {
          "Idempotency-Key": "mail-test",
        })
      ).status,
      503,
    );
    assert.equal(
      (
        await request("/api/payments/checkout", "POST", undefined, token, {
          "Idempotency-Key": "checkout-test",
        })
      ).status,
      503,
    );
  });
  await t.test("메일과 결제 HTTP mock: 인증·멱등키 전달", async () => {
    process.env.RESEND_API_KEY = "test";
    process.env.MAIL_FROM = "verified@example.com";
    process.env.STRIPE_SECRET_KEY = "sk_test_test";
    process.env.STRIPE_PRICE_ID = "price_test";
    const calls: { url: string; headers: Headers }[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), headers: new Headers(init?.headers) });
      return Response.json({
        id: "test_id",
        url: "https://checkout.stripe.com/test",
      });
    };
    try {
      assert.equal(
        (
          await request("/api/mail", "POST", { text: "메일" }, token, {
            "Idempotency-Key": "mail-one",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request("/api/payments/checkout", "POST", undefined, token, {
            "Idempotency-Key": "pay-one",
          })
        ).status,
        201,
      );
      assert.equal(calls[0].headers.get("idempotency-key"), "mail-one");
      assert.match(calls[1].headers.get("authorization")!, /sk_test_/);
    } finally {
      globalThis.fetch = original;
      delete process.env.RESEND_API_KEY;
      delete process.env.MAIL_FROM;
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_PRICE_ID;
    }
  });
  await t.test("웹훅 원문 HMAC·시간·중복 제거", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const payload = {
        id: "evt_test",
        type: "checkout.session.completed",
        data: { object: { payment_status: "paid" } },
      },
      raw = JSON.stringify(payload),
      now = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", "whsec_test")
      .update(`${now}.${raw}`)
      .digest("hex");
    assert.equal(
      (
        await request("/api/payments/webhook", "POST", payload, undefined, {
          "stripe-signature": `t=${now},v1=bad`,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/api/payments/webhook", "POST", payload, undefined, {
          "stripe-signature": `t=${now - 1000},v1=${signature}`,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/api/payments/webhook", "POST", payload, undefined, {
          "stripe-signature": `t=${now},v1=${signature}`,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await (
          await request("/api/payments/webhook", "POST", payload, undefined, {
            "stripe-signature": `t=${now},v1=${signature}`,
          })
        ).json()
      ).data.duplicate,
      true,
    );
  });
  await t.test("OAuth state·PKCE와 GitHub id 매핑(mock)", async () => {
    process.env.GITHUB_CLIENT_ID = "test-client";
    process.env.GITHUB_CLIENT_SECRET = "test-secret";
    const started = await request("/api/oauth/start");
    assert.equal(started.status, 302);
    const location = new URL(started.headers.get("location")!);
    assert.equal(location.searchParams.get("code_challenge_method"), "S256");
    const cookies = started.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    assert.equal(
      (
        await request(
          "/api/oauth/callback?code=test&state=wrong",
          "GET",
          undefined,
          undefined,
          { Cookie: cookies },
        )
      ).status,
      400,
    );
    const original = globalThis.fetch;
    globalThis.fetch = async (input) =>
      Response.json(
        String(input).includes("access_token")
          ? { access_token: "upstream-test-token" }
          : { id: 123456, login: "oauth-learner" },
      );
    try {
      const response = await request(
        `/api/oauth/callback?code=test&state=${location.searchParams.get("state")}`,
        "GET",
        undefined,
        undefined,
        { Cookie: cookies },
      );
      assert.equal(response.status, 302);
      assert.ok(
        response.headers
          .getSetCookie()
          .some((cookie) => cookie.startsWith("course_session=")),
      );
    } finally {
      globalThis.fetch = original;
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;
    }
  });
  await t.test("삭제 204·없는 자원 404", async () => {
    const response = await request(
      `/api/posts/${id}`,
      "DELETE",
      undefined,
      token,
    );
    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
    assert.equal((await request(`/api/posts/${id}`)).status, 404);
  });
  await t.test("로그아웃 후 Bearer도 재사용 불가", async () => {
    assert.equal(
      (await request("/api/auth/logout", "POST", undefined, token)).status,
      204,
    );
    assert.equal(
      (await request("/api/auth/me", "GET", undefined, token)).status,
      401,
    );
  });
  await t.test("OpenAPI와 표준 경로", async () => {
    const schema = await (await request("/api/openapi")).json();
    assert.equal(schema.openapi, "3.0.3");
    assert.ok(schema.paths["/api/posts/{id}/comments"]);
  });
});
test("MCP 실제 SDK 클라이언트·서버 연결", async () => {
  const server = createMcpServer(),
    client = new Client({ name: "test-client", version: "1.0.0" });
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const tools = await client.listTools();
    assert.equal(tools.tools[0].name, "explain_next");
    const result = await client.callTool({
      name: "explain_next",
      arguments: { topic: "rsc" },
    });
    assert.match(JSON.stringify(result), /직렬화/);
  } finally {
    await client.close();
    await server.close();
  }
});
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { test } from "node:test"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: assert from "node:assert/strict"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { mkdirSync } from "node:fs"; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: { createHmac } from "node:crypto"; |
| 5 | 외부 모듈 또는 공용 함수·타입을 가져온다: { |
| 6 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ApiError, |
| 7 | 현재 구문에서 다음 값·인자·표현식을 연결한다: emptyState, |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: identifier, |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: listPosts, |
| 10 | 현재 구문에서 다음 값·인자·표현식을 연결한다: text, |
| 11 | 현재 구문에서 다음 값·인자·표현식을 연결한다: } from "../src/course/domain"; |
| 12 | 외부 모듈 또는 공용 함수·타입을 가져온다: { route as handle } from "../src/course/entry"; |
| 13 | 외부 모듈 또는 공용 함수·타입을 가져온다: { runOnce } from "../src/course/worker"; |
| 14 | 외부 모듈 또는 공용 함수·타입을 가져온다: { createMcpServer } from "../src/course/mcp-server"; |
| 15 | 외부 모듈 또는 공용 함수·타입을 가져온다: { Client } from "@modelcontextprotocol/sdk/client/index.js"; |
| 16 | 외부 모듈 또는 공용 함수·타입을 가져온다: { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"; |
| 17 | 현재 구문에서 다음 값·인자·표현식을 연결한다: mkdirSync("data", { recursive: true }); |
| 18 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: process.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters"; |
| 19 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: process.env.COURSE_DB_PATH = ˋdata/test-${crypto.randomUUID()}.dbˋ; |
| 20 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: process.env.AI_MODE = "mock"; |
| 21 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: process.env.APP_ORIGIN = "http://localhost:3000"; |
| 22 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const email = ˋtest-${crypto.randomUUID()}@example.comˋ; |
| 23 | request의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 24 | 객체·스키마·속성의 값을 지정한다: path: string, |
| 25 | 현재 구문에서 다음 값·인자·표현식을 연결한다: method = "GET", |
| 26 | 현재 구문에서 다음 값·인자·표현식을 연결한다: body?: unknown, |
| 27 | 현재 구문에서 다음 값·인자·표현식을 연결한다: token?: string, |
| 28 | 객체·스키마·속성의 값을 지정한다: extra: Record<string, string> = {}, |
| 29 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ) { |
| 30 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const headers = { |
| 31 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ...(body === undefined ? {} : { "Content-Type": "application/json" }), |
| 32 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ...(token ? { Authorization: ˋBearer ${token}ˋ } : {}), |
| 33 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ...extra, |
| 34 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 35 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return handle( |
| 36 | 현재 구문에서 다음 값·인자·표현식을 연결한다: new Request(ˋhttp://localhost:3000${path}ˋ, { |
| 37 | 현재 구문에서 다음 값·인자·표현식을 연결한다: method, |
| 38 | 현재 구문에서 다음 값·인자·표현식을 연결한다: headers, |
| 39 | 객체·스키마·속성의 값을 지정한다: body: body === undefined ? undefined : JSON.stringify(body), |
| 40 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 41 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 42 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 43 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: test("도메인 검증과 페이지네이션", () => { |
| 44 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(text(" hello ", "title", 10), "hello"); |
| 45 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.throws(() => identifier("1e2"), ApiError); |
| 46 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.throws(() => identifier("0"), ApiError); |
| 47 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.throws(() => text("", "title", 10), ApiError); |
| 48 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 49 | 현재 구문에서 다음 값·인자·표현식을 연결한다: listPosts(emptyState(), new URLSearchParams("limit=99")).meta.limit, |
| 50 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 50, |
| 51 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 52 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.throws( |
| 53 | 현재 구문에서 다음 값·인자·표현식을 연결한다: () => listPosts(emptyState(), new URLSearchParams("page=0")), |
| 54 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ApiError, |
| 55 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 56 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 57 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: test("실제 SQLite를 통과하는 API 계약·보안·확장 흐름", async (t) => { |
| 58 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let token = "", |
| 59 | 현재 구문에서 다음 값·인자·표현식을 연결한다: other = "", |
| 60 | 현재 구문에서 다음 값·인자·표현식을 연결한다: id = 0; |
| 61 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("health와 알 수 없는 API", async () => { |
| 62 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.deepEqual(await (await request("/health")).json(), { status: "ok" }); |
| 63 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal((await request("/api/absent")).status, 404); |
| 64 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 65 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("가입 응답에서 해시 제외", async () => { |
| 66 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const response = await request("/api/auth/signup", "POST", { |
| 67 | 현재 구문에서 다음 값·인자·표현식을 연결한다: email, |
| 68 | 객체·스키마·속성의 값을 지정한다: password: "password123", |
| 69 | 객체·스키마·속성의 값을 지정한다: nickname: "학습자", |
| 70 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 71 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(response.status, 201); |
| 72 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 73 | 현재 구문에서 다음 값·인자·표현식을 연결한다: JSON.stringify(await response.json()).includes("passwordHash"), |
| 74 | 현재 구문에서 다음 값·인자·표현식을 연결한다: false, |
| 75 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 76 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 77 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("동시 중복 가입은 한 건만 201", async () => { |
| 78 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const input = { |
| 79 | 객체·스키마·속성의 값을 지정한다: email: ˋrace-${email}ˋ, |
| 80 | 객체·스키마·속성의 값을 지정한다: password: "password123", |
| 81 | 객체·스키마·속성의 값을 지정한다: nickname: "중복", |
| 82 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 83 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const results = await Promise.all([ |
| 84 | 현재 구문에서 다음 값·인자·표현식을 연결한다: request("/api/auth/signup", "POST", input), |
| 85 | 현재 구문에서 다음 값·인자·표현식을 연결한다: request("/api/auth/signup", "POST", input), |
| 86 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 87 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]); |
| 88 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 89 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("로그인·쿠키 속성·실패 401", async () => { |
| 90 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 91 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 92 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request("/api/auth/login", "POST", { |
| 93 | 현재 구문에서 다음 값·인자·표현식을 연결한다: email, |
| 94 | 객체·스키마·속성의 값을 지정한다: password: "wrong-pass", |
| 95 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 96 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).status, |
| 97 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 401, |
| 98 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 99 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const response = await request("/api/auth/login", "POST", { |
| 100 | 현재 구문에서 다음 값·인자·표현식을 연결한다: email, |
| 101 | 객체·스키마·속성의 값을 지정한다: password: "password123", |
| 102 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 103 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(response.status, 200); |
| 104 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.match(response.headers.get("set-cookie")!, /HttpOnly; SameSite=Lax/); |
| 105 | 현재 구문에서 다음 값·인자·표현식을 연결한다: token = (await response.json()).data.accessToken; |
| 106 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 107 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("무인증·위조 토큰 차단", async () => { |
| 108 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal((await request("/api/auth/me")).status, 401); |
| 109 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 110 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await request("/api/auth/me", "GET", undefined, ˋ${token}badˋ)).status, |
| 111 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 401, |
| 112 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 113 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 114 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("유효성 오류 fields와 requestId 일치", async () => { |
| 115 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const response = await request( |
| 116 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/posts", |
| 117 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "POST", |
| 118 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { title: "", body: "본문" }, |
| 119 | 현재 구문에서 다음 값·인자·표현식을 연결한다: token, |
| 120 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { "X-Request-Id": "test-request" }, |
| 121 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 122 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const value = await response.json(); |
| 123 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(response.status, 400); |
| 124 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.ok(value.error.fields.title); |
| 125 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(value.error.requestId, response.headers.get("x-request-id")); |
| 126 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 127 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("깨진 JSON 400", async () => { |
| 128 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const response = await handle( |
| 129 | 현재 구문에서 다음 값·인자·표현식을 연결한다: new Request("http://localhost:3000/api/posts", { |
| 130 | 객체·스키마·속성의 값을 지정한다: method: "POST", |
| 131 | 객체·스키마·속성의 값을 지정한다: headers: { "Content-Type": "application/json" }, |
| 132 | 객체·스키마·속성의 값을 지정한다: body: "{", |
| 133 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 134 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 135 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(response.status, 400); |
| 136 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 137 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("64KB 넘는 본문 413", async () => { |
| 138 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 139 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 140 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request( |
| 141 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/posts", |
| 142 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "POST", |
| 143 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { title: "글", body: "a".repeat(65_000) }, |
| 144 | 현재 구문에서 다음 값·인자·표현식을 연결한다: token, |
| 145 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 146 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).status, |
| 147 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 413, |
| 148 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 149 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 150 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("등록 201·Location·부분 수정 200", async () => { |
| 151 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const response = await request( |
| 152 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/posts", |
| 153 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "POST", |
| 154 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { title: "처음", body: "본문", tags: ["next"] }, |
| 155 | 현재 구문에서 다음 값·인자·표현식을 연결한다: token, |
| 156 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 157 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(response.status, 201); |
| 158 | 현재 구문에서 다음 값·인자·표현식을 연결한다: id = (await response.json()).data.id; |
| 159 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(response.headers.get("location"), ˋ/api/posts/${id}ˋ); |
| 160 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const updated = await request( |
| 161 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ˋ/api/posts/${id}ˋ, |
| 162 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "PATCH", |
| 163 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { title: "수정한 제목" }, |
| 164 | 현재 구문에서 다음 값·인자·표현식을 연결한다: token, |
| 165 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 166 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(updated.status, 200); |
| 167 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal((await updated.json()).data.body, "본문"); |
| 168 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 169 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("목록 검색·v1 별칭·정렬·숫자 검증", async () => { |
| 170 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const value = await ( |
| 171 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request("/api/v1/posts?q=수정&limit=999") |
| 172 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).json(); |
| 173 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(value.meta.limit, 50); |
| 174 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(value.data.length, 1); |
| 175 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal((await request("/api/posts?page=1x")).status, 400); |
| 176 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal((await request("/api/posts?sort=unknown")).status, 400); |
| 177 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal((await request("/api/posts/no-number")).status, 400); |
| 178 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 179 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("두 번째 사용자의 수정·삭제 403", async () => { |
| 180 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const second = { |
| 181 | 객체·스키마·속성의 값을 지정한다: email: ˋother-${email}ˋ, |
| 182 | 객체·스키마·속성의 값을 지정한다: password: "password123", |
| 183 | 객체·스키마·속성의 값을 지정한다: nickname: "다른 사람", |
| 184 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 185 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request("/api/auth/signup", "POST", second); |
| 186 | 현재 구문에서 다음 값·인자·표현식을 연결한다: other = (await (await request("/api/auth/login", "POST", second)).json()) |
| 187 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .data.accessToken; |
| 188 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 189 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await request(ˋ/api/posts/${id}ˋ, "PATCH", { title: "공격" }, other)) |
| 190 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .status, |
| 191 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 403, |
| 192 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 193 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 194 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await request(ˋ/api/posts/${id}ˋ, "DELETE", undefined, other)).status, |
| 195 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 403, |
| 196 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 197 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 198 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("CSRF: 다른 Origin·Origin 없는 쿠키 쓰기 차단", async () => { |
| 199 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 200 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 201 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request(ˋ/api/posts/${id}ˋ, "DELETE", undefined, token, { |
| 202 | 객체·스키마·속성의 값을 지정한다: Origin: "https://evil.example", |
| 203 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 204 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).status, |
| 205 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 403, |
| 206 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 207 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 208 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 209 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request(ˋ/api/posts/${id}ˋ, "DELETE", undefined, undefined, { |
| 210 | 객체·스키마·속성의 값을 지정한다: Cookie: ˋcourse_session=${token}ˋ, |
| 211 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 212 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).status, |
| 213 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 403, |
| 214 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 215 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 216 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("댓글 작성·목록·개수·소유권", async () => { |
| 217 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const comment = ( |
| 218 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await ( |
| 219 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request( |
| 220 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ˋ/api/posts/${id}/commentsˋ, |
| 221 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "POST", |
| 222 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { body: "댓글" }, |
| 223 | 현재 구문에서 다음 값·인자·표현식을 연결한다: token, |
| 224 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 225 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).json() |
| 226 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).data; |
| 227 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 228 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await request(ˋ/api/comments/${comment.id}ˋ, "DELETE", undefined, other)) |
| 229 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .status, |
| 230 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 403, |
| 231 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 232 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 233 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await (await request(ˋ/api/posts/${id}ˋ)).json()).data.commentCount, |
| 234 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 1, |
| 235 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 236 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 237 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await request(ˋ/api/comments/${comment.id}ˋ, "DELETE", undefined, token)) |
| 238 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .status, |
| 239 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 204, |
| 240 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 241 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 242 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("파일 확장자 제한·사용자 문서 격리", async () => { |
| 243 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 244 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 245 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request( |
| 246 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/files", |
| 247 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "POST", |
| 248 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { name: "../bad.exe", text: "test" }, |
| 249 | 현재 구문에서 다음 값·인자·표현식을 연결한다: token, |
| 250 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 251 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).status, |
| 252 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 400, |
| 253 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 254 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const file = ( |
| 255 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await ( |
| 256 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request( |
| 257 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/files", |
| 258 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "POST", |
| 259 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { name: "note.md", text: "근거가 있는 학습 내용" }, |
| 260 | 현재 구문에서 다음 값·인자·표현식을 연결한다: token, |
| 261 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 262 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).json() |
| 263 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).data; |
| 264 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 265 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await request("/api/ai/summary", "POST", { fileId: file.id }, other)) |
| 266 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .status, |
| 267 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 404, |
| 268 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 269 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const stream = await request( |
| 270 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/ai/summary", |
| 271 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "POST", |
| 272 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { fileId: file.id }, |
| 273 | 현재 구문에서 다음 값·인자·표현식을 연결한다: token, |
| 274 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 275 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.match(await stream.text(), /테스트 응답/); |
| 276 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(stream.headers.get("x-ai-mode"), "mock"); |
| 277 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 278 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("영속 작업 큐→워커→결과", async () => { |
| 279 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const job = ( |
| 280 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await ( |
| 281 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request("/api/jobs", "POST", { text: "여러   공백" }, token) |
| 282 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).json() |
| 283 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).data; |
| 284 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(job.status, "pending"); |
| 285 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await runOnce(); |
| 286 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const done = ( |
| 287 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await ( |
| 288 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request(ˋ/api/jobs/${job.id}ˋ, "GET", undefined, token) |
| 289 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).json() |
| 290 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).data; |
| 291 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(done.status, "done"); |
| 292 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(done.result, "여러 공백"); |
| 293 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 294 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await request(ˋ/api/jobs/${job.id}ˋ, "GET", undefined, other)).status, |
| 295 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 404, |
| 296 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 297 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 298 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("키 없는 외부 연동은 503", async () => { |
| 299 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 300 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 301 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request("/api/mail", "POST", { text: "메일" }, token, { |
| 302 | 객체·스키마·속성의 값을 지정한다: "Idempotency-Key": "mail-test", |
| 303 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 304 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).status, |
| 305 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 503, |
| 306 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 307 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 308 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 309 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request("/api/payments/checkout", "POST", undefined, token, { |
| 310 | 객체·스키마·속성의 값을 지정한다: "Idempotency-Key": "checkout-test", |
| 311 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 312 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).status, |
| 313 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 503, |
| 314 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 315 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 316 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("메일과 결제 HTTP mock: 인증·멱등키 전달", async () => { |
| 317 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: process.env.RESEND_API_KEY = "test"; |
| 318 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: process.env.MAIL_FROM = "verified@example.com"; |
| 319 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: process.env.STRIPE_SECRET_KEY = "sk_test_test"; |
| 320 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: process.env.STRIPE_PRICE_ID = "price_test"; |
| 321 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const calls: { url: string; headers: Headers }[] = []; |
| 322 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const original = globalThis.fetch; |
| 323 | 현재 구문에서 다음 값·인자·표현식을 연결한다: globalThis.fetch = async (input, init) => { |
| 324 | 현재 구문에서 다음 값·인자·표현식을 연결한다: calls.push({ url: String(input), headers: new Headers(init?.headers) }); |
| 325 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return Response.json({ |
| 326 | 객체·스키마·속성의 값을 지정한다: id: "test_id", |
| 327 | 객체·스키마·속성의 값을 지정한다: url: "https://checkout.stripe.com/test", |
| 328 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 329 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 330 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 331 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 332 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 333 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request("/api/mail", "POST", { text: "메일" }, token, { |
| 334 | 객체·스키마·속성의 값을 지정한다: "Idempotency-Key": "mail-one", |
| 335 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 336 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).status, |
| 337 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 200, |
| 338 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 339 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 340 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 341 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request("/api/payments/checkout", "POST", undefined, token, { |
| 342 | 객체·스키마·속성의 값을 지정한다: "Idempotency-Key": "pay-one", |
| 343 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 344 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).status, |
| 345 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 201, |
| 346 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 347 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(calls[0].headers.get("idempotency-key"), "mail-one"); |
| 348 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.match(calls[1].headers.get("authorization")!, /sk_test_/); |
| 349 | 성공·실패에 관계없이 잠금·연결·mock을 정리한다. |
| 350 | 현재 구문에서 다음 값·인자·표현식을 연결한다: globalThis.fetch = original; |
| 351 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: delete process.env.RESEND_API_KEY; |
| 352 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: delete process.env.MAIL_FROM; |
| 353 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: delete process.env.STRIPE_SECRET_KEY; |
| 354 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: delete process.env.STRIPE_PRICE_ID; |
| 355 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 356 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 357 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("웹훅 원문 HMAC·시간·중복 제거", async () => { |
| 358 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"; |
| 359 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const payload = { |
| 360 | 객체·스키마·속성의 값을 지정한다: id: "evt_test", |
| 361 | 객체·스키마·속성의 값을 지정한다: type: "checkout.session.completed", |
| 362 | 객체·스키마·속성의 값을 지정한다: data: { object: { payment_status: "paid" } }, |
| 363 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 364 | 현재 구문에서 다음 값·인자·표현식을 연결한다: raw = JSON.stringify(payload), |
| 365 | 현재 구문에서 다음 값·인자·표현식을 연결한다: now = Math.floor(Date.now() / 1000); |
| 366 | 웹훅 원문의 HMAC 서명을 계산하거나 일정 시간 비교로 검증한다. |
| 367 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .update(ˋ${now}.${raw}ˋ) |
| 368 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .digest("hex"); |
| 369 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 370 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 371 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request("/api/payments/webhook", "POST", payload, undefined, { |
| 372 | 객체·스키마·속성의 값을 지정한다: "stripe-signature": ˋt=${now},v1=badˋ, |
| 373 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 374 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).status, |
| 375 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 400, |
| 376 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 377 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 378 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 379 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request("/api/payments/webhook", "POST", payload, undefined, { |
| 380 | 객체·스키마·속성의 값을 지정한다: "stripe-signature": ˋt=${now - 1000},v1=${signature}ˋ, |
| 381 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 382 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).status, |
| 383 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 400, |
| 384 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 385 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 386 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 387 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request("/api/payments/webhook", "POST", payload, undefined, { |
| 388 | 객체·스키마·속성의 값을 지정한다: "stripe-signature": ˋt=${now},v1=${signature}ˋ, |
| 389 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 390 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).status, |
| 391 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 200, |
| 392 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 393 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 394 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 395 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await ( |
| 396 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request("/api/payments/webhook", "POST", payload, undefined, { |
| 397 | 객체·스키마·속성의 값을 지정한다: "stripe-signature": ˋt=${now},v1=${signature}ˋ, |
| 398 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 399 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).json() |
| 400 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).data.duplicate, |
| 401 | 현재 구문에서 다음 값·인자·표현식을 연결한다: true, |
| 402 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 403 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 404 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("OAuth state·PKCE와 GitHub id 매핑(mock)", async () => { |
| 405 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: process.env.GITHUB_CLIENT_ID = "test-client"; |
| 406 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: process.env.GITHUB_CLIENT_SECRET = "test-secret"; |
| 407 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const started = await request("/api/oauth/start"); |
| 408 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(started.status, 302); |
| 409 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const location = new URL(started.headers.get("location")!); |
| 410 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(location.searchParams.get("code_challenge_method"), "S256"); |
| 411 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const cookies = started.headers |
| 412 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .getSetCookie() |
| 413 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .map((value) => value.split(";")[0]) |
| 414 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .join("; "); |
| 415 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 416 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 417 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await request( |
| 418 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/oauth/callback?code=test&state=wrong", |
| 419 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "GET", |
| 420 | 현재 구문에서 다음 값·인자·표현식을 연결한다: undefined, |
| 421 | 현재 구문에서 다음 값·인자·표현식을 연결한다: undefined, |
| 422 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { Cookie: cookies }, |
| 423 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 424 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).status, |
| 425 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 400, |
| 426 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 427 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const original = globalThis.fetch; |
| 428 | 현재 구문에서 다음 값·인자·표현식을 연결한다: globalThis.fetch = async (input) => |
| 429 | 현재 구문에서 다음 값·인자·표현식을 연결한다: Response.json( |
| 430 | 현재 구문에서 다음 값·인자·표현식을 연결한다: String(input).includes("access_token") |
| 431 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ? { access_token: "upstream-test-token" } |
| 432 | 현재 구문에서 다음 값·인자·표현식을 연결한다: : { id: 123456, login: "oauth-learner" }, |
| 433 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 434 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 435 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const response = await request( |
| 436 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ˋ/api/oauth/callback?code=test&state=${location.searchParams.get("state")}ˋ, |
| 437 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "GET", |
| 438 | 현재 구문에서 다음 값·인자·표현식을 연결한다: undefined, |
| 439 | 현재 구문에서 다음 값·인자·표현식을 연결한다: undefined, |
| 440 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { Cookie: cookies }, |
| 441 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 442 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(response.status, 302); |
| 443 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.ok( |
| 444 | 현재 구문에서 다음 값·인자·표현식을 연결한다: response.headers |
| 445 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .getSetCookie() |
| 446 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .some((cookie) => cookie.startsWith("course_session=")), |
| 447 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 448 | 성공·실패에 관계없이 잠금·연결·mock을 정리한다. |
| 449 | 현재 구문에서 다음 값·인자·표현식을 연결한다: globalThis.fetch = original; |
| 450 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: delete process.env.GITHUB_CLIENT_ID; |
| 451 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: delete process.env.GITHUB_CLIENT_SECRET; |
| 452 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 453 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 454 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("삭제 204·없는 자원 404", async () => { |
| 455 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const response = await request( |
| 456 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ˋ/api/posts/${id}ˋ, |
| 457 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "DELETE", |
| 458 | 현재 구문에서 다음 값·인자·표현식을 연결한다: undefined, |
| 459 | 현재 구문에서 다음 값·인자·표현식을 연결한다: token, |
| 460 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 461 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(response.status, 204); |
| 462 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(await response.text(), ""); |
| 463 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal((await request(ˋ/api/posts/${id}ˋ)).status, 404); |
| 464 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 465 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("로그아웃 후 Bearer도 재사용 불가", async () => { |
| 466 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 467 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await request("/api/auth/logout", "POST", undefined, token)).status, |
| 468 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 204, |
| 469 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 470 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 471 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await request("/api/auth/me", "GET", undefined, token)).status, |
| 472 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 401, |
| 473 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 474 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 475 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: await t.test("OpenAPI와 표준 경로", async () => { |
| 476 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const schema = await (await request("/api/openapi")).json(); |
| 477 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(schema.openapi, "3.0.3"); |
| 478 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.ok(schema.paths["/api/posts/{id}/comments"]); |
| 479 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 480 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 481 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: test("MCP 실제 SDK 클라이언트·서버 연결", async () => { |
| 482 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const server = createMcpServer(), |
| 483 | 현재 구문에서 다음 값·인자·표현식을 연결한다: client = new Client({ name: "test-client", version: "1.0.0" }); |
| 484 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const [serverTransport, clientTransport] = |
| 485 | 현재 구문에서 다음 값·인자·표현식을 연결한다: InMemoryTransport.createLinkedPair(); |
| 486 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 487 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await server.connect(serverTransport); |
| 488 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await client.connect(clientTransport); |
| 489 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const tools = await client.listTools(); |
| 490 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(tools.tools[0].name, "explain_next"); |
| 491 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const result = await client.callTool({ |
| 492 | 객체·스키마·속성의 값을 지정한다: name: "explain_next", |
| 493 | 객체·스키마·속성의 값을 지정한다: arguments: { topic: "rsc" }, |
| 494 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 495 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.match(JSON.stringify(result), /직렬화/); |
| 496 | 성공·실패에 관계없이 잠금·연결·mock을 정리한다. |
| 497 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await client.close(); |
| 498 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await server.close(); |
| 499 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 500 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/project/scripts/http-smoke.mjs

[실행 파일](tsx_version/project/scripts/http-smoke.mjs)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/scripts/http-smoke.mjs sha256:6beebb284a2c2679c3400802587a4c2fb20d1da457a8ac63101ba754f2400258 -->
~~~ts
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
const port = Number(process.env.TEST_PORT ?? (3490 + (process.cwd().includes('jsx_version') ? 2 : 0) + (process.cwd().endsWith('project') ? 1 : 0))),
  base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--port",
    String(port),
    "--hostname",
    "127.0.0.1",
  ],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      JWT_SECRET: "http-test-secret-with-at-least-32-characters",
      APP_ORIGIN: base,
      COURSE_DB_PATH: `data/http-${crypto.randomUUID()}.db`,
      AI_MODE: "mock",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
let output = "";
server.stdout.on("data", (d) => {
  output += d;
});
server.stderr.on("data", (d) => {
  output += d;
});
async function api(route, method = "GET", body, token) {
  return fetch(`${base}${route}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await api("/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (server.exitCode !== null) throw new Error(output);
    await new Promise((r) => setTimeout(r, 300));
  }
  assert.ok(ready, output);
  const privatePage = await fetch(`${base}/private-lab`, { redirect: 'manual' });
  assert.equal(privatePage.status, 307);
  assert.ok(privatePage.headers.get('location').endsWith('/board'));
  for (const route of ["/lab", "/board", "/workbench", "/api-docs"]) {
    const response = await api(route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get("content-type"), /text\/html/);
  }
  const account = {
    email: `http-${crypto.randomUUID()}@example.com`,
    password: "password123",
    nickname: "HTTP 학습자",
  };
  assert.equal((await api("/api/auth/signup", "POST", account)).status, 201);
  const login = await api("/api/auth/login", "POST", account);
  assert.match(login.headers.get("set-cookie"), /HttpOnly/);
  const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const token = (await login.json()).data.accessToken;
  const created = await api(
    "/api/posts",
    "POST",
    { title: "HTTP 글", body: "실제 Next 라우팅 검증" },
    token,
  );
  assert.equal(created.status, 201);
  const id = (await created.json()).data.id;
  const ownPage = await fetch(`${base}/private-lab`, { headers: { Cookie: cookie } });
  assert.equal(ownPage.status, 200);
  assert.match(await ownPage.text(), /HTTP 글/);
  assert.equal(
    (await api(`/api/posts/${id}`, "PATCH", { title: "수정" }, token)).status,
    200,
  );
  assert.equal(
    (await api(`/api/posts/${id}/comments`, "POST", { body: "댓글" }, token))
      .status,
    201,
  );
  if (existsSync("src")) {
    const workbench = await fetch(`${base}/workbench`, { headers: { Cookie: cookie } });
    assert.equal(workbench.status, 200);
    assert.match(await workbench.text(), /문서·AI 작업실/);
    const summary = await api(
      "/api/ai/summary",
      "POST",
      { text: "문서 내용" },
      token,
    );
    assert.match(await summary.text(), /테스트 응답/);
    const notification = await api("/api/events", "GET", undefined, token);
    assert.match(
      notification.headers.get("content-type"),
      /text\/event-stream/,
    );
    const reader = notification.body.getReader();
    assert.ok((await reader.read()).value.length);
    await reader.cancel();
  }
  assert.equal(
    (await api(`/api/posts/${id}`, "DELETE", undefined, token)).status,
    204,
  );
  assert.equal(
    (await api("/api/auth/logout", "POST", undefined, token)).status,
    204,
  );
  assert.equal((await fetch(`${base}/private-lab`, { headers: { Cookie: cookie }, redirect: 'manual' })).status, 307);
  console.log(
    `HTTP smoke PASS: HTML · 가입/로그인/CRUD/댓글 · 서버 DB 직접 조회 · proxy와 세션 검증 · 로그아웃${existsSync('src') ? ' · AI mock/SSE' : ' (기초 API)'}`,
  );
} finally {
  server.kill();
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: assert from "node:assert/strict"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { spawn } from "node:child_process"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { existsSync } from "node:fs"; |
| 4 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const port = Number(process.env.TEST_PORT ?? (3490 + (process.cwd().includes('jsx_version') ? 2 : 0) + (process.cwd().endsWith('project') ? 1 : 0))), |
| 5 | 현재 구문에서 다음 값·인자·표현식을 연결한다: base = ˋhttp://127.0.0.1:${port}ˋ; |
| 6 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const server = spawn( |
| 7 | 현재 구문에서 다음 값·인자·표현식을 연결한다: process.execPath, |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: [ |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "node_modules/next/dist/bin/next", |
| 10 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "start", |
| 11 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "--port", |
| 12 | 현재 구문에서 다음 값·인자·표현식을 연결한다: String(port), |
| 13 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "--hostname", |
| 14 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "127.0.0.1", |
| 15 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 16 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 17 | 객체·스키마·속성의 값을 지정한다: cwd: process.cwd(), |
| 18 | 객체·스키마·속성의 값을 지정한다: env: { |
| 19 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: ...process.env, |
| 20 | 객체·스키마·속성의 값을 지정한다: JWT_SECRET: "http-test-secret-with-at-least-32-characters", |
| 21 | 객체·스키마·속성의 값을 지정한다: APP_ORIGIN: base, |
| 22 | 객체·스키마·속성의 값을 지정한다: COURSE_DB_PATH: ˋdata/http-${crypto.randomUUID()}.dbˋ, |
| 23 | 객체·스키마·속성의 값을 지정한다: AI_MODE: "mock", |
| 24 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 25 | 객체·스키마·속성의 값을 지정한다: stdio: ["ignore", "pipe", "pipe"], |
| 26 | 객체·스키마·속성의 값을 지정한다: windowsHide: true, |
| 27 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 28 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 29 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let output = ""; |
| 30 | 현재 구문에서 다음 값·인자·표현식을 연결한다: server.stdout.on("data", (d) => { |
| 31 | 현재 구문에서 다음 값·인자·표현식을 연결한다: output += d; |
| 32 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 33 | 현재 구문에서 다음 값·인자·표현식을 연결한다: server.stderr.on("data", (d) => { |
| 34 | 현재 구문에서 다음 값·인자·표현식을 연결한다: output += d; |
| 35 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 36 | api의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 37 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: return fetch(ˋ${base}${route}ˋ, { |
| 38 | 현재 구문에서 다음 값·인자·표현식을 연결한다: method, |
| 39 | 객체·스키마·속성의 값을 지정한다: headers: { |
| 40 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ...(body ? { "Content-Type": "application/json" } : {}), |
| 41 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ...(token ? { Authorization: ˋBearer ${token}ˋ } : {}), |
| 42 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 43 | 객체·스키마·속성의 값을 지정한다: body: body ? JSON.stringify(body) : undefined, |
| 44 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 45 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 46 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 47 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let ready = false; |
| 48 | 배열·반복 요청·스트림을 순서대로 처리하며 종료 조건을 확인한다. |
| 49 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 50 | 입력·상태 조건에 따라 처리 경로를 고른다: if ((await api("/health")).ok) { |
| 51 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ready = true; |
| 52 | 현재 구문에서 다음 값·인자·표현식을 연결한다: break; |
| 53 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 54 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 55 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: if (server.exitCode !== null) throw new Error(output); |
| 56 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: await new Promise((r) => setTimeout(r, 300)); |
| 57 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 58 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.ok(ready, output); |
| 59 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: const privatePage = await fetch(ˋ${base}/private-labˋ, { redirect: 'manual' }); |
| 60 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(privatePage.status, 307); |
| 61 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.ok(privatePage.headers.get('location').endsWith('/board')); |
| 62 | 배열·반복 요청·스트림을 순서대로 처리하며 종료 조건을 확인한다. |
| 63 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const response = await api(route); |
| 64 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(response.status, 200, route); |
| 65 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.match(response.headers.get("content-type"), /text\/html/); |
| 66 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 67 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const account = { |
| 68 | 객체·스키마·속성의 값을 지정한다: email: ˋhttp-${crypto.randomUUID()}@example.comˋ, |
| 69 | 객체·스키마·속성의 값을 지정한다: password: "password123", |
| 70 | 객체·스키마·속성의 값을 지정한다: nickname: "HTTP 학습자", |
| 71 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 72 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal((await api("/api/auth/signup", "POST", account)).status, 201); |
| 73 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const login = await api("/api/auth/login", "POST", account); |
| 74 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.match(login.headers.get("set-cookie"), /HttpOnly/); |
| 75 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; '); |
| 76 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const token = (await login.json()).data.accessToken; |
| 77 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const created = await api( |
| 78 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/posts", |
| 79 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "POST", |
| 80 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { title: "HTTP 글", body: "실제 Next 라우팅 검증" }, |
| 81 | 현재 구문에서 다음 값·인자·표현식을 연결한다: token, |
| 82 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 83 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(created.status, 201); |
| 84 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const id = (await created.json()).data.id; |
| 85 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: const ownPage = await fetch(ˋ${base}/private-labˋ, { headers: { Cookie: cookie } }); |
| 86 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(ownPage.status, 200); |
| 87 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.match(await ownPage.text(), /HTTP 글/); |
| 88 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 89 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await api(ˋ/api/posts/${id}ˋ, "PATCH", { title: "수정" }, token)).status, |
| 90 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 200, |
| 91 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 92 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 93 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await api(ˋ/api/posts/${id}/commentsˋ, "POST", { body: "댓글" }, token)) |
| 94 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .status, |
| 95 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 201, |
| 96 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 97 | 입력·상태 조건에 따라 처리 경로를 고른다: if (existsSync("src")) { |
| 98 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: const workbench = await fetch(ˋ${base}/workbenchˋ, { headers: { Cookie: cookie } }); |
| 99 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal(workbench.status, 200); |
| 100 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.match(await workbench.text(), /문서·AI 작업실/); |
| 101 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const summary = await api( |
| 102 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/ai/summary", |
| 103 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "POST", |
| 104 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { text: "문서 내용" }, |
| 105 | 현재 구문에서 다음 값·인자·표현식을 연결한다: token, |
| 106 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 107 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.match(await summary.text(), /테스트 응답/); |
| 108 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const notification = await api("/api/events", "GET", undefined, token); |
| 109 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.match( |
| 110 | 현재 구문에서 다음 값·인자·표현식을 연결한다: notification.headers.get("content-type"), |
| 111 | 현재 구문에서 다음 값·인자·표현식을 연결한다: /text\/event-stream/, |
| 112 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 113 | 응답 스트림을 순서대로 읽거나 읽기 잠금을 정리한다. |
| 114 | 응답 스트림을 순서대로 읽거나 읽기 잠금을 정리한다. |
| 115 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await reader.cancel(); |
| 116 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 117 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 118 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await api(ˋ/api/posts/${id}ˋ, "DELETE", undefined, token)).status, |
| 119 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 204, |
| 120 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 121 | 관찰한 응답·값이 요구 조건과 같은지 검증한다: assert.equal( |
| 122 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (await api("/api/auth/logout", "POST", undefined, token)).status, |
| 123 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 204, |
| 124 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 125 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: assert.equal((await fetch(ˋ${base}/private-labˋ, { headers: { Cookie: cookie }, redirect: 'manual' })).status, 307); |
| 126 | 현재 구문에서 다음 값·인자·표현식을 연결한다: console.log( |
| 127 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ˋHTTP smoke PASS: HTML · 가입/로그인/CRUD/댓글 · 서버 DB 직접 조회 · proxy와 세션 검증 · 로그아웃${existsSync('src') ? ' · AI mock/SSE' : ' (기초 API)'}ˋ, |
| 128 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 129 | 성공·실패에 관계없이 잠금·연결·mock을 정리한다. |
| 130 | 현재 구문에서 다음 값·인자·표현식을 연결한다: server.kill(); |
| 131 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

## ④ 🔗 연동 포인트

requestId로 UI 오류·HTTP 응답·서버 로그를 이어 본다. 외부 API mock은 유료 호출 없는 회귀 검증이고 실제 키 검증은 study13·18의 체크리스트로 남긴다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| 테스트가 사용자 DB 변경 | 고정 데이터 파일 사용 | 매 실행 별도 test UUID 파일 사용 |
| mock이 다른 테스트에 남음 | 복구 누락 | finally에서 global fetch 복구 |
| handler는 통과, URL은 404 | Next 경로 연결 오류 | test:http로 실제 라우팅 확인 |

## ⑥ 직접 해보기

1. 작성자가 아닌 사용자의 댓글 삭제 403 테스트를 추가한다.
2. 외부 API가 502를 반환하는 mock을 만들어 오류 응답을 확인한다.
3. 개발자도구의 요청 하나를 requestId로 로그에서 찾는다.

## ⑦ ☐ 체크리스트

- [ ] 단위 테스트·요청 테스트·실서버 테스트를 구분한다.
- [ ] DB·API를 테스트용 데이터와 mock으로 분리했다.
- [ ] 오류 TOP 10의 증상·원인·해결을 확인했다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study10](study10.md)에서 프로덕션 빌드를 실행하고 HTTPS·환경변수·영속 DB 배포 조건을 점검한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
