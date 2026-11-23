# study7 — 인증·작성자 권한·보안 기초

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

비밀번호 해시와 JWT 쿠키를 사용하고 API에서 세션·소유권을 검증한다.

## ② 📖 이론

가입 시 bcrypt 해시를 저장하고 로그인 때 compare한다. 원문 비밀번호와 해시는 응답에서 제외한다. JWT는 HS256, issuer, audience, 만료를 검증하며 로그아웃한 jti는 재사용할 수 없다.

로그인은 HttpOnly·SameSite=Lax 쿠키를 설정하고 HTTPS 운영에서는 Secure를 추가한다. 브라우저는 같은 출처 요청에 쿠키를 보낸다. API 클라이언트는 accessToken을 Bearer로 보낼 수도 있다. 프론트는 /api/auth/me의 공개 사용자로 로그인 상태를 확인한다.

쿠키는 입장권, 서명 검증은 위조 검사, 작성자 검사는 좌석 소유권 검사다. proxy는 빠른 입구 안내일 뿐이며 API와 Action이 실제 권한을 다시 검사한다. CORS는 브라우저의 읽기 허용 정책이고 인증을 대신하지 않는다.

XSS는 신뢰할 수 없는 HTML을 실행하는 공격이다. JSX 텍스트 출력과 pre를 사용하고 dangerouslySetInnerHTML을 쓰지 않는다. CSRF는 자동 첨부 쿠키를 악용하므로 쓰기 요청의 Origin을 APP_ORIGIN과 대조한다. 쿠키 쓰기인데 Origin이 없으면 거절한다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. JWT_SECRET을 난수 32자 이상으로 설정하고 /board에서 가입 후 로그인한다.
2. 개발자도구 Application → Cookies에서 HttpOnly/SameSite를 확인한다. 토큰을 localStorage에 저장하지 않는다.
3. 두 계정으로 글을 만들고 상대 계정의 수정·삭제 요청이 403인지 확인한다.
4. 로그아웃 뒤 기존 Bearer를 재전송해 401을 확인한다. 다른 Origin을 포함한 쿠키 쓰기 요청도 차단되는지 본다.

~~~powershell
cd tsx_version/demo
# 개발 서버가 켜진 별도 PowerShell에서 실행
$account = @{email="learner@example.com";password="password123";nickname="학습자"} | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/api/auth/signup -Method Post -ContentType application/json -Body $account
$login = Invoke-RestMethod http://localhost:3000/api/auth/login -Method Post -ContentType application/json -Body $account
$authHeaders = @{Authorization="Bearer " + $login.data.accessToken}
Invoke-RestMethod http://localhost:3000/api/auth/me -Headers $authHeaders
Invoke-RestMethod http://localhost:3000/api/auth/logout -Method Post -Headers $authHeaders
~~~

### 보안 경계와 제한

인증 경로는 이메일별 분당 제한을 두며 확장 기능은 사용자별 제한을 둔다. 현재 Map 제한은 단일 프로세스 학습용이므로 다중 인스턴스에서는 공유 제한 저장소가 필요하다. 로그아웃 jti 목록도 만료 시각 기반 정리로 개선해야 한다. 비밀번호 재설정·메일 인증·다중요소 인증은 이번 학습 구현 범위 밖이다. 직접 JWT를 사용했고 Auth.js/NextAuth는 OAuth가 필요할 때 검토할 수 있으나 다른 인증 시스템을 함께 도입하지 않는다.

### tsx_version/demo/course/security.ts

[실행 파일](tsx_version/demo/course/security.ts)

비밀번호·토큰·쿠키·Origin·호출 제한을 한 서버 모듈에서 처리한다. UI 상태를 신뢰하지 않고 API 요청마다 세션과 작성자를 검사한다.

