const error = {
    description: "공통 오류",
    content: {
        "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    },
};
const reference = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ "application/json": { schema } });
const data = (schema) => ({
    type: "object",
    required: ["data"],
    properties: { data: schema },
});
const operation = (summary, schema, status = "200", input, auth = false) => ({
    summary,
    ...(auth ? { security: [{ bearer: [] }, { cookie: [] }] } : {}),
    ...(input ? { requestBody: { required: true, content: json(input) } } : {}),
    responses: {
        [status]: status === "204"
            ? { description: "본문 없음" }
            : { description: "성공", content: json(schema) },
        ...Object.fromEntries(["400", "401", "403", "404", "409", "413", "429", "500"].map((code) => [
            code,
            error,
        ])),
    },
});
const id = {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "integer", minimum: 1 },
};
const string = { type: "string" }, integer = { type: "integer" };
export const openapi = {
    openapi: "3.0.3",
    info: { title: "Next.js 게시판 공통 API 스펙 v1", version: "1.0.0" },
    servers: [{ url: "/" }],
    paths: {
        "/health": {
            get: operation("DB 연결 확인", {
                type: "object",
                properties: { status: { type: "string", enum: ["ok"] } },
            }),
        },
        "/api/auth/signup": {
            post: operation("회원가입", data(reference("User")), "201", reference("Signup")),
        },
        "/api/auth/login": {
            post: operation("로그인·HttpOnly 쿠키 발급", data({
                type: "object",
                properties: { user: reference("User"), accessToken: string },
            }), "200", reference("Login")),
        },
        "/api/auth/logout": {
            post: operation("토큰 폐기·쿠키 삭제", {}, "204", undefined, true),
        },
        "/api/auth/me": {
            get: operation("내 정보", data(reference("User")), "200", undefined, true),
        },
        "/api/posts": {
            get: {
                ...operation("게시글 목록", {
                    ...data({ type: "array", items: reference("Post") }),
                    properties: {
                        data: { type: "array", items: reference("Post") },
                        meta: reference("Meta"),
                    },
                }),
                parameters: [
                    { name: "q", in: "query", schema: string },
                    {
                        name: "page",
                        in: "query",
                        schema: { type: "integer", minimum: 1, default: 1 },
                    },
                    {
                        name: "limit",
                        in: "query",
                        description: "50 초과는 50으로 제한",
                        schema: { type: "integer", minimum: 1, default: 10 },
                    },
                    {
                        name: "sort",
                        in: "query",
                        schema: {
                            type: "string",
                            enum: ["createdAt", "-createdAt", "-commentCount"],
                            default: "-createdAt",
                        },
                    },
                ],
            },
            post: operation("게시글 등록·Location 헤더", data(reference("Post")), "201", reference("PostInput"), true),
        },
        "/api/posts/{id}": {
            parameters: [id],
            get: operation("게시글 상세", data(reference("Post"))),
            patch: operation("작성자 부분 수정", data(reference("Post")), "200", { ...reference("PostPatch") }, true),
            delete: operation("작성자 삭제", {}, "204", undefined, true),
        },
        "/api/posts/{id}/comments": {
            parameters: [id],
            get: operation("댓글 목록", data({ type: "array", items: reference("Comment") })),
            post: operation("댓글 등록", data(reference("Comment")), "201", {
                type: "object",
                required: ["body"],
                properties: {
                    body: { type: "string", minLength: 1, maxLength: 2000 },
                },
            }, true),
        },
        "/api/comments/{id}": {
            parameters: [id],
            delete: operation("내 댓글 삭제", {}, "204", undefined, true),
        },
        "/api/files": {
            get: operation("내 문서 목록", data({
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: integer,
                        ownerId: integer,
                        name: string,
                        text: string,
                    },
                },
            }), "200", undefined, true),
            post: operation("UTF-8 txt/md 업로드", data({ type: "object" }), "201", {
                type: "object",
                required: ["name", "text"],
                properties: {
                    name: string,
                    text: { type: "string", maxLength: 20000 },
                },
            }, true),
        },
        "/api/jobs": {
            post: operation("텍스트 처리 예약", data(reference("Job")), "202", { type: "object", required: ["text"], properties: { text: string } }, true),
        },
        "/api/jobs/{id}": {
            parameters: [id],
            get: operation("내 작업 조회", data(reference("Job")), "200", undefined, true),
        },
        "/api/ai/summary": {
            post: {
                summary: "문서 요약·질문: text/plain UTF-8 스트림",
                security: [{ cookie: [] }, { bearer: [] }],
                requestBody: {
                    content: json({
                        type: "object",
                        properties: { text: string, fileId: integer, question: string },
                    }),
                },
                responses: {
                    "200": {
                        description: "텍스트 스트림",
                        content: { "text/plain": { schema: string } },
                    },
                    "400": error,
                    "401": error,
                    "503": error,
                },
            },
        },
        "/api/events": {
            get: {
                summary: "내 작업 알림 SSE",
                security: [{ cookie: [] }],
                responses: {
                    "200": {
                        description: "최대 30초 후 재연결",
                        content: { "text/event-stream": { schema: string } },
                    },
                    "401": error,
                },
            },
        },
        "/api/mail": {
            post: {
                ...operation("내 이메일로 보내기", data({ type: "object" }), "200", { type: "object", properties: { text: string }, required: ["text"] }, true),
                parameters: [
                    {
                        name: "Idempotency-Key",
                        in: "header",
                        required: true,
                        schema: string,
                    },
                ],
            },
        },
        "/api/payments/checkout": {
            post: {
                ...operation("Stripe 테스트 결제 세션", data({ type: "object", properties: { id: string, url: string } }), "201", undefined, true),
                parameters: [
                    {
                        name: "Idempotency-Key",
                        in: "header",
                        required: true,
                        schema: string,
                    },
                ],
            },
        },
        "/api/payments/webhook": {
            post: {
                summary: "Stripe 원문 서명 검증·이벤트 중복 제거",
                parameters: [
                    {
                        name: "stripe-signature",
                        in: "header",
                        required: true,
                        schema: string,
                    },
                ],
                requestBody: { content: json({ type: "object" }) },
                responses: { "200": { description: "수신 완료" }, "400": error },
            },
        },
    },
    components: {
        securitySchemes: {
            bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
            cookie: { type: "apiKey", in: "cookie", name: "course_session" },
        },
        schemas: {
            Error: {
                type: "object",
                required: ["error"],
                properties: {
                    error: {
                        type: "object",
                        required: ["code", "message", "fields", "requestId"],
                        properties: {
                            code: string,
                            message: string,
                            requestId: string,
                            fields: {
                                type: "object",
                                additionalProperties: { type: "array", items: string },
                            },
                        },
                    },
                },
            },
            User: {
                type: "object",
                required: ["id", "email", "nickname"],
                properties: { id: integer, email: string, nickname: string },
            },
            Login: {
                type: "object",
                required: ["email", "password"],
                properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 8, maxLength: 72 },
                },
            },
            Signup: {
                type: "object",
                required: ["email", "password", "nickname"],
                properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 8, maxLength: 72 },
                    nickname: { type: "string", minLength: 1, maxLength: 40 },
                },
            },
            PostInput: {
                type: "object",
                required: ["title", "body"],
                properties: {
                    title: { type: "string", minLength: 1, maxLength: 200 },
                    body: { type: "string", minLength: 1, maxLength: 20000 },
                    tags: {
                        type: "array",
                        maxItems: 10,
                        items: { type: "string", maxLength: 30 },
                    },
                },
            },
            PostPatch: {
                type: "object",
                minProperties: 1,
                properties: {
                    title: { type: "string", minLength: 1, maxLength: 200 },
                    body: { type: "string", minLength: 1, maxLength: 20000 },
                    tags: {
                        type: "array",
                        maxItems: 10,
                        items: { type: "string", maxLength: 30 },
                    },
                },
            },
            Post: {
                type: "object",
                properties: {
                    id: integer,
                    title: string,
                    body: string,
                    tags: { type: "array", items: string },
                    author: {
                        type: "object",
                        properties: { id: integer, nickname: string },
                    },
                    commentCount: integer,
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                },
            },
            Comment: {
                type: "object",
                properties: {
                    id: integer,
                    postId: integer,
                    authorId: integer,
                    body: string,
                    author: reference("User"),
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            Meta: {
                type: "object",
                properties: {
                    page: integer,
                    limit: integer,
                    total: integer,
                    totalPages: integer,
                    q: string,
                },
            },
            Job: {
                type: "object",
                properties: {
                    id: integer,
                    ownerId: integer,
                    status: { type: "string", enum: ["pending", "done", "failed"] },
                    attempts: integer,
                    text: string,
                    result: string,
                },
            },
        },
    },
};
