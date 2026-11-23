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
