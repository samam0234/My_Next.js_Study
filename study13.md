# study13 — 결제·메일·파일·OAuth 외부 서비스

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

서버 전용 키로 외부 서비스를 호출하고 콜백·업로드 경계를 검증한다.

## ② 📖 이론

외부 서비스 호출은 서버 Route Handler에서 수행한다. 키는 .env.local에 두고 fetch에 timeout을 적용한다. 메일의 수신자는 로그인 사용자의 이메일로 제한하고 중복 요청에는 Idempotency-Key를 전달한다.

Stripe는 테스트 키만 허용한다. 가격은 서버 STRIPE_PRICE_ID로 고정한다. success URL 복귀는 결제 증명이 아니다. 원문 웹훅의 HMAC·시간을 검증하고 이벤트 id를 영속 저장해 중복을 제거한다. 실제 유료 권한 부여는 주문 소유자·가격·통화·paid 상태를 확인하는 후속 기능이다.

GitHub OAuth는 state·PKCE로 요청과 콜백을 연결하고 공급자의 불변 id로 계정을 찾는다. 이메일이 같다는 이유로 기존 계정과 자동 연결하지 않는다. 업로드는 UTF-8 txt/md의 제한된 JSON 계약이며 서버 경로에 원본 파일명을 붙이지 않는다.

외부 서비스는 협력 업체다. 문을 열어 둘 수 없으므로 누가 요청했는지, 누가 콜백을 보냈는지, 같은 요청을 두 번 처리했는지를 각각 확인한다. 계정 키 없는 현재 검증은 HTTP mock이며 실제 결제·메일·OAuth 완료로 표시하지 않는다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. Resend에서 발신 도메인을 검증하고 RESEND_API_KEY·MAIL_FROM을 설정한다. 임의 주소로 발송하지 말고 내 계정 이메일로 확인한다.
2. Stripe 테스트 가격을 만들고 sk_test_ 키와 price id를 설정한다. 테스트 세션을 만든 뒤 테스트 카드로만 확인한다.
3. 웹훅 endpoint /api/payments/webhook와 secret을 등록한다. 원문 서명·재전송 중복 제거를 확인한다.
4. GitHub OAuth 앱 callback을 APP_ORIGIN/api/oauth/callback과 정확히 맞추고 client id/secret을 설정한다. 로그인 후 course_session을 확인한다.
5. /workbench에서 20KB 이하 txt/md 파일을 불러오고 /api/files의 소유자 필터와 확장자 거절을 확인한다.

~~~powershell
cd tsx_version/project
npm test
# .env.local에 RESEND_API_KEY / MAIL_FROM 설정
# STRIPE_SECRET_KEY=sk_test_... / STRIPE_PRICE_ID / STRIPE_WEBHOOK_SECRET 설정
# GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / APP_ORIGIN 설정 후 재시작
npm run dev
~~~

### 실제 서비스 승인 기준

- [ ] 검증된 도메인에서 내 계정으로 메일이 도착했다.
- [ ] Stripe 테스트 세션과 서명 웹훅을 실제 수신했다.
- [ ] 동일 이벤트 재전송이 한 번만 반영된다.
- [ ] OAuth state 불일치가 거절되고 정상 콜백이 로그인된다.
- [ ] 타인 문서 id를 넣으면 404다.

이 체크는 계정 설정 뒤 학습자가 수행할 항목이다. 텍스트 업로드는 JSON {name,text}이며 multipart·PDF/OCR·바이너리 이미지 업로드는 구현했다고 주장하지 않는다. 메일·결제·OAuth 코드는 공식 HTTP API 기준이며 현재 테스트는 mock으로 전송 형식을 확인한다.

### tsx_version/project/src/course/services.ts

