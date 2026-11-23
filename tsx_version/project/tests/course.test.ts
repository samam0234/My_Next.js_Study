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
