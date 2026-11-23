# study14 — REST·OpenAPI·버전·오류 규칙

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

v1 계약을 문서화하고 경로·페이지네이션·오류 응답을 일관되게 유지한다.

## ② 📖 이론

REST 경로는 복수 명사 자원을 중심으로 정한다. GET은 조회, POST는 생성, PATCH는 부분 수정, DELETE는 제거다. 생성은 201과 Location, 삭제는 204와 빈 본문을 반환한다.

공통 v1의 정식 경로는 /api다. /api/v1은 동일 handler로 정규화하는 별칭이다. 기존 클라이언트가 깨지는 변경은 새로운 버전 계약으로 분리하고 폐기 일정을 알린다. page는 1부터, limit는 기본 10·최대 50이며 sort 허용 목록을 검증한다.

OpenAPI는 요청과 응답의 설계도다. /api-docs는 스키마를 읽는 화면이고 /api/openapi는 Swagger Editor에 가져올 OpenAPI 3 JSON이다. 인증, 경로 파라미터, 오류 envelope를 같은 문서에 기록한다.

오류의 code는 프로그램이 처리할 이름, message는 사람이 볼 설명, fields는 입력별 문제, requestId는 로그 추적 열쇠다. 내부 스택과 DB URL은 응답에 보내지 않는다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. /api-docs에서 JSON을 다운로드하고 Swagger Editor의 Import File로 연다.
2. 모든 게시글·댓글·인증 경로와 상태 코드를 노션 v1에 대조한다.
3. /api/posts와 /api/v1/posts의 결과 형식을 확인한다.
4. 잘못된 page·sort·id를 보내 400, 다른 작성자로 403, 없는 자원으로 404를 확인한다.

~~~powershell
cd tsx_version/project
npm run dev
# 별도 터미널
Invoke-RestMethod http://localhost:3000/api/openapi | ConvertTo-Json -Depth 50 | Set-Content openapi.local.json
# openapi.local.json은 학습용 다운로드이며 저장소에 올릴 필요가 없다.
curl.exe -i "http://localhost:3000/api/posts?page=0"
~~~



### tsx_version/project/src/course/openapi.ts

[실행 파일](tsx_version/project/src/course/openapi.ts)

OpenAPI 3의 paths·schemas·securitySchemes를 구성한다. 이 객체를 Route Handler에서 JSON으로 반환하고 /api-docs에서 읽는다.