[실행 파일](tsx_version/project/src/course/services.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/src/course/services.ts sha256:8a62bf611c1ae02a93aa67c8507fd05e5a892ed92dc94f255b4c2d4679d64fa7 -->
~~~ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "./domain";
import { getRepository } from "./repository";
import { reply } from "./http";
export async function sendMail(to: string, text: string, key: string) {
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
    throw new ApiError(
      503,
      "CONFIG_REQUIRED",
      "메일 키와 검증된 발신 주소가 필요합니다.",
    );
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [to],
      subject: "학습 문서",
      text,
    }),
  });
  if (!response.ok)
    throw new ApiError(502, "UPSTREAM_ERROR", "메일 발송에 실패했습니다.");
  return response.json();
}
export async function checkout(ownerId: number, key: string) {
  if (
    !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ||
    !process.env.STRIPE_PRICE_ID ||
    !process.env.APP_ORIGIN
  )
    throw new ApiError(
      503,
      "CONFIG_REQUIRED",
      "Stripe 테스트 키, 가격, APP_ORIGIN이 필요합니다.",
    );
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": process.env.STRIPE_PRICE_ID,
    "line_items[0][quantity]": "1",
    client_reference_id: String(ownerId),
    success_url: `${process.env.APP_ORIGIN}/board?payment=returned`,
    cancel_url: `${process.env.APP_ORIGIN}/board?payment=cancelled`,
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `user-${ownerId}-${key}`,
    },
    body: form,
  });
  if (!response.ok)
    throw new ApiError(502, "UPSTREAM_ERROR", "결제 세션 생성에 실패했습니다.");
  const session = await response.json();
  return { id: session.id, url: session.url };
}
export async function webhook(request: Request) {
  if (request.method !== "POST")
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "POST만 지원합니다.");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    throw new ApiError(503, "CONFIG_REQUIRED", "웹훅 비밀키가 필요합니다.");
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 64_000)
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "웹훅 크기 초과");
  const parts = request.headers.get("stripe-signature")?.split(",") ?? [];
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  )
    throw new ApiError(400, "BAD_REQUEST", "웹훅 시각이 유효하지 않습니다.");
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${raw}`)
    .digest();
  if (
    !signatures.some(
      (s) =>
        /^[a-f0-9]{64}$/i.test(s) &&
        timingSafeEqual(expected, Buffer.from(s, "hex")),
    )
  )
    throw new ApiError(400, "BAD_REQUEST", "웹훅 서명이 유효하지 않습니다.");
  let event: {
    id: string;
    type: string;
    data?: { object?: { payment_status?: string } };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "웹훅 JSON 오류");
  }
  if (typeof event.id !== "string" || typeof event.type !== "string")
    throw new ApiError(400, "BAD_REQUEST", "웹훅 이벤트 오류");
  const duplicate = await (
    await getRepository()
  ).change((state) => {
    if (state.webhookIds.includes(event.id)) return true;
    state.webhookIds.push(event.id);
    return false;
  });
  // 수신·중복 제거까지만 구현. 유료 권한을 추가할 때 paid 상태와 주문 소유자를 트랜잭션으로 확인한다.
  return reply({ data: { received: true, duplicate } });
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { createHmac, timingSafeEqual } from "node:crypto"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { ApiError } from "./domain"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { getRepository } from "./repository"; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: { reply } from "./http"; |
| 5 | sendMail의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 6 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!process.env.RESEND_API_KEY \|\| !process.env.MAIL_FROM) |
| 7 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 503, |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "CONFIG_REQUIRED", |
| 10 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "메일 키와 검증된 발신 주소가 필요합니다.", |
| 11 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 12 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: const response = await fetch("https://api.resend.com/emails", { |
| 13 | 객체·스키마·속성의 값을 지정한다: method: "POST", |
| 14 | 외부 호출 시간 제한 또는 사용자 취소 신호를 준비한다. |
| 15 | 객체·스키마·속성의 값을 지정한다: headers: { |
| 16 | 객체·스키마·속성의 값을 지정한다: Authorization: ˋBearer ${process.env.RESEND_API_KEY}ˋ, |
| 17 | 객체·스키마·속성의 값을 지정한다: "Content-Type": "application/json", |
| 18 | 객체·스키마·속성의 값을 지정한다: "Idempotency-Key": key, |
| 19 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 20 | 객체·스키마·속성의 값을 지정한다: body: JSON.stringify({ |
| 21 | 객체·스키마·속성의 값을 지정한다: from: process.env.MAIL_FROM, |
| 22 | 객체·스키마·속성의 값을 지정한다: to: [to], |
| 23 | 객체·스키마·속성의 값을 지정한다: subject: "학습 문서", |
| 24 | 현재 구문에서 다음 값·인자·표현식을 연결한다: text, |
| 25 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 26 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 27 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!response.ok) |
| 28 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(502, "UPSTREAM_ERROR", "메일 발송에 실패했습니다."); |
| 29 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return response.json(); |
| 30 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 31 | checkout의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 32 | 입력·상태 조건에 따라 처리 경로를 고른다: if ( |
| 33 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") \|\| |
| 34 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: !process.env.STRIPE_PRICE_ID \|\| |
| 35 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: !process.env.APP_ORIGIN |
| 36 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 37 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 38 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 503, |
| 39 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "CONFIG_REQUIRED", |
| 40 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "Stripe 테스트 키, 가격, APP_ORIGIN이 필요합니다.", |
| 41 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 42 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const form = new URLSearchParams({ |
| 43 | 객체·스키마·속성의 값을 지정한다: mode: "payment", |
| 44 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: "line_items[0][price]": process.env.STRIPE_PRICE_ID, |
| 45 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "line_items[0][quantity]": "1", |
| 46 | 객체·스키마·속성의 값을 지정한다: client_reference_id: String(ownerId), |
| 47 | 객체·스키마·속성의 값을 지정한다: success_url: ˋ${process.env.APP_ORIGIN}/board?payment=returnedˋ, |
| 48 | 객체·스키마·속성의 값을 지정한다: cancel_url: ˋ${process.env.APP_ORIGIN}/board?payment=cancelledˋ, |
| 49 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 50 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { |
| 51 | 객체·스키마·속성의 값을 지정한다: method: "POST", |
| 52 | 외부 호출 시간 제한 또는 사용자 취소 신호를 준비한다. |
| 53 | 객체·스키마·속성의 값을 지정한다: headers: { |
| 54 | 객체·스키마·속성의 값을 지정한다: Authorization: ˋBearer ${process.env.STRIPE_SECRET_KEY}ˋ, |
| 55 | 객체·스키마·속성의 값을 지정한다: "Content-Type": "application/x-www-form-urlencoded", |
| 56 | 객체·스키마·속성의 값을 지정한다: "Idempotency-Key": ˋuser-${ownerId}-${key}ˋ, |
| 57 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 58 | 객체·스키마·속성의 값을 지정한다: body: form, |
| 59 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 60 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!response.ok) |
| 61 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(502, "UPSTREAM_ERROR", "결제 세션 생성에 실패했습니다."); |
| 62 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const session = await response.json(); |
| 63 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return { id: session.id, url: session.url }; |
| 64 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 65 | webhook의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 66 | 입력·상태 조건에 따라 처리 경로를 고른다: if (request.method !== "POST") |
| 67 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(405, "METHOD_NOT_ALLOWED", "POST만 지원합니다."); |
| 68 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const secret = process.env.STRIPE_WEBHOOK_SECRET; |
| 69 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!secret) |
| 70 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(503, "CONFIG_REQUIRED", "웹훅 비밀키가 필요합니다."); |
| 71 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const raw = await request.text(); |
| 72 | 입력·상태 조건에 따라 처리 경로를 고른다: if (Buffer.byteLength(raw) > 64_000) |
| 73 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(413, "PAYLOAD_TOO_LARGE", "웹훅 크기 초과"); |
| 74 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const parts = request.headers.get("stripe-signature")?.split(",") ?? []; |
| 75 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2); |
| 76 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const signatures = parts |
| 77 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .filter((p) => p.startsWith("v1=")) |
| 78 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .map((p) => p.slice(3)); |
| 79 | 입력·상태 조건에 따라 처리 경로를 고른다: if ( |
| 80 | 현재 구문에서 다음 값·인자·표현식을 연결한다: !timestamp \|\| |
| 81 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: !/^\d+$/.test(timestamp) \|\| |
| 82 | 현재 구문에서 다음 값·인자·표현식을 연결한다: Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 |
| 83 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 84 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(400, "BAD_REQUEST", "웹훅 시각이 유효하지 않습니다."); |
| 85 | 웹훅 원문의 HMAC 서명을 계산하거나 일정 시간 비교로 검증한다. |
| 86 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .update(ˋ${timestamp}.${raw}ˋ) |
| 87 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .digest(); |
| 88 | 입력·상태 조건에 따라 처리 경로를 고른다: if ( |
| 89 | 현재 구문에서 다음 값·인자·표현식을 연결한다: !signatures.some( |
| 90 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (s) => |
| 91 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: /^[a-f0-9]{64}$/i.test(s) && |
| 92 | 웹훅 원문의 HMAC 서명을 계산하거나 일정 시간 비교로 검증한다. |
| 93 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 94 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 95 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(400, "BAD_REQUEST", "웹훅 서명이 유효하지 않습니다."); |
| 96 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let event: { |
| 97 | 객체·스키마·속성의 값을 지정한다: id: string; |
| 98 | 객체·스키마·속성의 값을 지정한다: type: string; |
| 99 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data?: { object?: { payment_status?: string } }; |
| 100 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 101 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 102 | 현재 구문에서 다음 값·인자·표현식을 연결한다: event = JSON.parse(raw); |
| 103 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 104 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(400, "BAD_REQUEST", "웹훅 JSON 오류"); |
| 105 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 106 | 입력·상태 조건에 따라 처리 경로를 고른다: if (typeof event.id !== "string" \|\| typeof event.type !== "string") |
| 107 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(400, "BAD_REQUEST", "웹훅 이벤트 오류"); |
| 108 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const duplicate = await ( |
| 109 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await getRepository() |
| 110 | Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다. |
| 111 | 입력·상태 조건에 따라 처리 경로를 고른다: if (state.webhookIds.includes(event.id)) return true; |
| 112 | 현재 구문에서 다음 값·인자·표현식을 연결한다: state.webhookIds.push(event.id); |
| 113 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return false; |
| 114 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 115 | 주석: 수신·중복 제거까지만 구현. 유료 권한을 추가할 때 paid 상태와 주문 소유자를 트랜잭션으로 확인한다. |
| 116 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return reply({ data: { received: true, duplicate } }); |
| 117 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/project/src/course/oauth.ts

[실행 파일](tsx_version/project/src/course/oauth.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/src/course/oauth.ts sha256:5128f0c0801edd282383bc0fc5fc4754bf940212706a1a82b5610fbb7ae0853e -->
~~~ts
import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "./domain";
import { getRepository } from "./repository";
import { issueToken, sessionCookie } from "./security";
export async function oauth(request: Request) {
  if (request.method !== "GET")
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "GET만 지원합니다.");
  const clientId = process.env.GITHUB_CLIENT_ID,
    clientSecret = process.env.GITHUB_CLIENT_SECRET,
    origin = process.env.APP_ORIGIN;
  if (!clientId || !clientSecret || !origin)
    throw new ApiError(
      503,
      "CONFIG_REQUIRED",
      "GitHub OAuth 설정이 필요합니다.",
    );
  const url = new URL(request.url),
    callback = `${origin}/api/oauth/callback`;
  const options = `Path=/api/oauth; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  if (url.pathname.endsWith("/start")) {
    const state = randomBytes(32).toString("hex"),
      verifier = randomBytes(32).toString("base64url");
    const target = new URL("https://github.com/login/oauth/authorize");
    target.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callback,
      state,
      scope: "read:user",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    const headers = new Headers({ Location: target.href });
    headers.append("Set-Cookie", `course_oauth_state=${state}; ${options}`);
    headers.append(
      "Set-Cookie",
      `course_oauth_verifier=${verifier}; ${options}`,
    );
    return new Response(null, { status: 302, headers });
  }
  const cookies = Object.fromEntries(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((p) => p.trim().split("=")),
  );
  if (
    !url.searchParams.get("code") ||
    !cookies.course_oauth_state ||
    cookies.course_oauth_state !== url.searchParams.get("state") ||
    !cookies.course_oauth_verifier
  )
    throw new ApiError(
      400,
      "BAD_REQUEST",
      "OAuth state 또는 code가 유효하지 않습니다.",
    );
  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: url.searchParams.get("code"),
        redirect_uri: callback,
        code_verifier: cookies.course_oauth_verifier,
      }),
    },
  );
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.access_token)
    throw new ApiError(
      502,
      "UPSTREAM_ERROR",
      "OAuth 토큰 교환에 실패했습니다.",
    );
  const profileResponse = await fetch("https://api.github.com/user", {
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      Accept: "application/vnd.github+json",
    },
  });
  const profile = await profileResponse.json();
  if (!profileResponse.ok || !Number.isInteger(profile.id))
    throw new ApiError(
      502,
      "UPSTREAM_ERROR",
      "OAuth 사용자 확인에 실패했습니다.",
    );
  const user = await (
    await getRepository()
  ).change((state) => {
    const existing = state.users.find((u) => u.githubId === profile.id);
    if (existing) return existing;
    // 이메일로 기존 계정과 자동 연결하지 않는다. 공급자의 불변 id로 식별한다.
    const created = {
      id: ++state.seq,
      githubId: profile.id as number,
      email: `github-${profile.id}@oauth.invalid`,
      nickname: String(profile.login).slice(0, 40),
      passwordHash: "oauth-only",
    };
    state.users.push(created);
    return created;
  });
  const headers = new Headers({ Location: `${origin}/board` });
  headers.append("Set-Cookie", sessionCookie(issueToken(user.id)));
  headers.append(
    "Set-Cookie",
    `course_oauth_state=; ${options.replace("Max-Age=600", "Max-Age=0")}`,
  );
  headers.append(
    "Set-Cookie",
    `course_oauth_verifier=; ${options.replace("Max-Age=600", "Max-Age=0")}`,
  );
  return new Response(null, { status: 302, headers });
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { createHash, randomBytes } from "node:crypto"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { ApiError } from "./domain"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { getRepository } from "./repository"; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: { issueToken, sessionCookie } from "./security"; |
| 5 | oauth의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 6 | 입력·상태 조건에 따라 처리 경로를 고른다: if (request.method !== "GET") |
| 7 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError(405, "METHOD_NOT_ALLOWED", "GET만 지원합니다."); |
| 8 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const clientId = process.env.GITHUB_CLIENT_ID, |
| 9 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: clientSecret = process.env.GITHUB_CLIENT_SECRET, |
| 10 | 실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: origin = process.env.APP_ORIGIN; |
| 11 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!clientId \|\| !clientSecret \|\| !origin) |
| 12 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 13 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 503, |
| 14 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "CONFIG_REQUIRED", |
| 15 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "GitHub OAuth 설정이 필요합니다.", |
| 16 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 17 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const url = new URL(request.url), |
| 18 | 현재 구문에서 다음 값·인자·표현식을 연결한다: callback = ˋ${origin}/api/oauth/callbackˋ; |
| 19 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const options = ˋPath=/api/oauth; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}ˋ; |
| 20 | 입력·상태 조건에 따라 처리 경로를 고른다: if (url.pathname.endsWith("/start")) { |
| 21 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const state = randomBytes(32).toString("hex"), |
| 22 | 현재 구문에서 다음 값·인자·표현식을 연결한다: verifier = randomBytes(32).toString("base64url"); |
| 23 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const target = new URL("https://github.com/login/oauth/authorize"); |
| 24 | 현재 구문에서 다음 값·인자·표현식을 연결한다: target.search = new URLSearchParams({ |
| 25 | 객체·스키마·속성의 값을 지정한다: client_id: clientId, |
| 26 | 객체·스키마·속성의 값을 지정한다: redirect_uri: callback, |
| 27 | 현재 구문에서 다음 값·인자·표현식을 연결한다: state, |
| 28 | 객체·스키마·속성의 값을 지정한다: scope: "read:user", |
| 29 | 객체·스키마·속성의 값을 지정한다: code_challenge: createHash("sha256").update(verifier).digest("base64url"), |
| 30 | 객체·스키마·속성의 값을 지정한다: code_challenge_method: "S256", |
| 31 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }).toString(); |
| 32 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const headers = new Headers({ Location: target.href }); |
| 33 | 현재 구문에서 다음 값·인자·표현식을 연결한다: headers.append("Set-Cookie", ˋcourse_oauth_state=${state}; ${options}ˋ); |
| 34 | 현재 구문에서 다음 값·인자·표현식을 연결한다: headers.append( |
| 35 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "Set-Cookie", |
| 36 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ˋcourse_oauth_verifier=${verifier}; ${options}ˋ, |
| 37 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 38 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return new Response(null, { status: 302, headers }); |
| 39 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 40 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const cookies = Object.fromEntries( |
| 41 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (request.headers.get("cookie") ?? "") |
| 42 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .split(";") |
| 43 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .map((p) => p.trim().split("=")), |
| 44 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 45 | 입력·상태 조건에 따라 처리 경로를 고른다: if ( |
| 46 | 현재 구문에서 다음 값·인자·표현식을 연결한다: !url.searchParams.get("code") \|\| |
| 47 | 현재 구문에서 다음 값·인자·표현식을 연결한다: !cookies.course_oauth_state \|\| |
| 48 | 현재 구문에서 다음 값·인자·표현식을 연결한다: cookies.course_oauth_state !== url.searchParams.get("state") \|\| |
| 49 | 현재 구문에서 다음 값·인자·표현식을 연결한다: !cookies.course_oauth_verifier |
| 50 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 51 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 52 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 400, |
| 53 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "BAD_REQUEST", |
| 54 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "OAuth state 또는 code가 유효하지 않습니다.", |
| 55 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 56 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: const tokenResponse = await fetch( |
| 57 | 객체·스키마·속성의 값을 지정한다: "https://github.com/login/oauth/access_token", |
| 58 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 59 | 객체·스키마·속성의 값을 지정한다: method: "POST", |
| 60 | 외부 호출 시간 제한 또는 사용자 취소 신호를 준비한다. |
| 61 | 객체·스키마·속성의 값을 지정한다: headers: { |
| 62 | 객체·스키마·속성의 값을 지정한다: Accept: "application/json", |
| 63 | 객체·스키마·속성의 값을 지정한다: "Content-Type": "application/json", |
| 64 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 65 | 객체·스키마·속성의 값을 지정한다: body: JSON.stringify({ |
| 66 | 객체·스키마·속성의 값을 지정한다: client_id: clientId, |
| 67 | 객체·스키마·속성의 값을 지정한다: client_secret: clientSecret, |
| 68 | 객체·스키마·속성의 값을 지정한다: code: url.searchParams.get("code"), |
| 69 | 객체·스키마·속성의 값을 지정한다: redirect_uri: callback, |
| 70 | 객체·스키마·속성의 값을 지정한다: code_verifier: cookies.course_oauth_verifier, |
| 71 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 72 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 73 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 74 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const token = await tokenResponse.json(); |
| 75 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!tokenResponse.ok \|\| !token.access_token) |
| 76 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 77 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 502, |
| 78 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "UPSTREAM_ERROR", |
| 79 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "OAuth 토큰 교환에 실패했습니다.", |
| 80 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 81 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: const profileResponse = await fetch("https://api.github.com/user", { |
| 82 | 외부 호출 시간 제한 또는 사용자 취소 신호를 준비한다. |
| 83 | 객체·스키마·속성의 값을 지정한다: headers: { |
| 84 | 객체·스키마·속성의 값을 지정한다: Authorization: ˋBearer ${token.access_token}ˋ, |
| 85 | 객체·스키마·속성의 값을 지정한다: Accept: "application/vnd.github+json", |
| 86 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 87 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 88 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const profile = await profileResponse.json(); |
| 89 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!profileResponse.ok \|\| !Number.isInteger(profile.id)) |
| 90 | 요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: throw new ApiError( |
| 91 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 502, |
| 92 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "UPSTREAM_ERROR", |
| 93 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "OAuth 사용자 확인에 실패했습니다.", |
| 94 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 95 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const user = await ( |
| 96 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await getRepository() |
| 97 | Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다. |
| 98 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const existing = state.users.find((u) => u.githubId === profile.id); |
| 99 | 입력·상태 조건에 따라 처리 경로를 고른다: if (existing) return existing; |
| 100 | 주석: 이메일로 기존 계정과 자동 연결하지 않는다. 공급자의 불변 id로 식별한다. |
| 101 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const created = { |
| 102 | 객체·스키마·속성의 값을 지정한다: id: ++state.seq, |
| 103 | 객체·스키마·속성의 값을 지정한다: githubId: profile.id as number, |
| 104 | 객체·스키마·속성의 값을 지정한다: email: ˋgithub-${profile.id}@oauth.invalidˋ, |
| 105 | 객체·스키마·속성의 값을 지정한다: nickname: String(profile.login).slice(0, 40), |
| 106 | 객체·스키마·속성의 값을 지정한다: passwordHash: "oauth-only", |
| 107 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 108 | 현재 구문에서 다음 값·인자·표현식을 연결한다: state.users.push(created); |
| 109 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return created; |
| 110 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 111 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const headers = new Headers({ Location: ˋ${origin}/boardˋ }); |
| 112 | 현재 구문에서 다음 값·인자·표현식을 연결한다: headers.append("Set-Cookie", sessionCookie(issueToken(user.id))); |
| 113 | 현재 구문에서 다음 값·인자·표현식을 연결한다: headers.append( |
| 114 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "Set-Cookie", |
| 115 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ˋcourse_oauth_state=; ${options.replace("Max-Age=600", "Max-Age=0")}ˋ, |
| 116 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 117 | 현재 구문에서 다음 값·인자·표현식을 연결한다: headers.append( |
| 118 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "Set-Cookie", |
| 119 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ˋcourse_oauth_verifier=; ${options.replace("Max-Age=600", "Max-Age=0")}ˋ, |
| 120 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 121 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return new Response(null, { status: 302, headers }); |
| 122 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

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

### tsx_version/project/src/course/entry.ts

[실행 파일](tsx_version/project/src/course/entry.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/src/course/entry.ts sha256:9d7502a47312acf80b2d7a9fd382871026b863d72f73c04de0bb0f34b7fbb016 -->
~~~ts
import { handle } from "./api";
import { protectOrigin } from "./security";
// 심화 기능은 project에서만 HTTP에 연결한다. demo의 게시판은 기초 과정만으로 실행된다.
export async function route(request: Request) {
  return handle(request, async (request) => {
    const pathname = new URL(request.url).pathname.replace(
      /^\/api\/v1\//,
      "/api/",
    );
    if (pathname.startsWith("/api/oauth/")) {
      const { oauth } = await import("./oauth");
      return oauth(request);
    }
    if (pathname === "/api/payments/webhook") {
      const { webhook } = await import("./services");
      return webhook(request);
    }
    if (/^\/api\/(ai|files|events|jobs|mail|payments)(\/|$)/.test(pathname)) {
      protectOrigin(request);
      const { advanced } = await import("./advanced");
      return advanced(request);
    }
    return null;
  });
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { handle } from "./api"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { protectOrigin } from "./security"; |
| 3 | 주석: 심화 기능은 project에서만 HTTP에 연결한다. demo의 게시판은 기초 과정만으로 실행된다. |
| 4 | route의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 5 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return handle(request, async (request) => { |
| 6 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const pathname = new URL(request.url).pathname.replace( |
| 7 | 현재 구문에서 다음 값·인자·표현식을 연결한다: /^\/api\/v1\//, |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/", |
| 9 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 10 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname.startsWith("/api/oauth/")) { |
| 11 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const { oauth } = await import("./oauth"); |
| 12 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return oauth(request); |
| 13 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 14 | 입력·상태 조건에 따라 처리 경로를 고른다: if (pathname === "/api/payments/webhook") { |
| 15 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const { webhook } = await import("./services"); |
| 16 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return webhook(request); |
| 17 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 18 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: if (/^\/api\/(ai\|files\|events\|jobs\|mail\|payments)(\/\|$)/.test(pathname)) { |
| 19 | 쿠키 쓰기 요청의 출처를 확인해 CSRF 경계를 적용한다. |
| 20 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const { advanced } = await import("./advanced"); |
| 21 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return advanced(request); |
| 22 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 23 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return null; |
| 24 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 25 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

## ④ 🔗 연동 포인트

외부 호출 결과는 공통 API 응답으로 감싸고 서버 비밀은 전달하지 않는다. 문서 업로드 결과 id는 study18의 fileId 요약 입력으로 이어진다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| 메일 502 | 발신 도메인·키·수신 정책 | 공급자 이벤트와 검증 상태 확인 |
| 웹훅 400 | 본문 재직렬화·서명·시각 오류 | request.text 원문과 5분 허용 범위 확인 |
| OAuth state 실패 | 쿠키·callback URL·Origin 불일치 | 동일 도메인·PKCE·callback 설정 확인 |

## ⑥ 직접 해보기

1. 위조 웹훅 서명과 오래된 timestamp를 각각 거절한다.
2. 같은 Idempotency-Key로 메일 요청을 재전송한다.
3. 다른 계정으로 문서 요약을 요청해 접근 차단을 확인한다.

## ⑦ ☐ 체크리스트

- [ ] 결제·메일·파일 업로드·OAuth 연결 코드와 환경변수를 준비했다.
- [ ] 콜백 검증·멱등성·소유권 검사를 설명한다.
- [ ] 실제 외부 계정 검증과 mock 검증을 구분해 기록한다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study14](study14.md)에서 v1 계약을 문서화하고 경로·페이지네이션·오류 응답을 일관되게 유지한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