<!-- source:tsx_version/demo/course/security.ts sha256:c87d5c779709bd3a3cbfd6a2e2e1189f8992bc0be801d596670172f64d09e393 -->
~~~ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ApiError, type State } from "./domain";
export const COOKIE = "course_session";
export function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32)
    throw new ApiError(
      503,
      "CONFIG_REQUIRED",
      "JWT_SECRET을 32자 이상 설정하세요.",
    );
  return value;
}
export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const checkPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);
export function issueToken(id: number) {
  return jwt.sign({ sub: String(id), jti: crypto.randomUUID() }, secret(), {
    algorithm: "HS256",
    expiresIn: "1h",
    issuer: "next-study",
    audience: "next-study",
  });
}
export function tokenFrom(request: Request) {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7);
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
}
export function authenticate(request: Request, state: State) {
  const token = tokenFrom(request);
  if (!token) throw new ApiError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  try {
    const payload = jwt.verify(token, secret(), {
      algorithms: ["HS256"],
      issuer: "next-study",
      audience: "next-study",
    }) as jwt.JwtPayload;
    const user = state.users.find((u) => String(u.id) === payload.sub);
    if (!user || !payload.jti || state.revoked.includes(payload.jti))
      throw new Error("invalid session");
    return { user, jti: payload.jti };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "세션이 만료되었거나 유효하지 않습니다.",
    );
  }
}
export function sessionCookie(token: string, maxAge = 3600) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function protectOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const expected = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== expected)
    throw new ApiError(403, "FORBIDDEN", "허용되지 않은 출처입니다.");
  if (!origin && tokenFrom(request) && !request.headers.get("authorization"))
    throw new ApiError(
      403,
      "FORBIDDEN",
      "쿠키 쓰기 요청에는 Origin이 필요합니다.",
    );
}
const attempts = new Map<string, { count: number; until: number }>();
export function rateLimit(key: string, max = 30) {
  const now = Date.now();
  for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
  const entry = attempts.get(key) ?? { count: 0, until: now + 60_000 };
  if (++entry.count > max)
    throw new ApiError(429, "RATE_LIMITED", "잠시 후 다시 시도하세요.");
  attempts.set(key, entry); // 단일 프로세스 학습용. 복제 배포에서는 공유 저장소로 바꾼다.
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: bcrypt from "bcryptjs"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: jwt from "jsonwebtoken"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { ApiError, type State } from "./domain"; |
| 4 | 이름 있는 값·설정·함수 또는 상태를 준비한다: export const COOKIE = "course_session"; |
| 5 | secret의 입력·반환 경계를 정의한다. |
| 6 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const value = process.env.JWT_SECRET; |
| 7 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!value \|\| value.length < 32) |
| 8 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 503, |
| 10 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "CONFIG_REQUIRED", |
| 11 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "JWT_SECRET을 32자 이상 설정하세요.", |
| 12 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 13 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return value; |
| 14 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 15 | 비밀번호를 안전한 해시로 저장하거나 입력 비밀번호와 해시를 비교한다. |
| 16 | 이름 있는 값·설정·함수 또는 상태를 준비한다: export const checkPassword = (password: string, hash: string) => |
| 17 | 비밀번호를 안전한 해시로 저장하거나 입력 비밀번호와 해시를 비교한다. |
| 18 | issueToken의 입력·반환 경계를 정의한다. |
| 19 | JWT를 발급하거나 허용 알고리즘·발급자·대상·만료 조건으로 검증한다. |
| 20 | 객체·스키마·속성의 값을 지정한다: algorithm: "HS256", |
| 21 | 객체·스키마·속성의 값을 지정한다: expiresIn: "1h", |
| 22 | 객체·스키마·속성의 값을 지정한다: issuer: "next-study", |
| 23 | 객체·스키마·속성의 값을 지정한다: audience: "next-study", |
| 24 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 25 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 26 | tokenFrom의 입력·반환 경계를 정의한다. |
| 27 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const bearer = request.headers.get("authorization"); |
| 28 | 입력·상태 조건에 따라 처리 경로를 고른다: if (bearer?.startsWith("Bearer ")) return bearer.slice(7); |
| 29 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return request.headers |
| 30 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .get("cookie") |
| 31 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ?.split(";") |
| 32 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .map((s) => s.trim()) |
| 33 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .find((s) => s.startsWith(ˋ${COOKIE}=ˋ)) |
| 34 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ?.slice(COOKIE.length + 1); |
| 35 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 36 | authenticate의 입력·반환 경계를 정의한다. |
| 37 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const token = tokenFrom(request); |
| 38 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: if (!token) throw new ApiError(401, "UNAUTHORIZED", "로그인이 필요합니다."); |
| 39 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 40 | JWT를 발급하거나 허용 알고리즘·발급자·대상·만료 조건으로 검증한다. |
| 41 | 객체·스키마·속성의 값을 지정한다: algorithms: ["HS256"], |
| 42 | 객체·스키마·속성의 값을 지정한다: issuer: "next-study", |
| 43 | 객체·스키마·속성의 값을 지정한다: audience: "next-study", |
| 44 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }) as jwt.JwtPayload; |
| 45 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const user = state.users.find((u) => String(u.id) === payload.sub); |
| 46 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!user \|\| !payload.jti \|\| state.revoked.includes(payload.jti)) |
| 47 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: throw new Error("invalid session"); |
| 48 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return { user, jti: payload.jti }; |
| 49 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 50 | 입력·상태 조건에 따라 처리 경로를 고른다: if (error instanceof ApiError) throw error; |
| 51 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 52 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 401, |
| 53 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "UNAUTHORIZED", |
| 54 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "세션이 만료되었거나 유효하지 않습니다.", |
| 55 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 56 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 57 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 58 | sessionCookie의 입력·반환 경계를 정의한다. |
| 59 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return ˋ${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}ˋ; |
| 60 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 61 | protectOrigin의 입력·반환 경계를 정의한다. |
| 62 | 입력·상태 조건에 따라 처리 경로를 고른다: if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return; |
| 63 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const expected = process.env.APP_ORIGIN ?? new URL(request.url).origin; |
| 64 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const origin = request.headers.get("origin"); |
| 65 | 입력·상태 조건에 따라 처리 경로를 고른다: if (origin && origin !== expected) |
| 66 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(403, "FORBIDDEN", "허용되지 않은 출처입니다."); |
| 67 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!origin && tokenFrom(request) && !request.headers.get("authorization")) |
| 68 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 69 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 403, |
| 70 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "FORBIDDEN", |
| 71 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "쿠키 쓰기 요청에는 Origin이 필요합니다.", |
| 72 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 73 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 74 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const attempts = new Map<string, { count: number; until: number }>(); |
| 75 | rateLimit의 입력·반환 경계를 정의한다. |
| 76 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const now = Date.now(); |
| 77 | 배열·반복 요청·스트림을 순서대로 처리하며 종료 조건을 확인한다. |
| 78 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const entry = attempts.get(key) ?? { count: 0, until: now + 60_000 }; |
| 79 | 입력·상태 조건에 따라 처리 경로를 고른다: if (++entry.count > max) |
| 80 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(429, "RATE_LIMITED", "잠시 후 다시 시도하세요."); |
| 81 | 현재 구문에서 다음 값·인자·표현식을 연결한다: attempts.set(key, entry); // 단일 프로세스 학습용. 복제 배포에서는 공유 저장소로 바꾼다. |
| 82 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/demo/proxy.ts