<!-- source:tsx_version/project/src/course/openapi.ts sha256:599b2334ee9df469e4db440ace6bf6d572af938a604d6bc95420113ac8fb223f -->
~~~ts
const error = {
  description: "공통 오류",
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
  },
};
const reference = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ "application/json": { schema } });
const data = (schema: object) => ({
  type: "object",
  required: ["data"],
  properties: { data: schema },
});
const operation = (
  summary: string,
  schema: object,
  status = "200",
  input?: object,
  auth = false,
) => ({
  summary,
  ...(auth ? { security: [{ bearer: [] }, { cookie: [] }] } : {}),
  ...(input ? { requestBody: { required: true, content: json(input) } } : {}),
  responses: {
    [status]:
      status === "204"
        ? { description: "본문 없음" }
        : { description: "성공", content: json(schema) },
    ...Object.fromEntries(
      ["400", "401", "403", "404", "409", "413", "429", "500"].map((code) => [
        code,
        error,
      ]),
    ),
  },
});
const id = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer", minimum: 1 },
};
const string = { type: "string" },
  integer = { type: "integer" };
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
      post: operation(
        "회원가입",
        data(reference("User")),
        "201",
        reference("Signup"),
      ),
    },
    "/api/auth/login": {
      post: operation(
        "로그인·HttpOnly 쿠키 발급",
        data({
          type: "object",
          properties: { user: reference("User"), accessToken: string },
        }),
        "200",
        reference("Login"),
      ),
    },
    "/api/auth/logout": {
      post: operation("토큰 폐기·쿠키 삭제", {}, "204", undefined, true),
    },
    "/api/auth/me": {
      get: operation(
        "내 정보",
        data(reference("User")),
        "200",
        undefined,
        true,
      ),
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
      post: operation(
        "게시글 등록·Location 헤더",
        data(reference("Post")),
        "201",
        reference("PostInput"),
        true,
      ),
    },
    "/api/posts/{id}": {
      parameters: [id],
      get: operation("게시글 상세", data(reference("Post"))),
      patch: operation(
        "작성자 부분 수정",
        data(reference("Post")),
        "200",
        { ...reference("PostPatch") },
        true,
      ),
      delete: operation("작성자 삭제", {}, "204", undefined, true),
    },
    "/api/posts/{id}/comments": {
      parameters: [id],
      get: operation(
        "댓글 목록",
        data({ type: "array", items: reference("Comment") }),
      ),
      post: operation(
        "댓글 등록",
        data(reference("Comment")),
        "201",
        {
          type: "object",
          required: ["body"],
          properties: {
            body: { type: "string", minLength: 1, maxLength: 2000 },
          },
        },
        true,
      ),
    },
    "/api/comments/{id}": {
      parameters: [id],
      delete: operation("내 댓글 삭제", {}, "204", undefined, true),
    },
    "/api/files": {
      get: operation(
        "내 문서 목록",
        data({
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
        }),
        "200",
        undefined,
        true,
      ),
      post: operation(
        "UTF-8 txt/md 업로드",
        data({ type: "object" }),
        "201",
        {
          type: "object",
          required: ["name", "text"],
          properties: {
            name: string,
            text: { type: "string", maxLength: 20000 },
          },
        },
        true,
      ),
    },
    "/api/jobs": {
      post: operation(
        "텍스트 처리 예약",
        data(reference("Job")),
        "202",
        { type: "object", required: ["text"], properties: { text: string } },
        true,
      ),
    },
    "/api/jobs/{id}": {
      parameters: [id],
      get: operation(
        "내 작업 조회",
        data(reference("Job")),
        "200",
        undefined,
        true,
      ),
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
        ...operation(
          "내 이메일로 보내기",
          data({ type: "object" }),
          "200",
          { type: "object", properties: { text: string }, required: ["text"] },
          true,
        ),
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
        ...operation(
          "Stripe 테스트 결제 세션",
          data({ type: "object", properties: { id: string, url: string } }),
          "201",
          undefined,
          true,
        ),
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
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const error = { |
| 2 | 객체·스키마·속성의 값을 지정한다: description: "공통 오류", |
| 3 | 객체·스키마·속성의 값을 지정한다: content: { |
| 4 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "application/json": { schema: { $ref: "#/components/schemas/Error" } }, |
| 5 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 6 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 7 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const reference = (name: string) => ({ $ref: ˋ#/components/schemas/${name}ˋ }); |
| 8 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const json = (schema: object) => ({ "application/json": { schema } }); |
| 9 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const data = (schema: object) => ({ |
| 10 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 11 | 객체·스키마·속성의 값을 지정한다: required: ["data"], |
| 12 | 객체·스키마·속성의 값을 지정한다: properties: { data: schema }, |
| 13 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 14 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const operation = ( |
| 15 | 객체·스키마·속성의 값을 지정한다: summary: string, |
| 16 | 객체·스키마·속성의 값을 지정한다: schema: object, |
| 17 | 현재 구문에서 다음 값·인자·표현식을 연결한다: status = "200", |
| 18 | 현재 구문에서 다음 값·인자·표현식을 연결한다: input?: object, |
| 19 | 현재 구문에서 다음 값·인자·표현식을 연결한다: auth = false, |
| 20 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ) => ({ |
| 21 | 현재 구문에서 다음 값·인자·표현식을 연결한다: summary, |
| 22 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ...(auth ? { security: [{ bearer: [] }, { cookie: [] }] } : {}), |
| 23 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ...(input ? { requestBody: { required: true, content: json(input) } } : {}), |
| 24 | 객체·스키마·속성의 값을 지정한다: responses: { |
| 25 | 현재 구문에서 다음 값·인자·표현식을 연결한다: [status]: |
| 26 | 현재 구문에서 다음 값·인자·표현식을 연결한다: status === "204" |
| 27 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ? { description: "본문 없음" } |
| 28 | 현재 구문에서 다음 값·인자·표현식을 연결한다: : { description: "성공", content: json(schema) }, |
| 29 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ...Object.fromEntries( |
| 30 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ["400", "401", "403", "404", "409", "413", "429", "500"].map((code) => [ |
| 31 | 현재 구문에서 다음 값·인자·표현식을 연결한다: code, |
| 32 | 현재 구문에서 다음 값·인자·표현식을 연결한다: error, |
| 33 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 34 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 35 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 36 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 37 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const id = { |
| 38 | 객체·스키마·속성의 값을 지정한다: name: "id", |
| 39 | 객체·스키마·속성의 값을 지정한다: in: "path", |
| 40 | 객체·스키마·속성의 값을 지정한다: required: true, |
| 41 | 객체·스키마·속성의 값을 지정한다: schema: { type: "integer", minimum: 1 }, |
| 42 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 43 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const string = { type: "string" }, |
| 44 | 현재 구문에서 다음 값·인자·표현식을 연결한다: integer = { type: "integer" }; |
| 45 | 이름 있는 값·설정·함수 또는 상태를 준비한다: export const openapi = { |
| 46 | 객체·스키마·속성의 값을 지정한다: openapi: "3.0.3", |
| 47 | 객체·스키마·속성의 값을 지정한다: info: { title: "Next.js 게시판 공통 API 스펙 v1", version: "1.0.0" }, |
| 48 | 객체·스키마·속성의 값을 지정한다: servers: [{ url: "/" }], |
| 49 | 객체·스키마·속성의 값을 지정한다: paths: { |
| 50 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/health": { |
| 51 | 객체·스키마·속성의 값을 지정한다: get: operation("DB 연결 확인", { |
| 52 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 53 | 객체·스키마·속성의 값을 지정한다: properties: { status: { type: "string", enum: ["ok"] } }, |
| 54 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 55 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 56 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/auth/signup": { |
| 57 | 객체·스키마·속성의 값을 지정한다: post: operation( |
| 58 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "회원가입", |
| 59 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data(reference("User")), |
| 60 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "201", |
| 61 | 현재 구문에서 다음 값·인자·표현식을 연결한다: reference("Signup"), |
| 62 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 63 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 64 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/auth/login": { |
| 65 | 객체·스키마·속성의 값을 지정한다: post: operation( |
| 66 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "로그인·HttpOnly 쿠키 발급", |
| 67 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data({ |
| 68 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 69 | 객체·스키마·속성의 값을 지정한다: properties: { user: reference("User"), accessToken: string }, |
| 70 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 71 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "200", |
| 72 | 현재 구문에서 다음 값·인자·표현식을 연결한다: reference("Login"), |
| 73 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 74 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 75 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/auth/logout": { |
| 76 | 객체·스키마·속성의 값을 지정한다: post: operation("토큰 폐기·쿠키 삭제", {}, "204", undefined, true), |
| 77 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 78 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/auth/me": { |
| 79 | 객체·스키마·속성의 값을 지정한다: get: operation( |
| 80 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "내 정보", |
| 81 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data(reference("User")), |
| 82 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "200", |
| 83 | 현재 구문에서 다음 값·인자·표현식을 연결한다: undefined, |
| 84 | 현재 구문에서 다음 값·인자·표현식을 연결한다: true, |
| 85 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 86 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 87 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/posts": { |
| 88 | 객체·스키마·속성의 값을 지정한다: get: { |
| 89 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ...operation("게시글 목록", { |
| 90 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ...data({ type: "array", items: reference("Post") }), |
| 91 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 92 | 객체·스키마·속성의 값을 지정한다: data: { type: "array", items: reference("Post") }, |
| 93 | 객체·스키마·속성의 값을 지정한다: meta: reference("Meta"), |
| 94 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 95 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 96 | 객체·스키마·속성의 값을 지정한다: parameters: [ |
| 97 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { name: "q", in: "query", schema: string }, |
| 98 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 99 | 객체·스키마·속성의 값을 지정한다: name: "page", |
| 100 | 객체·스키마·속성의 값을 지정한다: in: "query", |
| 101 | 객체·스키마·속성의 값을 지정한다: schema: { type: "integer", minimum: 1, default: 1 }, |
| 102 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 103 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 104 | 객체·스키마·속성의 값을 지정한다: name: "limit", |
| 105 | 객체·스키마·속성의 값을 지정한다: in: "query", |
| 106 | 객체·스키마·속성의 값을 지정한다: description: "50 초과는 50으로 제한", |
| 107 | 객체·스키마·속성의 값을 지정한다: schema: { type: "integer", minimum: 1, default: 10 }, |
| 108 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 109 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 110 | 객체·스키마·속성의 값을 지정한다: name: "sort", |
| 111 | 객체·스키마·속성의 값을 지정한다: in: "query", |
| 112 | 객체·스키마·속성의 값을 지정한다: schema: { |
| 113 | 객체·스키마·속성의 값을 지정한다: type: "string", |
| 114 | 객체·스키마·속성의 값을 지정한다: enum: ["createdAt", "-createdAt", "-commentCount"], |
| 115 | 객체·스키마·속성의 값을 지정한다: default: "-createdAt", |
| 116 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 117 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 118 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 119 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 120 | 객체·스키마·속성의 값을 지정한다: post: operation( |
| 121 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "게시글 등록·Location 헤더", |
| 122 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data(reference("Post")), |
| 123 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "201", |
| 124 | 현재 구문에서 다음 값·인자·표현식을 연결한다: reference("PostInput"), |
| 125 | 현재 구문에서 다음 값·인자·표현식을 연결한다: true, |
| 126 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 127 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 128 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/posts/{id}": { |
| 129 | 객체·스키마·속성의 값을 지정한다: parameters: [id], |
| 130 | 객체·스키마·속성의 값을 지정한다: get: operation("게시글 상세", data(reference("Post"))), |
| 131 | 객체·스키마·속성의 값을 지정한다: patch: operation( |
| 132 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "작성자 부분 수정", |
| 133 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data(reference("Post")), |
| 134 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "200", |
| 135 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { ...reference("PostPatch") }, |
| 136 | 현재 구문에서 다음 값·인자·표현식을 연결한다: true, |
| 137 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 138 | 객체·스키마·속성의 값을 지정한다: delete: operation("작성자 삭제", {}, "204", undefined, true), |
| 139 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 140 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/posts/{id}/comments": { |
| 141 | 객체·스키마·속성의 값을 지정한다: parameters: [id], |
| 142 | 객체·스키마·속성의 값을 지정한다: get: operation( |
| 143 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "댓글 목록", |
| 144 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data({ type: "array", items: reference("Comment") }), |
| 145 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 146 | 객체·스키마·속성의 값을 지정한다: post: operation( |
| 147 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "댓글 등록", |
| 148 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data(reference("Comment")), |
| 149 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "201", |
| 150 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 151 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 152 | 객체·스키마·속성의 값을 지정한다: required: ["body"], |
| 153 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 154 | 객체·스키마·속성의 값을 지정한다: body: { type: "string", minLength: 1, maxLength: 2000 }, |
| 155 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 156 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 157 | 현재 구문에서 다음 값·인자·표현식을 연결한다: true, |
| 158 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 159 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 160 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/comments/{id}": { |
| 161 | 객체·스키마·속성의 값을 지정한다: parameters: [id], |
| 162 | 객체·스키마·속성의 값을 지정한다: delete: operation("내 댓글 삭제", {}, "204", undefined, true), |
| 163 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 164 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/files": { |
| 165 | 객체·스키마·속성의 값을 지정한다: get: operation( |
| 166 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "내 문서 목록", |
| 167 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data({ |
| 168 | 객체·스키마·속성의 값을 지정한다: type: "array", |
| 169 | 객체·스키마·속성의 값을 지정한다: items: { |
| 170 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 171 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 172 | 객체·스키마·속성의 값을 지정한다: id: integer, |
| 173 | 객체·스키마·속성의 값을 지정한다: ownerId: integer, |
| 174 | 객체·스키마·속성의 값을 지정한다: name: string, |
| 175 | 객체·스키마·속성의 값을 지정한다: text: string, |
| 176 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 177 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 178 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 179 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "200", |
| 180 | 현재 구문에서 다음 값·인자·표현식을 연결한다: undefined, |
| 181 | 현재 구문에서 다음 값·인자·표현식을 연결한다: true, |
| 182 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 183 | 객체·스키마·속성의 값을 지정한다: post: operation( |
| 184 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "UTF-8 txt/md 업로드", |
| 185 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data({ type: "object" }), |
| 186 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "201", |
| 187 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 188 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 189 | 객체·스키마·속성의 값을 지정한다: required: ["name", "text"], |
| 190 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 191 | 객체·스키마·속성의 값을 지정한다: name: string, |
| 192 | 객체·스키마·속성의 값을 지정한다: text: { type: "string", maxLength: 20000 }, |
| 193 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 194 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 195 | 현재 구문에서 다음 값·인자·표현식을 연결한다: true, |
| 196 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 197 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 198 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/jobs": { |
| 199 | 객체·스키마·속성의 값을 지정한다: post: operation( |
| 200 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "텍스트 처리 예약", |
| 201 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data(reference("Job")), |
| 202 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "202", |
| 203 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { type: "object", required: ["text"], properties: { text: string } }, |
| 204 | 현재 구문에서 다음 값·인자·표현식을 연결한다: true, |
| 205 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 206 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 207 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/jobs/{id}": { |
| 208 | 객체·스키마·속성의 값을 지정한다: parameters: [id], |
| 209 | 객체·스키마·속성의 값을 지정한다: get: operation( |
| 210 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "내 작업 조회", |
| 211 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data(reference("Job")), |
| 212 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "200", |
| 213 | 현재 구문에서 다음 값·인자·표현식을 연결한다: undefined, |
| 214 | 현재 구문에서 다음 값·인자·표현식을 연결한다: true, |
| 215 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 216 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 217 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/ai/summary": { |
| 218 | 객체·스키마·속성의 값을 지정한다: post: { |
| 219 | 객체·스키마·속성의 값을 지정한다: summary: "문서 요약·질문: text/plain UTF-8 스트림", |
| 220 | 객체·스키마·속성의 값을 지정한다: security: [{ cookie: [] }, { bearer: [] }], |
| 221 | 객체·스키마·속성의 값을 지정한다: requestBody: { |
| 222 | 객체·스키마·속성의 값을 지정한다: content: json({ |
| 223 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 224 | 객체·스키마·속성의 값을 지정한다: properties: { text: string, fileId: integer, question: string }, |
| 225 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 226 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 227 | 객체·스키마·속성의 값을 지정한다: responses: { |
| 228 | 객체·스키마·속성의 값을 지정한다: "200": { |
| 229 | 객체·스키마·속성의 값을 지정한다: description: "텍스트 스트림", |
| 230 | 객체·스키마·속성의 값을 지정한다: content: { "text/plain": { schema: string } }, |
| 231 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 232 | 객체·스키마·속성의 값을 지정한다: "400": error, |
| 233 | 객체·스키마·속성의 값을 지정한다: "401": error, |
| 234 | 객체·스키마·속성의 값을 지정한다: "503": error, |
| 235 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 236 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 237 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 238 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/events": { |
| 239 | 객체·스키마·속성의 값을 지정한다: get: { |
| 240 | 객체·스키마·속성의 값을 지정한다: summary: "내 작업 알림 SSE", |
| 241 | 객체·스키마·속성의 값을 지정한다: security: [{ cookie: [] }], |
| 242 | 객체·스키마·속성의 값을 지정한다: responses: { |
| 243 | 객체·스키마·속성의 값을 지정한다: "200": { |
| 244 | 객체·스키마·속성의 값을 지정한다: description: "최대 30초 후 재연결", |
| 245 | 서버가 보내는 작업 알림 SSE 연결 또는 응답 형식을 구성한다. |
| 246 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 247 | 객체·스키마·속성의 값을 지정한다: "401": error, |
| 248 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 249 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 250 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 251 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/mail": { |
| 252 | 객체·스키마·속성의 값을 지정한다: post: { |
| 253 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ...operation( |
| 254 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "내 이메일로 보내기", |
| 255 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data({ type: "object" }), |
| 256 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "200", |
| 257 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { type: "object", properties: { text: string }, required: ["text"] }, |
| 258 | 현재 구문에서 다음 값·인자·표현식을 연결한다: true, |
| 259 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 260 | 객체·스키마·속성의 값을 지정한다: parameters: [ |
| 261 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 262 | 객체·스키마·속성의 값을 지정한다: name: "Idempotency-Key", |
| 263 | 객체·스키마·속성의 값을 지정한다: in: "header", |
| 264 | 객체·스키마·속성의 값을 지정한다: required: true, |
| 265 | 객체·스키마·속성의 값을 지정한다: schema: string, |
| 266 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 267 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 268 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 269 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 270 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/payments/checkout": { |
| 271 | 객체·스키마·속성의 값을 지정한다: post: { |
| 272 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ...operation( |
| 273 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "Stripe 테스트 결제 세션", |
| 274 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data({ type: "object", properties: { id: string, url: string } }), |
| 275 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "201", |
| 276 | 현재 구문에서 다음 값·인자·표현식을 연결한다: undefined, |
| 277 | 현재 구문에서 다음 값·인자·표현식을 연결한다: true, |
| 278 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 279 | 객체·스키마·속성의 값을 지정한다: parameters: [ |
| 280 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 281 | 객체·스키마·속성의 값을 지정한다: name: "Idempotency-Key", |
| 282 | 객체·스키마·속성의 값을 지정한다: in: "header", |
| 283 | 객체·스키마·속성의 값을 지정한다: required: true, |
| 284 | 객체·스키마·속성의 값을 지정한다: schema: string, |
| 285 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 286 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 287 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 288 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 289 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/payments/webhook": { |
| 290 | 객체·스키마·속성의 값을 지정한다: post: { |
| 291 | 객체·스키마·속성의 값을 지정한다: summary: "Stripe 원문 서명 검증·이벤트 중복 제거", |
| 292 | 객체·스키마·속성의 값을 지정한다: parameters: [ |
| 293 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 294 | 객체·스키마·속성의 값을 지정한다: name: "stripe-signature", |
| 295 | 객체·스키마·속성의 값을 지정한다: in: "header", |
| 296 | 객체·스키마·속성의 값을 지정한다: required: true, |
| 297 | 객체·스키마·속성의 값을 지정한다: schema: string, |
| 298 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 299 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 300 | 객체·스키마·속성의 값을 지정한다: requestBody: { content: json({ type: "object" }) }, |
| 301 | 객체·스키마·속성의 값을 지정한다: responses: { "200": { description: "수신 완료" }, "400": error }, |
| 302 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 303 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 304 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 305 | 객체·스키마·속성의 값을 지정한다: components: { |
| 306 | 객체·스키마·속성의 값을 지정한다: securitySchemes: { |
| 307 | 객체·스키마·속성의 값을 지정한다: bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" }, |
| 308 | 객체·스키마·속성의 값을 지정한다: cookie: { type: "apiKey", in: "cookie", name: "course_session" }, |
| 309 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 310 | 객체·스키마·속성의 값을 지정한다: schemas: { |
| 311 | 객체·스키마·속성의 값을 지정한다: Error: { |
| 312 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 313 | 객체·스키마·속성의 값을 지정한다: required: ["error"], |
| 314 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 315 | 객체·스키마·속성의 값을 지정한다: error: { |
| 316 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 317 | 객체·스키마·속성의 값을 지정한다: required: ["code", "message", "fields", "requestId"], |
| 318 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 319 | 객체·스키마·속성의 값을 지정한다: code: string, |
| 320 | 객체·스키마·속성의 값을 지정한다: message: string, |
| 321 | 객체·스키마·속성의 값을 지정한다: requestId: string, |
| 322 | 객체·스키마·속성의 값을 지정한다: fields: { |
| 323 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 324 | 객체·스키마·속성의 값을 지정한다: additionalProperties: { type: "array", items: string }, |
| 325 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 326 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 327 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 328 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 329 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 330 | 객체·스키마·속성의 값을 지정한다: User: { |
| 331 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 332 | 객체·스키마·속성의 값을 지정한다: required: ["id", "email", "nickname"], |
| 333 | 객체·스키마·속성의 값을 지정한다: properties: { id: integer, email: string, nickname: string }, |
| 334 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 335 | 객체·스키마·속성의 값을 지정한다: Login: { |
| 336 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 337 | 객체·스키마·속성의 값을 지정한다: required: ["email", "password"], |
| 338 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 339 | 객체·스키마·속성의 값을 지정한다: email: { type: "string", format: "email" }, |
| 340 | 객체·스키마·속성의 값을 지정한다: password: { type: "string", minLength: 8, maxLength: 72 }, |
| 341 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 342 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 343 | 객체·스키마·속성의 값을 지정한다: Signup: { |
| 344 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 345 | 객체·스키마·속성의 값을 지정한다: required: ["email", "password", "nickname"], |
| 346 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 347 | 객체·스키마·속성의 값을 지정한다: email: { type: "string", format: "email" }, |
| 348 | 객체·스키마·속성의 값을 지정한다: password: { type: "string", minLength: 8, maxLength: 72 }, |
| 349 | 객체·스키마·속성의 값을 지정한다: nickname: { type: "string", minLength: 1, maxLength: 40 }, |
| 350 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 351 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 352 | 객체·스키마·속성의 값을 지정한다: PostInput: { |
| 353 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 354 | 객체·스키마·속성의 값을 지정한다: required: ["title", "body"], |
| 355 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 356 | 객체·스키마·속성의 값을 지정한다: title: { type: "string", minLength: 1, maxLength: 200 }, |
| 357 | 객체·스키마·속성의 값을 지정한다: body: { type: "string", minLength: 1, maxLength: 20000 }, |
| 358 | 객체·스키마·속성의 값을 지정한다: tags: { |
| 359 | 객체·스키마·속성의 값을 지정한다: type: "array", |
| 360 | 객체·스키마·속성의 값을 지정한다: maxItems: 10, |
| 361 | 객체·스키마·속성의 값을 지정한다: items: { type: "string", maxLength: 30 }, |
| 362 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 363 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 364 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 365 | 객체·스키마·속성의 값을 지정한다: PostPatch: { |
| 366 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 367 | 객체·스키마·속성의 값을 지정한다: minProperties: 1, |
| 368 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 369 | 객체·스키마·속성의 값을 지정한다: title: { type: "string", minLength: 1, maxLength: 200 }, |
| 370 | 객체·스키마·속성의 값을 지정한다: body: { type: "string", minLength: 1, maxLength: 20000 }, |
| 371 | 객체·스키마·속성의 값을 지정한다: tags: { |
| 372 | 객체·스키마·속성의 값을 지정한다: type: "array", |
| 373 | 객체·스키마·속성의 값을 지정한다: maxItems: 10, |
| 374 | 객체·스키마·속성의 값을 지정한다: items: { type: "string", maxLength: 30 }, |
| 375 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 376 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 377 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 378 | 객체·스키마·속성의 값을 지정한다: Post: { |
| 379 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 380 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 381 | 객체·스키마·속성의 값을 지정한다: id: integer, |
| 382 | 객체·스키마·속성의 값을 지정한다: title: string, |
| 383 | 객체·스키마·속성의 값을 지정한다: body: string, |
| 384 | 객체·스키마·속성의 값을 지정한다: tags: { type: "array", items: string }, |
| 385 | 객체·스키마·속성의 값을 지정한다: author: { |
| 386 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 387 | 객체·스키마·속성의 값을 지정한다: properties: { id: integer, nickname: string }, |
| 388 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 389 | 객체·스키마·속성의 값을 지정한다: commentCount: integer, |
| 390 | 객체·스키마·속성의 값을 지정한다: createdAt: { type: "string", format: "date-time" }, |
| 391 | 객체·스키마·속성의 값을 지정한다: updatedAt: { type: "string", format: "date-time" }, |
| 392 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 393 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 394 | 객체·스키마·속성의 값을 지정한다: Comment: { |
| 395 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 396 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 397 | 객체·스키마·속성의 값을 지정한다: id: integer, |
| 398 | 객체·스키마·속성의 값을 지정한다: postId: integer, |
| 399 | 객체·스키마·속성의 값을 지정한다: authorId: integer, |
| 400 | 객체·스키마·속성의 값을 지정한다: body: string, |
| 401 | 객체·스키마·속성의 값을 지정한다: author: reference("User"), |
| 402 | 객체·스키마·속성의 값을 지정한다: createdAt: { type: "string", format: "date-time" }, |
| 403 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 404 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 405 | 객체·스키마·속성의 값을 지정한다: Meta: { |
| 406 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 407 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 408 | 객체·스키마·속성의 값을 지정한다: page: integer, |
| 409 | 객체·스키마·속성의 값을 지정한다: limit: integer, |
| 410 | 객체·스키마·속성의 값을 지정한다: total: integer, |
| 411 | 객체·스키마·속성의 값을 지정한다: totalPages: integer, |
| 412 | 객체·스키마·속성의 값을 지정한다: q: string, |
| 413 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 414 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 415 | 객체·스키마·속성의 값을 지정한다: Job: { |
| 416 | 객체·스키마·속성의 값을 지정한다: type: "object", |
| 417 | 객체·스키마·속성의 값을 지정한다: properties: { |
| 418 | 객체·스키마·속성의 값을 지정한다: id: integer, |
| 419 | 객체·스키마·속성의 값을 지정한다: ownerId: integer, |
| 420 | 객체·스키마·속성의 값을 지정한다: status: { type: "string", enum: ["pending", "done", "failed"] }, |
| 421 | 객체·스키마·속성의 값을 지정한다: attempts: integer, |
| 422 | 객체·스키마·속성의 값을 지정한다: text: string, |
| 423 | 객체·스키마·속성의 값을 지정한다: result: string, |
| 424 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 425 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 426 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 427 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 428 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/project/src/course/http.ts

[실행 파일](tsx_version/project/src/course/http.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/src/course/http.ts sha256:3a4c106993b8225781b4c658191a753aba09877d3ec1862df9dc0ee2a6cb88a7 -->
~~~ts
import { ApiError } from "./domain";
export async function jsonBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(400, "BAD_REQUEST", "application/json이 필요합니다.");
  const reader = request.body?.getReader();
  if (!reader)
    throw new ApiError(400, "BAD_REQUEST", "JSON 본문이 필요합니다.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 64_000) {
        await reader.cancel();
        throw new ApiError(413, "PAYLOAD_TOO_LARGE", "JSON은 64KB까지입니다.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("object required");
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "BAD_REQUEST", "JSON 문법을 확인하세요.");
  } finally {
    reader.releaseLock();
  }
}
export function reply(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, { status, headers });
}
export function failure(error: unknown, requestId: string) {
  const known = error instanceof ApiError;
  if (!known)
    console.error(
      JSON.stringify({
        requestId,
        event: "request_failed",
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
  return reply(
    {
      error: {
        code: known ? error.code : "INTERNAL",
        message: known ? error.message : "서버 오류가 발생했습니다.",
        fields: known ? error.fields : {},
        requestId,
      },
    },
    known ? error.status : 500,
  );
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { ApiError } from "./domain"; |
| 2 | jsonBody의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 3 | 객체·스키마·속성의 값을 지정한다: request: Request, |
| 4 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ): Promise<Record<string, unknown>> { |
| 5 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!request.headers.get("content-type")?.includes("application/json")) |
| 6 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(400, "BAD_REQUEST", "application/json이 필요합니다."); |
| 7 | 응답 스트림을 순서대로 읽거나 읽기 잠금을 정리한다. |
| 8 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!reader) |
| 9 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(400, "BAD_REQUEST", "JSON 본문이 필요합니다."); |
| 10 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const chunks: Uint8Array[] = []; |
| 11 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let size = 0; |
| 12 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 13 | 배열·반복 요청·스트림을 순서대로 처리하며 종료 조건을 확인한다. |
| 14 | 응답 스트림을 순서대로 읽거나 읽기 잠금을 정리한다. |
| 15 | 입력·상태 조건에 따라 처리 경로를 고른다: if (done) break; |
| 16 | 현재 구문에서 다음 값·인자·표현식을 연결한다: size += value.length; |
| 17 | 입력·상태 조건에 따라 처리 경로를 고른다: if (size > 64_000) { |
| 18 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await reader.cancel(); |
| 19 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(413, "PAYLOAD_TOO_LARGE", "JSON은 64KB까지입니다."); |
| 20 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 21 | 현재 구문에서 다음 값·인자·표현식을 연결한다: chunks.push(value); |
| 22 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 23 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const bytes = new Uint8Array(size); |
| 24 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let offset = 0; |
| 25 | 배열·반복 요청·스트림을 순서대로 처리하며 종료 조건을 확인한다. |
| 26 | 현재 구문에서 다음 값·인자·표현식을 연결한다: bytes.set(chunk, offset); |
| 27 | 현재 구문에서 다음 값·인자·표현식을 연결한다: offset += chunk.length; |
| 28 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 29 | UTF-8 조각 경계를 유지하며 스트림 바이트를 문자열로 바꾼다. |
| 30 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!body \|\| typeof body !== "object" \|\| Array.isArray(body)) |
| 31 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: throw new Error("object required"); |
| 32 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return body; |
| 33 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 34 | 입력·상태 조건에 따라 처리 경로를 고른다: if (error instanceof ApiError) throw error; |
| 35 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(400, "BAD_REQUEST", "JSON 문법을 확인하세요."); |
| 36 | 성공·실패에 관계없이 잠금·연결·mock을 정리한다. |
| 37 | 응답 스트림을 순서대로 읽거나 읽기 잠금을 정리한다. |
| 38 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 39 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 40 | reply의 입력·반환 경계를 정의한다. |
| 41 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return Response.json(data, { status, headers }); |
| 42 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 43 | failure의 입력·반환 경계를 정의한다. |
| 44 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const known = error instanceof ApiError; |
| 45 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!known) |
| 46 | 현재 구문에서 다음 값·인자·표현식을 연결한다: console.error( |
| 47 | 현재 구문에서 다음 값·인자·표현식을 연결한다: JSON.stringify({ |
| 48 | 현재 구문에서 다음 값·인자·표현식을 연결한다: requestId, |
| 49 | 객체·스키마·속성의 값을 지정한다: event: "request_failed", |
| 50 | 객체·스키마·속성의 값을 지정한다: error: error instanceof Error ? error.message : "unknown", |
| 51 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 52 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 53 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply( |
| 54 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 55 | 객체·스키마·속성의 값을 지정한다: error: { |
| 56 | 객체·스키마·속성의 값을 지정한다: code: known ? error.code : "INTERNAL", |
| 57 | 객체·스키마·속성의 값을 지정한다: message: known ? error.message : "서버 오류가 발생했습니다.", |
| 58 | 객체·스키마·속성의 값을 지정한다: fields: known ? error.fields : {}, |
| 59 | 현재 구문에서 다음 값·인자·표현식을 연결한다: requestId, |
| 60 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 61 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 62 | 현재 구문에서 다음 값·인자·표현식을 연결한다: known ? error.status : 500, |
| 63 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 64 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/project/src/app/api-docs/page.tsx

[실행 파일](tsx_version/project/src/app/api-docs/page.tsx)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/src/app/api-docs/page.tsx sha256:847aac024b81bd95c32161320ba55eeb0403a70c4d185c40fd3df91d06f28873 -->
~~~tsx
import { openapi } from '@/course/openapi';
export default function ApiDocs() { return <section><h1>OpenAPI 3 · 게시판 v1</h1><p><a href="/api/openapi" download="openapi.json">OpenAPI JSON 다운로드</a> · <a href="/board">게시판</a></p><p>Swagger Editor에 JSON을 가져오면 요청 스키마를 확인할 수 있습니다.</p><pre style={{ overflowX: 'auto' }}>{JSON.stringify(openapi, null, 2)}</pre></section>; }
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { openapi } from '@/course/openapi'; |
| 2 | 현재 구문에서 다음 값·인자·표현식을 연결한다: export default function ApiDocs() { return <section><h1>OpenAPI 3 · 게시판 v1</h1><p><a href="/api/openapi" download="openapi.json">OpenAPI JSON 다운로드</a> · <a href="/board">게시판</a></p><p>Swagger Editor에 JSON을 가져오면 요청 스키마를 확인할 수 있습니다.</p><pre style={{ overflowX: 'auto' }}>{JSON.stringify(openapi, null, 2)}</pre></section>; } |

## ④ 🔗 연동 포인트

스키마는 테스트의 기대값과 클라이언트 타입의 기준이다. 이후 기능을 추가하면 경로·권한·오류·content-type을 함께 갱신한다. AI는 JSON이 아니라 text/plain 스트림, 알림은 text/event-stream으로 별도 명시한다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| 문서는 200인데 실제 201 | 구현·스키마 동시 변경 누락 | 계약 테스트와 스키마 함께 수정 |
| 서버 스택 노출 | 예외를 그대로 응답 | 공통 failure에서 500 메시지 고정 |
| 버전별 응답 불일치 | 별칭에 다른 핸들러 연결 | 하나의 v1 구현으로 정규화 |

## ⑥ 직접 해보기

1. Swagger Editor에서 경로·스키마 참조 오류가 없는지 확인한다.
2. requestId를 지정해 응답 헤더와 오류 본문이 같은지 확인한다.
3. 추가 필드는 하위 호환인지, 새 버전이 필요한지 설명한다.

## ⑦ ☐ 체크리스트

- [ ] REST·OpenAPI 3·페이지네이션·버전 정책을 문서화했다.
- [ ] 공통 v1 성공·오류 응답을 유지한다.
- [ ] 스트리밍 응답의 content-type을 구분했다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study15](study15.md)에서 공개 데이터만 캐시하고 영속 작업 큐와 측정으로 성능을 확인한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
