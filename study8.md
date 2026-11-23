# study8 — 구조화·재사용·환경 분리

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

UI·HTTP·도메인·저장소를 분리해 중복을 줄이고 환경 설정을 관리한다.

## ② 📖 이론

board는 화면, client는 브라우저 HTTP, api는 요청 흐름, domain은 모델·검증, security는 인증, repository는 영속 저장을 맡는다. 역할을 나누면 화면 수정이 저장 방식에 영향을 주지 않는다.

설정은 코드가 아니라 환경에서 주입한다. 개발의 .env.local과 운영 호스트의 비밀 변수는 별개이며 .env.example에는 이름과 안전한 기본값만 기록한다. NEXT_PUBLIC_는 빌드 시 브라우저 값으로 치환될 수 있으므로 서버 비밀을 넣지 않는다.

공구함에 비유하면 파일은 용도별 칸이다. 자주 쓰는 api 함수는 공용 칸에, DB·비밀키는 잠긴 서버 칸에 둔다. JS와 TS는 scripts/sync-course.mjs로 같은 기능을 유지하되 원본은 TS project의 course다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. import 경로를 따라 board → client → API route → api → repository 흐름을 그린다.
2. 공통 오류 처리를 http.failure로 모으고 500 응답에 예외 원문이 없는지 확인한다.
3. .env.example과 배포 변수 목록을 비교한다. 비밀값을 문서나 Git에 쓰지 않는다.
4. course 원본을 수정했다면 루트의 동기화 스크립트로 네 앱을 맞추고 각각 검증한다.

~~~powershell
node scripts/sync-course.mjs
node scripts/configure-course.mjs
node scripts/sync-support.mjs
# 설정 스크립트는 .env.example만 생성하며 .env.local을 덮어쓰지 않는다.
git status --short
~~~

### 이미지·메타데이터와 기존 실습

기존 demo의 /posts/[id]는 generateMetadata로 제목을 만들며 next/image는 크기·대체 텍스트·허용 원격 주소를 명시해 사용한다. API·DB 키를 metadata나 클라이언트 props에 넣지 않는다. 기존 src/features/{auth,notes}의 SQLite 학습 노트는 보존했고, 새 과정의 /board·/workbench는 course 모듈의 v1 서비스를 사용한다.

### tsx_version/demo/course/http.ts

