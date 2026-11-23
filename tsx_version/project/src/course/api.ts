import {
  ApiError,
  identifier,
  listPosts,
  postView,
  publicUser,
  text,
} from "./domain";
import { getRepository } from "./repository";
import {
  authenticate,
  checkPassword,
  hashPassword,
  issueToken,
  protectOrigin,
  rateLimit,
  sessionCookie,
} from "./security";
import { failure, jsonBody, reply } from "./http";

export async function handle(
  request: Request,
  extension?: (request: Request) => Promise<Response | null>,
): Promise<Response> {
  const requestId =
    request.headers.get("x-request-id")?.slice(0, 100) || crypto.randomUUID();
  const started = performance.now();
  let response: Response;
  try {
    response = (await extension?.(request)) ?? (await dispatch(request));
  } catch (error) {
    response = failure(error, requestId);
  }
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  const origin = request.headers.get("origin");
  if (origin && origin === process.env.CORS_ORIGIN) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Request-Id",
    );
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
  }
  console.info(
    JSON.stringify({
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      status: response.status,
      ms: Math.round(performance.now() - started),
    }),
  );
  return response;
}
async function dispatch(request: Request): Promise<Response> {
  const url = new URL(request.url),
    method = request.method;
  const pathname = url.pathname.replace(/^\/api\/v1\//, "/api/"); // v1 별칭도 동일 계약을 쓴다.
  if (method === "OPTIONS") return new Response(null, { status: 204 });
  if (pathname === "/health" && method === "GET") {
    await (await getRepository()).read();
    return reply({ status: "ok" });
  }
  if (pathname === "/api/openapi" && method === "GET") {
    const { openapi } = await import("./openapi");
    return reply(openapi);
  }
  protectOrigin(request);
  const repo = await getRepository();
  if (
    /^\/api\/auth\/(signup|register|login)$/.test(pathname) &&
    method === "POST"
  ) {
    const body = await jsonBody(request);
    const email = text(body.email, "email", 254).toLowerCase(),
      password = text(body.password, "password", 72);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new ApiError(400, "VALIDATION_ERROR", "이메일 형식을 확인하세요.", {
        email: ["올바른 이메일이 필요합니다."],
      });
    rateLimit(`auth:${email}`, 15);
    if (pathname.endsWith("/login")) {
      const user = (await repo.read()).users.find((u) => u.email === email);
      if (!user || !(await checkPassword(password, user.passwordHash)))
        throw new ApiError(
          401,
          "INVALID_CREDENTIALS",
          "이메일 또는 비밀번호를 확인하세요.",
        );
      const token = issueToken(user.id);
      return reply(
        { data: { user: publicUser(user), accessToken: token } },
        200,
        { "Set-Cookie": sessionCookie(token) },
      );
    }
    if (password.length < 8 || Buffer.byteLength(password) > 72)
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "비밀번호는 8자 이상, UTF-8 72바이트 이하입니다.",
        { password: ["길이를 확인하세요."] },
      );
    const nickname = text(body.nickname ?? body.name, "nickname", 40),
      passwordHash = await hashPassword(password);
    const user = await repo.change((state) => {
      if (state.users.some((u) => u.email === email))
        throw new ApiError(409, "EMAIL_TAKEN", "이미 가입한 이메일입니다.");
      const user = { id: ++state.seq, email, nickname, passwordHash };
      state.users.push(user);
      return user;
    });
    return reply({ data: publicUser(user) }, 201);
  }
  if (pathname === "/api/auth/me" && method === "GET")
    return reply({
      data: publicUser(authenticate(request, await repo.read()).user),
    });
  if (pathname === "/api/auth/logout" && method === "POST") {
    await repo.change((state) => {
      const { jti } = authenticate(request, state);
      state.revoked.push(jti);
    });
    return new Response(null, {
      status: 204,
      headers: { "Set-Cookie": sessionCookie("", 0) },
    });
  }
  if (pathname === "/api/posts" && method === "GET")
    return reply(listPosts(await repo.read(), url.searchParams));
  if (pathname === "/api/posts" && method === "POST") {
    const body = await jsonBody(request),
      title = text(body.title, "title", 200),
      content = text(body.body, "body", 20_000),
      tags = validateTags(body.tags ?? []);
    const result = await repo.change((state) => {
      const { user } = authenticate(request, state),
        now = new Date().toISOString();
      const post = {
        id: ++state.seq,
        title,
        body: content,
        tags,
        authorId: user.id,
        createdAt: now,
        updatedAt: now,
      };
      state.posts.push(post);
      return postView(state, post);
    });
    return reply({ data: result }, 201, {
      Location: `/api/posts/${result.id}`,
    });
  }
  const postMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (postMatch) {
    const id = identifier(postMatch[1]);
    if (method === "GET") {
      const state = await repo.read(),
        post = state.posts.find((p) => p.id === id);
      if (!post) throw new ApiError(404, "NOT_FOUND", "게시글이 없습니다.");
      return reply({ data: postView(state, post) });
    }
    if (method === "PATCH" || method === "DELETE") {
      const body = method === "PATCH" ? await jsonBody(request) : {};
      const data = await repo.change((state) => {
        const { user } = authenticate(request, state),
          post = state.posts.find((p) => p.id === id);
        if (!post) throw new ApiError(404, "NOT_FOUND", "게시글이 없습니다.");
        if (post.authorId !== user.id)
          throw new ApiError(403, "FORBIDDEN", "작성자만 변경할 수 있습니다.");
        if (method === "DELETE") {
          state.posts = state.posts.filter((p) => p.id !== id);
          state.comments = state.comments.filter((c) => c.postId !== id);
          return null;
        }
        if (!["title", "body", "tags"].some((k) => k in body))
          throw new ApiError(
            400,
            "VALIDATION_ERROR",
            "수정할 필드가 필요합니다.",
          );
        if ("title" in body) post.title = text(body.title, "title", 200);
        if ("body" in body) post.body = text(body.body, "body", 20_000);
        if ("tags" in body) post.tags = validateTags(body.tags);
        post.updatedAt = new Date().toISOString();
        return postView(state, post);
      });
      return method === "DELETE"
        ? new Response(null, { status: 204 })
        : reply({ data });
    }
    throw new ApiError(
      405,
      "METHOD_NOT_ALLOWED",
      "지원하지 않는 메서드입니다.",
    );
  }
  const commentsMatch = pathname.match(/^\/api\/posts\/([^/]+)\/comments$/);
  if (commentsMatch) {
    const postId = identifier(commentsMatch[1]);
    if (method === "GET") {
      const state = await repo.read();
      if (!state.posts.some((p) => p.id === postId))
        throw new ApiError(404, "NOT_FOUND", "게시글이 없습니다.");
      return reply({
        data: state.comments
          .filter((c) => c.postId === postId)
          .map((c) => ({
            ...c,
            author: publicUser(state.users.find((u) => u.id === c.authorId)!),
          })),
      });
    }
    if (method === "POST") {
      const body = text((await jsonBody(request)).body, "body", 2000);
      const data = await repo.change((state) => {
        const { user } = authenticate(request, state);
        if (!state.posts.some((p) => p.id === postId))
          throw new ApiError(404, "NOT_FOUND", "게시글이 없습니다.");
        const comment = {
          id: ++state.seq,
          postId,
          authorId: user.id,
          body,
          createdAt: new Date().toISOString(),
        };
        state.comments.push(comment);
        return { ...comment, author: publicUser(user) };
      });
      return reply({ data }, 201);
    }
  }
  const commentMatch = pathname.match(/^\/api\/comments\/([^/]+)$/);
  if (commentMatch && method === "DELETE") {
    const id = identifier(commentMatch[1]);
    await repo.change((state) => {
      const { user } = authenticate(request, state),
        comment = state.comments.find((c) => c.id === id);
      if (!comment) throw new ApiError(404, "NOT_FOUND", "댓글이 없습니다.");
      if (comment.authorId !== user.id)
        throw new ApiError(403, "FORBIDDEN", "작성자만 삭제할 수 있습니다.");
      state.comments = state.comments.filter((c) => c.id !== id);
    });
    return new Response(null, { status: 204 });
  }
  if (pathname === "/api/hello" && method === "GET")
    return reply({ data: { message: "Hello, Next.js!" } });
  throw new ApiError(404, "NOT_FOUND", "없는 API 경로입니다.");
}
function validateTags(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 10 ||
    value.some((t) => typeof t !== "string" || !t.trim() || t.length > 30)
  )
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "태그는 30자 이하 문자열 10개까지입니다.",
      { tags: ["태그 형식을 확인하세요."] },
    );
  return [...new Set(value.map((t) => t.trim()))];
}