[실행 파일](tsx_version/demo/proxy.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/proxy.ts sha256:cce43499214840c023b90fea03a846537c7782ae5d0f6ad31a761199af99898b -->
~~~ts
import { NextResponse, type NextRequest } from 'next/server';
export function proxy(request: NextRequest) {
  if (request.cookies.get('course_session')?.value) return NextResponse.next();
  return NextResponse.redirect(new URL('/board', request.url));
}
export const config = { matcher: ['/private-lab/:path*'] };
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { NextResponse, type NextRequest } from 'next/server'; |
| 2 | proxy의 입력·반환 경계를 정의한다. |
| 3 | 입력·상태 조건에 따라 처리 경로를 고른다: if (request.cookies.get('course_session')?.value) return NextResponse.next(); |
| 4 | 인증 또는 저장 결과에 따라 다음 화면으로 이동한다. |
| 5 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 6 | 이름 있는 값·설정·함수 또는 상태를 준비한다: export const config = { matcher: ['/private-lab/:path*'] }; |

### tsx_version/demo/course/note-action.ts

[실행 파일](tsx_version/demo/course/note-action.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/course/note-action.ts sha256:5bd36b491cf303ce8914491924149a5f28574c2f7767e29f9fb4f511af6617d9 -->
~~~ts
"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { authenticate, COOKIE } from "./security";
import { text } from "./domain";
import { getRepository } from "./repository";
// 버튼 숨김·proxy를 신뢰하지 않는다. Action 자체에서 세션과 필드 검사를 반복한다.
export async function addQuickPost(form: FormData) {
  const token = (await cookies()).get(COOKIE)?.value;
  const request = new Request("http://internal/action", {
    headers: { cookie: `${COOKIE}=${token ?? ""}` },
  });
  const title = text(form.get("title"), "title", 200),
    body = text(form.get("body"), "body", 20_000);
  await (
    await getRepository()
  ).change((state) => {
    const { user } = authenticate(request, state),
      now = new Date().toISOString();
    state.posts.push({
      id: ++state.seq,
      title,
      body,
      tags: [],
      authorId: user.id,
      createdAt: now,
      updatedAt: now,
    });
  });
  revalidatePath("/board");
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | export한 비동기 함수를 서버에서 실행하는 Action으로 선언한다. |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { revalidatePath } from "next/cache"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { cookies } from "next/headers"; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: { authenticate, COOKIE } from "./security"; |
| 5 | 외부 모듈 또는 공용 함수·타입을 가져온다: { text } from "./domain"; |
| 6 | 외부 모듈 또는 공용 함수·타입을 가져온다: { getRepository } from "./repository"; |
| 7 | 주석: 버튼 숨김·proxy를 신뢰하지 않는다. Action 자체에서 세션과 필드 검사를 반복한다. |
| 8 | addQuickPost의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 9 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const token = (await cookies()).get(COOKIE)?.value; |
| 10 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const request = new Request("http://internal/action", { |
| 11 | 객체·스키마·속성의 값을 지정한다: headers: { cookie: ˋ${COOKIE}=${token ?? ""}ˋ }, |
| 12 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 13 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const title = text(form.get("title"), "title", 200), |
| 14 | 현재 구문에서 다음 값·인자·표현식을 연결한다: body = text(form.get("body"), "body", 20_000); |
| 15 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await ( |
| 16 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await getRepository() |
| 17 | Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다. |
| 18 | 현재 요청의 토큰·서명·만료·로그아웃 상태와 사용자 존재를 확인한다. |
| 19 | 현재 구문에서 다음 값·인자·표현식을 연결한다: now = new Date().toISOString(); |
| 20 | 현재 구문에서 다음 값·인자·표현식을 연결한다: state.posts.push({ |
| 21 | 객체·스키마·속성의 값을 지정한다: id: ++state.seq, |
| 22 | 현재 구문에서 다음 값·인자·표현식을 연결한다: title, |
| 23 | 현재 구문에서 다음 값·인자·표현식을 연결한다: body, |
| 24 | 객체·스키마·속성의 값을 지정한다: tags: [], |
| 25 | 객체·스키마·속성의 값을 지정한다: authorId: user.id, |
| 26 | 객체·스키마·속성의 값을 지정한다: createdAt: now, |
| 27 | 객체·스키마·속성의 값을 지정한다: updatedAt: now, |
| 28 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 29 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 30 | 데이터 변경 뒤 해당 경로의 서버 화면 캐시를 재검증한다. |
| 31 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

## ④ 🔗 연동 포인트

UI는 /api/auth/me로 사용자만 공유하고 API는 각 요청의 서명·만료·작성자를 검사한다. 새 Action addQuickPost도 같은 검사 함수를 호출한다. 외부 OAuth는 study13에서 같은 course_session 계약으로 연결한다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| 로그인했는데 401 | 만료·다른 JWT_SECRET·잘못된 origin | 서버 설정·쿠키 도메인·만료 확인 |
| 운영에서 쿠키 미전송 | Secure인데 HTTP 접근 | HTTPS 종단과 도메인 설정 |
| 버튼 숨겼는데 수정됨 | UI만 권한 검사 | 트랜잭션 안에서 authorId와 세션 id 비교 |

## ⑥ 직접 해보기

1. 다른 계정의 글을 PATCH해 403을 확인한다.
2. JWT 한 글자를 바꿔 401을 확인한다.
3. 제목에 script 태그 문자열을 넣고 텍스트로 표시되는지 확인한다.

## ⑦ ☐ 체크리스트

- [ ] 인증 (쿠키 / NextAuth 또는 직접 JWT)
- [ ] 비밀번호를 해시하고 JWT의 서명·만료·발급자·대상을 검사한다.
- [ ] API와 Action에서 작성자 검사를 수행한다.
- [ ] CORS·XSS·CSRF의 역할을 설명한다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study8](study8.md)에서 UI·HTTP·도메인·저장소를 분리해 중복을 줄이고 환경 설정을 관리한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