[실행 파일](tsx_version/demo/course/http.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/course/http.ts sha256:3a4c106993b8225781b4c658191a753aba09877d3ec1862df9dc0ee2a6cb88a7 -->
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

### tsx_version/demo/course/client.ts

[실행 파일](tsx_version/demo/course/client.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/course/client.ts sha256:c09b371b068fb3a6eec42074282e5759d7f879aa200ba8cfeff633d8261fba1c -->
~~~ts
"use client";
export type PostView = {
  id: number;
  title: string;
  body: string;
  tags: string[];
  author: { id: number; nickname: string };
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};
export type UserView = { id: number; email: string; nickname: string };
export async function api<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error?.message ?? `요청 실패 ${response.status}`);
  return value as T;
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 이 모듈과 하위 import를 브라우저 상호작용 경계로 선언한다. |
| 2 | 다른 모듈이 공유할 데이터 구조를 선언한다: export type PostView = { |
| 3 | 객체·스키마·속성의 값을 지정한다: id: number; |
| 4 | 객체·스키마·속성의 값을 지정한다: title: string; |
| 5 | 객체·스키마·속성의 값을 지정한다: body: string; |
| 6 | 객체·스키마·속성의 값을 지정한다: tags: string[]; |
| 7 | 객체·스키마·속성의 값을 지정한다: author: { id: number; nickname: string }; |
| 8 | 객체·스키마·속성의 값을 지정한다: commentCount: number; |
| 9 | 객체·스키마·속성의 값을 지정한다: createdAt: string; |
| 10 | 객체·스키마·속성의 값을 지정한다: updatedAt: string; |
| 11 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 12 | 다른 모듈이 공유할 데이터 구조를 선언한다: export type UserView = { id: number; email: string; nickname: string }; |
| 13 | api의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 14 | 객체·스키마·속성의 값을 지정한다: url: string, |
| 15 | 현재 구문에서 다음 값·인자·표현식을 연결한다: method = "GET", |
| 16 | 현재 구문에서 다음 값·인자·표현식을 연결한다: body?: unknown, |
| 17 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ): Promise<T> { |
| 18 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: const response = await fetch(url, { |
| 19 | 현재 구문에서 다음 값·인자·표현식을 연결한다: method, |
| 20 | 객체·스키마·속성의 값을 지정한다: headers: body === undefined ? {} : { "Content-Type": "application/json" }, |
| 21 | 객체·스키마·속성의 값을 지정한다: body: body === undefined ? undefined : JSON.stringify(body), |
| 22 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 23 | 입력·상태 조건에 따라 처리 경로를 고른다: if (response.status === 204) return undefined as T; |
| 24 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const value = await response.json(); |
| 25 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!response.ok) |
| 26 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: throw new Error(value.error?.message ?? ˋ요청 실패 ${response.status}ˋ); |
| 27 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return value as T; |
| 28 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### scripts/sync-course.mjs

[실행 파일](scripts/sync-course.mjs)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:scripts/sync-course.mjs sha256:3555632ca67c884ec877cd2e8133755bc688ef5404ee9a1fb3d36f47f01e13ed -->
~~~ts
// TS 원본의 타입만 제거해 JSX 버전과 demo/project의 학습 기능을 맞춘다.
import fs from 'node:fs';
import path from 'node:path';
import ts from '../tsx_version/project/node_modules/typescript/lib/typescript.js';
const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'tsx_version/project/src/course');
for (const target of ['tsx_version/demo/course', 'jsx_version/demo/course', 'jsx_version/project/src/course']) {
  for (const file of fs.readdirSync(source, { recursive: true }).filter(f => /\.tsx?$/.test(f))) {
    let input = fs.readFileSync(path.join(source, file), 'utf8');
    if (target.includes('/demo/') && file === 'repository.ts') input = `import type { State } from './domain';\nexport type Repository = { read(): Promise<State>; change<T>(fn: (state: State) => T): Promise<T> };\nexport { getSqliteRepository as getRepository } from './sqlite-repository';\n`;
    const js = target.startsWith('jsx');
    const output = js ? ts.transpileModule(input, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve } }).outputText.replace('mcp-server.ts', 'mcp-server.js') : input;
    const destination = path.join(root, target, js ? file.replace(/\.tsx?$/, '.js') : file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, output);
  }
}
console.log('course TS/JS · demo/project 동기화 완료');
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 주석: TS 원본의 타입만 제거해 JSX 버전과 demo/project의 학습 기능을 맞춘다. |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: fs from 'node:fs'; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: path from 'node:path'; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: ts from '../tsx_version/project/node_modules/typescript/lib/typescript.js'; |
| 5 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const root = path.resolve(import.meta.dirname, '..'); |
| 6 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const source = path.join(root, 'tsx_version/project/src/course'); |
| 7 | 배열·반복 요청·스트림을 순서대로 처리하며 종료 조건을 확인한다. |
| 8 | 독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: for (const file of fs.readdirSync(source, { recursive: true }).filter(f => /\.tsx?$/.test(f))) { |
| 9 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let input = fs.readFileSync(path.join(source, file), 'utf8'); |
| 10 | 입력·상태 조건에 따라 처리 경로를 고른다: if (target.includes('/demo/') && file === 'repository.ts') input = ˋimport type { State } from './domain';\nexport type Repository = { read(): Promise<State>; change<T>(fn: (state: State) => T): Promise<T> };\nexport { getSqliteRepository as getRepository } from './sqlite-repository';\nˋ; |
| 11 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const js = target.startsWith('jsx'); |
| 12 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const output = js ? ts.transpileModule(input, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve } }).outputText.replace('mcp-server.ts', 'mcp-server.js') : input; |
| 13 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const destination = path.join(root, target, js ? file.replace(/\.tsx?$/, '.js') : file); |
| 14 | 현재 구문에서 다음 값·인자·표현식을 연결한다: fs.mkdirSync(path.dirname(destination), { recursive: true }); |
| 15 | 현재 구문에서 다음 값·인자·표현식을 연결한다: fs.writeFileSync(destination, output); |
| 16 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 17 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 18 | 현재 구문에서 다음 값·인자·표현식을 연결한다: console.log('course TS/JS · demo/project 동기화 완료'); |

### tsx_version/demo/app/posts/[id]/page.tsx

[실행 파일](tsx_version/demo/app/posts/[id]/page.tsx)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/app/posts/[id]/page.tsx sha256:d2ea4d588a70ae5ff9114bb8d2acc99dd721767c09db2fa4d7bb2b65f7d20ae9 -->
~~~tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeletePostButton } from "@/app/ui/delete-post-button";
import { getPost } from "@/lib/posts-store";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return { title: "글을 찾을 수 없음" };
  }
  return {
    title: post.title,
    description: post.body.slice(0, 80),
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    notFound();
  }

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        study5 · /posts/{id}
      </p>
      <h1 className="text-2xl font-bold tracking-tight">{post.title}</h1>
      {post.authorName ? (
        <p className="text-sm text-stone-500">작성자 {post.authorName}</p>
      ) : null}
      <p className="leading-7 whitespace-pre-wrap text-stone-600">{post.body}</p>
      <div className="flex gap-4">
        <Link href={`/posts/${post.id}/edit`} className="text-sm text-accent underline">
          수정
        </Link>
        <DeletePostButton id={post.id} />
      </div>
    </article>
  );
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: type { Metadata } from "next"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: Link from "next/link"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { notFound } from "next/navigation"; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: { DeletePostButton } from "@/app/ui/delete-post-button"; |
| 5 | 외부 모듈 또는 공용 함수·타입을 가져온다: { getPost } from "@/lib/posts-store"; |
| 7 | generateMetadata의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: params, |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }: { |
| 10 | 객체·스키마·속성의 값을 지정한다: params: Promise<{ id: string }>; |
| 11 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }): Promise<Metadata> { |
| 12 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const { id } = await params; |
| 13 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const post = await getPost(id); |
| 14 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!post) { |
| 15 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return { title: "글을 찾을 수 없음" }; |
| 16 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 17 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return { |
| 18 | 객체·스키마·속성의 값을 지정한다: title: post.title, |
| 19 | 객체·스키마·속성의 값을 지정한다: description: post.body.slice(0, 80), |
| 20 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 21 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 23 | 현재 구문에서 다음 값·인자·표현식을 연결한다: export default async function PostPage({ |
| 24 | 현재 구문에서 다음 값·인자·표현식을 연결한다: params, |
| 25 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }: { |
| 26 | 객체·스키마·속성의 값을 지정한다: params: Promise<{ id: string }>; |
| 27 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }) { |
| 28 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const { id } = await params; |
| 29 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const post = await getPost(id); |
| 30 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!post) { |
| 31 | 현재 구문에서 다음 값·인자·표현식을 연결한다: notFound(); |
| 32 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 34 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return ( |
| 35 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <article className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm"> |
| 36 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p className="text-xs font-semibold uppercase tracking-widest text-accent"> |
| 37 | 현재 구문에서 다음 값·인자·표현식을 연결한다: study5 · /posts/{id} |
| 38 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </p> |
| 39 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <h1 className="text-2xl font-bold tracking-tight">{post.title}</h1> |
| 40 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: {post.authorName ? ( |
| 41 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p className="text-sm text-stone-500">작성자 {post.authorName}</p> |
| 42 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ) : null} |
| 43 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p className="leading-7 whitespace-pre-wrap text-stone-600">{post.body}</p> |
| 44 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <div className="flex gap-4"> |
| 45 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <Link href={ˋ/posts/${post.id}/editˋ} className="text-sm text-accent underline"> |
| 46 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 수정 |
| 47 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </Link> |
| 48 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <DeletePostButton id={post.id} /> |
| 49 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </div> |
| 50 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </article> |
| 51 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 52 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

## ④ 🔗 연동 포인트

재사용 경계인 Repository는 study11의 DB 교체 지점이다. 공통 error와 requestId는 study9 테스트와 study16 운영 로그의 연결 키다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| 서버 비밀이 번들에 노출 | NEXT_PUBLIC_에 비밀 저장 | 접두사 제거·키 회전·서버 모듈 이동 |
| JS/TS 동작 불일치 | 생성본만 직접 수정 | TS 원본 수정 후 동기화 |
| 운영 env가 안 바뀜 | 빌드 변수와 런타임 변수 혼동 | 서버 변수는 프로세스 재시작, 공개 빌드 변수는 재빌드 |

## ⑥ 직접 해보기

1. 검증 함수를 하나 추가하고 API에서 재사용한다.
2. 개발·운영 변수 이름과 공급 위치를 표로 작성한다.
3. JS 생성 파일에서 타입만 제거됐는지 확인한다.

## ⑦ ☐ 체크리스트

- [ ] UI·도메인·HTTP·저장소 경계를 나눴다.
- [ ] 개발·운영의 설정 공급 위치를 구분한다.
- [ ] 공통 함수를 사용해 중복을 줄였다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study9](study9.md)에서 단위·요청·실서버 테스트로 API 계약과 보안 회귀를 검증한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
