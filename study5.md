# study5 — 폼·검증·중복 제출 방지

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

폼 값을 JSON으로 보내고 성공·검증·통신 실패를 화면에 표시한다.

## ② 📖 이론

브라우저의 required, type=email, minLength는 빠른 피드백을 준다. 실제 신뢰 경계는 서버이므로 같은 제약을 API에서도 검사한다. HTTP 요청은 개발자도구나 직접 작성한 클라이언트로 우회할 수 있다.

Board의 perform은 ref로 즉시 중복 제출을 막고 pending 상태로 버튼을 비활성화한다. finally는 성공·실패 모두에서 잠금을 푼다. 이것은 같은 브라우저의 클릭 중복 방지이며 서버의 멱등성 보장은 아니다.

폼은 택배 접수표다. 브라우저는 빈칸을 알려 주고 서버는 접수 가능한 규격인지 다시 검사한다. 200은 성공, 400은 공통 스펙의 검증 오류다. 외부 API가 422를 쓰더라도 클라이언트는 response.ok가 false인 경로에서 메시지를 표시한다. 이 앱의 검증 오류는 v1 규칙에 따라 400으로 통일한다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. /board에서 가입으로 전환하고 이메일·8자 이상 비밀번호·별명을 입력한다.
2. 빈 제목 또는 공백 본문을 직접 API로 보내 서버 검증과 fields를 확인한다.
3. Network의 느린 연결 모드에서 저장 버튼을 연속 클릭해 pending을 관찰한다.
4. 서버를 끊고 제출해 오류 메시지와 다시 활성화된 버튼을 확인한다. 성공 후 목록·상세를 다시 읽는 이유를 설명한다.

~~~powershell
cd tsx_version/demo
npm run dev
# /board에서 가입 → 로그인 → 새 글 등록 → Network의 Request Payload/Status/Response 확인
~~~



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

### tsx_version/demo/course/board.tsx

[실행 파일](tsx_version/demo/course/board.tsx)

로그인·목록·선택 글·댓글·pending을 브라우저 상태로 관리한다. 폼에서 값을 읽고 api를 호출한 뒤 최신 목록과 상세를 다시 읽는다.

<!-- source:tsx_version/demo/course/board.tsx sha256:f1d6569c38ff3f516d4c5fd861737a255b727830ea88540389df398ba6893fba -->
~~~tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { api, type PostView, type UserView } from "./client";
import { Draft } from "./draft";
type Listing = {
  data: PostView[];
  meta: { page: number; totalPages: number; total: number };
};
type CommentView = { id: number; body: string; author: UserView };
export function Board({ advanced = false }: { advanced?: boolean }) {
  const [user, setUser] = useState<UserView | null>(null),
    [listing, setListing] = useState<Listing>({
      data: [],
      meta: { page: 1, totalPages: 0, total: 0 },
    });
  const [selected, setSelected] = useState<PostView | null>(null),
    [comments, setComments] = useState<CommentView[]>([]);
  const [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    [q, setQ] = useState("");
  const busy = useRef(false),
    [signup, setSignup] = useState(false);
  async function load(page = 1, query = q) {
    setListing(
      await api<Listing>(
        `/api/posts?page=${page}&q=${encodeURIComponent(query)}`,
      ),
    );
  }
  useEffect(() => {
    let active = true;
    api<Listing>("/api/posts")
      .then((value) => {
        if (active) setListing(value);
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    api<{ data: UserView }>("/api/auth/me")
      .then((value) => {
        if (active) setUser(value.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function perform(fn: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      await fn();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "요청 실패");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function auth(form: FormData) {
    const body = Object.fromEntries(form);
    if (signup) await api("/api/auth/signup", "POST", body);
    const result = await api<{ data: { user: UserView } }>(
      "/api/auth/login",
      "POST",
      { email: body.email, password: body.password },
    );
    setUser(result.data.user);
    setMessage("로그인했습니다.");
  }
  async function select(post: PostView) {
    const [detail, comments] = await Promise.all([
      api<{ data: PostView }>(`/api/posts/${post.id}`),
      api<{ data: CommentView[] }>(`/api/posts/${post.id}/comments`),
    ]);
    setSelected(detail.data);
    setComments(comments.data);
  }
  return (
    <section className="course">
      <h1>Next.js 학습 게시판</h1>
      <p>
        <a href="/api-docs">API 문서</a>
        {advanced && (
          <>
            {" "}
            · <a href="/workbench">문서·AI 작업실</a> ·{" "}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- OAuth 시작 API의 302를 전체 문서 요청으로 연다. */}
            <a href="/api/oauth/start" rel="external">
              GitHub 로그인
            </a>
          </>
        )}
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {user ? (
        <p>
          {user.nickname}님{" "}
          <button
            disabled={pending}
            onClick={() =>
              perform(async () => {
                await api("/api/auth/logout", "POST");
                setUser(null);
              })
            }
          >
            로그아웃
          </button>
        </p>
      ) : (
        <>
          <button onClick={() => setSignup((v) => !v)}>
            {signup ? "로그인으로 전환" : "가입으로 전환"}
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void perform(() => auth(form));
            }}
          >
            <label>
              이메일
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
              />
            </label>
            <label>
              비밀번호
              <input
                name="password"
                type="password"
                minLength={8}
                maxLength={72}
                required
                autoComplete={signup ? "new-password" : "current-password"}
              />
            </label>
            {signup && (
              <label>
                별명
                <input name="nickname" required maxLength={40} />
              </label>
            )}
            <button disabled={pending}>
              {pending ? "처리 중" : signup ? "가입 후 로그인" : "로그인"}
            </button>
          </form>
        </>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void perform(() => load(1));
        }}
      >
        <label>
          검색
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button disabled={pending}>검색</button>
      </form>
      <p>
        전체 {listing.meta.total}개 · {listing.meta.page}/
        {listing.meta.totalPages || 1}
      </p>
      <ul>
        {listing.data.map((post) => (
          <li key={post.id}>
            <button onClick={() => perform(() => select(post))}>
              {post.title}
            </button>{" "}
            — {post.author.nickname} · 댓글 {post.commentCount}
          </li>
        ))}
      </ul>
      <button
        disabled={pending || listing.meta.page <= 1}
        onClick={() => perform(() => load(listing.meta.page - 1))}
      >
        이전
      </button>
      <button
        disabled={pending || listing.meta.page >= listing.meta.totalPages}
        onClick={() => perform(() => load(listing.meta.page + 1))}
      >
        다음
      </button>
      {selected && (
        <article>
          <h2>{selected.title}</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{selected.body}</p>
          <p>{selected.tags.join(", ")}</p>
          {selected.author.id === user?.id && (
            <button
              disabled={pending}
              onClick={() =>
                perform(async () => {
                  await api(`/api/posts/${selected.id}`, "DELETE");
                  setSelected(null);
                  await load();
                })
              }
            >
              게시글 삭제
            </button>
          )}
          <ul>
            {comments.map((comment) => (
              <li key={comment.id}>
                {comment.body} — {comment.author.nickname}
                {comment.author.id === user?.id && (
                  <button
                    disabled={pending}
                    onClick={() =>
                      perform(async () => {
                        await api(`/api/comments/${comment.id}`, "DELETE");
                        await select(selected);
                        await load();
                      })
                    }
                  >
                    댓글 삭제
                  </button>
                )}
              </li>
            ))}
          </ul>
          {user && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const element = e.currentTarget,
                  body = new FormData(element).get("body");
                void perform(async () => {
                  await api(`/api/posts/${selected.id}/comments`, "POST", {
                    body,
                  });
                  element.reset();
                  await select(selected);
                  await load();
                });
              }}
            >
              <label>
                댓글
                <input name="body" maxLength={2000} required />
              </label>
              <button disabled={pending}>댓글 등록</button>
            </form>
          )}
        </article>
      )}
      {user && (
        <form
          key={selected?.id ?? "new"}
          onSubmit={(e) => {
            e.preventDefault();
            const element = e.currentTarget,
              form = new FormData(element);
            const editing = selected?.author.id === user.id;
            void perform(async () => {
              const result = await api<{ data: PostView }>(
                editing ? `/api/posts/${selected.id}` : "/api/posts",
                editing ? "PATCH" : "POST",
                {
                  title: form.get("title"),
                  body: form.get("body"),
                  tags: String(form.get("tags") ?? "")
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                },
              );
              await select(result.data);
              await load();
              setMessage(editing ? "수정했습니다." : "등록했습니다.");
            });
          }}
        >
          <h2>{selected?.author.id === user.id ? "선택 글 수정" : "새 글"}</h2>
          <label>
            제목
            <input
              name="title"
              maxLength={200}
              required
              defaultValue={
                selected?.author.id === user.id ? selected.title : ""
              }
            />
          </label>
          <label>
            본문
            <textarea
              name="body"
              maxLength={20_000}
              required
              defaultValue={
                selected?.author.id === user.id ? selected.body : ""
              }
            />
          </label>
          <label>
            태그(쉼표 구분)
            <input
              name="tags"
              defaultValue={
                selected?.author.id === user.id ? selected.tags.join(",") : ""
              }
            />
          </label>
          <button disabled={pending}>저장</button>
          <button type="button" onClick={() => setSelected(null)}>
            새 글로 전환
          </button>
        </form>
      )}
      <Draft />
    </section>
  );
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 이 모듈과 하위 import를 브라우저 상호작용 경계로 선언한다. |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { useEffect, useRef, useState } from "react"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { api, type PostView, type UserView } from "./client"; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: { Draft } from "./draft"; |
| 5 | 현재 구문에서 다음 값·인자·표현식을 연결한다: type Listing = { |
| 6 | 객체·스키마·속성의 값을 지정한다: data: PostView[]; |
| 7 | 객체·스키마·속성의 값을 지정한다: meta: { page: number; totalPages: number; total: number }; |
| 8 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: type CommentView = { id: number; body: string; author: UserView }; |
| 10 | Board의 입력·반환 경계를 정의한다. |
| 11 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 12 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 13 | 객체·스키마·속성의 값을 지정한다: data: [], |
| 14 | 객체·스키마·속성의 값을 지정한다: meta: { page: 1, totalPages: 0, total: 0 }, |
| 15 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 16 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 17 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 18 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 19 | 중복 제출 상태를 제어한다. ref는 즉시 잠금, state는 버튼 화면 갱신에 사용한다. |
| 20 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 21 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 22 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 23 | load의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 24 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setListing( |
| 25 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await api<Listing>( |
| 26 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ˋ/api/posts?page=${page}&q=${encodeURIComponent(query)}ˋ, |
| 27 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 28 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 29 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 30 | 브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다. |
| 31 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let active = true; |
| 32 | 현재 구문에서 다음 값·인자·표현식을 연결한다: api<Listing>("/api/posts") |
| 33 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .then((value) => { |
| 34 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: if (active) setListing(value); |
| 35 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 36 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 37 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: if (active) setMessage(error.message); |
| 38 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 39 | 현재 구문에서 다음 값·인자·표현식을 연결한다: api<{ data: UserView }>("/api/auth/me") |
| 40 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .then((value) => { |
| 41 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: if (active) setUser(value.data); |
| 42 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 43 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 44 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return () => { |
| 45 | 현재 구문에서 다음 값·인자·표현식을 연결한다: active = false; |
| 46 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 47 | 현재 구문에서 다음 값·인자·표현식을 연결한다: }, []); |
| 48 | perform의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 49 | 중복 제출 상태를 제어한다. ref는 즉시 잠금, state는 버튼 화면 갱신에 사용한다. |
| 50 | 중복 제출 상태를 제어한다. ref는 즉시 잠금, state는 버튼 화면 갱신에 사용한다. |
| 51 | 중복 제출 상태를 제어한다. ref는 즉시 잠금, state는 버튼 화면 갱신에 사용한다. |
| 52 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setMessage(""); |
| 53 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 54 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await fn(); |
| 55 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 56 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setMessage(error instanceof Error ? error.message : "요청 실패"); |
| 57 | 성공·실패에 관계없이 잠금·연결·mock을 정리한다. |
| 58 | 중복 제출 상태를 제어한다. ref는 즉시 잠금, state는 버튼 화면 갱신에 사용한다. |
| 59 | 중복 제출 상태를 제어한다. ref는 즉시 잠금, state는 버튼 화면 갱신에 사용한다. |
| 60 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 61 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 62 | auth의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 63 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const body = Object.fromEntries(form); |
| 64 | 입력·상태 조건에 따라 처리 경로를 고른다: if (signup) await api("/api/auth/signup", "POST", body); |
| 65 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const result = await api<{ data: { user: UserView } }>( |
| 66 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "/api/auth/login", |
| 67 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "POST", |
| 68 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { email: body.email, password: body.password }, |
| 69 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 70 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setUser(result.data.user); |
| 71 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setMessage("로그인했습니다."); |
| 72 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 73 | select의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 74 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const [detail, comments] = await Promise.all([ |
| 75 | 현재 구문에서 다음 값·인자·표현식을 연결한다: api<{ data: PostView }>(ˋ/api/posts/${post.id}ˋ), |
| 76 | 현재 구문에서 다음 값·인자·표현식을 연결한다: api<{ data: CommentView[] }>(ˋ/api/posts/${post.id}/commentsˋ), |
| 77 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 78 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setSelected(detail.data); |
| 79 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setComments(comments.data); |
| 80 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 81 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return ( |
| 82 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <section className="course"> |
| 83 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <h1>Next.js 학습 게시판</h1> |
| 84 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p> |
| 85 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <a href="/api-docs">API 문서</a> |
| 86 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: {advanced && ( |
| 87 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <> |
| 88 | 현재 구문에서 다음 값·인자·표현식을 연결한다: {" "} |
| 89 | 현재 구문에서 다음 값·인자·표현식을 연결한다: · <a href="/workbench">문서·AI 작업실</a> ·{" "} |
| 90 | 현재 구문에서 다음 값·인자·표현식을 연결한다: {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- OAuth 시작 API의 302를 전체 문서 요청으로 연다. */} |
| 91 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <a href="/api/oauth/start" rel="external"> |
| 92 | 현재 구문에서 다음 값·인자·표현식을 연결한다: GitHub 로그인 |
| 93 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </a> |
| 94 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </> |
| 95 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 96 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </p> |
| 97 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p role="status" aria-live="polite"> |
| 98 | 현재 구문에서 다음 값·인자·표현식을 연결한다: {message} |
| 99 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </p> |
| 100 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: {user ? ( |
| 101 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p> |
| 102 | 현재 구문에서 다음 값·인자·표현식을 연결한다: {user.nickname}님{" "} |
| 103 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button |
| 104 | 현재 구문에서 다음 값·인자·표현식을 연결한다: disabled={pending} |
| 105 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onClick={() => |
| 106 | 현재 구문에서 다음 값·인자·표현식을 연결한다: perform(async () => { |
| 107 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await api("/api/auth/logout", "POST"); |
| 108 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setUser(null); |
| 109 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 110 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 111 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 112 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 로그아웃 |
| 113 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 114 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </p> |
| 115 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ) : ( |
| 116 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <> |
| 117 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: <button onClick={() => setSignup((v) => !v)}> |
| 118 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: {signup ? "로그인으로 전환" : "가입으로 전환"} |
| 119 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 120 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <form |
| 121 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onSubmit={(e) => { |
| 122 | 현재 구문에서 다음 값·인자·표현식을 연결한다: e.preventDefault(); |
| 123 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const form = new FormData(e.currentTarget); |
| 124 | 현재 구문에서 다음 값·인자·표현식을 연결한다: void perform(() => auth(form)); |
| 125 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 126 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 127 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <label> |
| 128 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 이메일 |
| 129 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <input |
| 130 | 현재 구문에서 다음 값·인자·표현식을 연결한다: name="email" |
| 131 | 현재 구문에서 다음 값·인자·표현식을 연결한다: type="email" |
| 132 | 현재 구문에서 다음 값·인자·표현식을 연결한다: required |
| 133 | 현재 구문에서 다음 값·인자·표현식을 연결한다: autoComplete="username" |
| 134 | 현재 구문에서 다음 값·인자·표현식을 연결한다: /> |
| 135 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </label> |
| 136 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <label> |
| 137 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 비밀번호 |
| 138 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <input |
| 139 | 현재 구문에서 다음 값·인자·표현식을 연결한다: name="password" |
| 140 | 현재 구문에서 다음 값·인자·표현식을 연결한다: type="password" |
| 141 | 현재 구문에서 다음 값·인자·표현식을 연결한다: minLength={8} |
| 142 | 현재 구문에서 다음 값·인자·표현식을 연결한다: maxLength={72} |
| 143 | 현재 구문에서 다음 값·인자·표현식을 연결한다: required |
| 144 | 현재 구문에서 다음 값·인자·표현식을 연결한다: autoComplete={signup ? "new-password" : "current-password"} |
| 145 | 현재 구문에서 다음 값·인자·표현식을 연결한다: /> |
| 146 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </label> |
| 147 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: {signup && ( |
| 148 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <label> |
| 149 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 별명 |
| 150 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <input name="nickname" required maxLength={40} /> |
| 151 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </label> |
| 152 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 153 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button disabled={pending}> |
| 154 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: {pending ? "처리 중" : signup ? "가입 후 로그인" : "로그인"} |
| 155 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 156 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </form> |
| 157 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </> |
| 158 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 159 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <form |
| 160 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onSubmit={(e) => { |
| 161 | 현재 구문에서 다음 값·인자·표현식을 연결한다: e.preventDefault(); |
| 162 | 현재 구문에서 다음 값·인자·표현식을 연결한다: void perform(() => load(1)); |
| 163 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 164 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 165 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <label> |
| 166 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 검색 |
| 167 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: <input value={q} onChange={(e) => setQ(e.target.value)} /> |
| 168 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </label> |
| 169 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button disabled={pending}>검색</button> |
| 170 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </form> |
| 171 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p> |
| 172 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 전체 {listing.meta.total}개 · {listing.meta.page}/ |
| 173 | 현재 구문에서 다음 값·인자·표현식을 연결한다: {listing.meta.totalPages \|\| 1} |
| 174 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </p> |
| 175 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <ul> |
| 176 | 현재 구문에서 다음 값·인자·표현식을 연결한다: {listing.data.map((post) => ( |
| 177 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <li key={post.id}> |
| 178 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button onClick={() => perform(() => select(post))}> |
| 179 | 현재 구문에서 다음 값·인자·표현식을 연결한다: {post.title} |
| 180 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button>{" "} |
| 181 | 현재 구문에서 다음 값·인자·표현식을 연결한다: — {post.author.nickname} · 댓글 {post.commentCount} |
| 182 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </li> |
| 183 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 184 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </ul> |
| 185 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button |
| 186 | 현재 구문에서 다음 값·인자·표현식을 연결한다: disabled={pending \|\| listing.meta.page <= 1} |
| 187 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onClick={() => perform(() => load(listing.meta.page - 1))} |
| 188 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 189 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 이전 |
| 190 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 191 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button |
| 192 | 현재 구문에서 다음 값·인자·표현식을 연결한다: disabled={pending \|\| listing.meta.page >= listing.meta.totalPages} |
| 193 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onClick={() => perform(() => load(listing.meta.page + 1))} |
| 194 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 195 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 다음 |
| 196 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 197 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: {selected && ( |
| 198 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <article> |
| 199 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <h2>{selected.title}</h2> |
| 200 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p style={{ whiteSpace: "pre-wrap" }}>{selected.body}</p> |
| 201 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <p>{selected.tags.join(", ")}</p> |
| 202 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: {selected.author.id === user?.id && ( |
| 203 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button |
| 204 | 현재 구문에서 다음 값·인자·표현식을 연결한다: disabled={pending} |
| 205 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onClick={() => |
| 206 | 현재 구문에서 다음 값·인자·표현식을 연결한다: perform(async () => { |
| 207 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await api(ˋ/api/posts/${selected.id}ˋ, "DELETE"); |
| 208 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setSelected(null); |
| 209 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await load(); |
| 210 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 211 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 212 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 213 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 게시글 삭제 |
| 214 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 215 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 216 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <ul> |
| 217 | 현재 구문에서 다음 값·인자·표현식을 연결한다: {comments.map((comment) => ( |
| 218 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <li key={comment.id}> |
| 219 | 현재 구문에서 다음 값·인자·표현식을 연결한다: {comment.body} — {comment.author.nickname} |
| 220 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: {comment.author.id === user?.id && ( |
| 221 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button |
| 222 | 현재 구문에서 다음 값·인자·표현식을 연결한다: disabled={pending} |
| 223 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onClick={() => |
| 224 | 현재 구문에서 다음 값·인자·표현식을 연결한다: perform(async () => { |
| 225 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await api(ˋ/api/comments/${comment.id}ˋ, "DELETE"); |
| 226 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await select(selected); |
| 227 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await load(); |
| 228 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 229 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 230 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 231 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 댓글 삭제 |
| 232 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 233 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 234 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </li> |
| 235 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 236 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </ul> |
| 237 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: {user && ( |
| 238 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <form |
| 239 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onSubmit={(e) => { |
| 240 | 현재 구문에서 다음 값·인자·표현식을 연결한다: e.preventDefault(); |
| 241 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const element = e.currentTarget, |
| 242 | 현재 구문에서 다음 값·인자·표현식을 연결한다: body = new FormData(element).get("body"); |
| 243 | 현재 구문에서 다음 값·인자·표현식을 연결한다: void perform(async () => { |
| 244 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await api(ˋ/api/posts/${selected.id}/commentsˋ, "POST", { |
| 245 | 현재 구문에서 다음 값·인자·표현식을 연결한다: body, |
| 246 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 247 | 현재 구문에서 다음 값·인자·표현식을 연결한다: element.reset(); |
| 248 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await select(selected); |
| 249 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await load(); |
| 250 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 251 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 252 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 253 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <label> |
| 254 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 댓글 |
| 255 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <input name="body" maxLength={2000} required /> |
| 256 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </label> |
| 257 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button disabled={pending}>댓글 등록</button> |
| 258 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </form> |
| 259 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 260 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </article> |
| 261 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 262 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: {user && ( |
| 263 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <form |
| 264 | 현재 구문에서 다음 값·인자·표현식을 연결한다: key={selected?.id ?? "new"} |
| 265 | 현재 구문에서 다음 값·인자·표현식을 연결한다: onSubmit={(e) => { |
| 266 | 현재 구문에서 다음 값·인자·표현식을 연결한다: e.preventDefault(); |
| 267 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const element = e.currentTarget, |
| 268 | 현재 구문에서 다음 값·인자·표현식을 연결한다: form = new FormData(element); |
| 269 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const editing = selected?.author.id === user.id; |
| 270 | 현재 구문에서 다음 값·인자·표현식을 연결한다: void perform(async () => { |
| 271 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const result = await api<{ data: PostView }>( |
| 272 | 현재 구문에서 다음 값·인자·표현식을 연결한다: editing ? ˋ/api/posts/${selected.id}ˋ : "/api/posts", |
| 273 | 현재 구문에서 다음 값·인자·표현식을 연결한다: editing ? "PATCH" : "POST", |
| 274 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 275 | 객체·스키마·속성의 값을 지정한다: title: form.get("title"), |
| 276 | 객체·스키마·속성의 값을 지정한다: body: form.get("body"), |
| 277 | 객체·스키마·속성의 값을 지정한다: tags: String(form.get("tags") ?? "") |
| 278 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .split(",") |
| 279 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .map((t) => t.trim()) |
| 280 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .filter(Boolean), |
| 281 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 282 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 283 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await select(result.data); |
| 284 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await load(); |
| 285 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: setMessage(editing ? "수정했습니다." : "등록했습니다."); |
| 286 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 287 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 288 | 현재 구문에서 다음 값·인자·표현식을 연결한다: > |
| 289 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <h2>{selected?.author.id === user.id ? "선택 글 수정" : "새 글"}</h2> |
| 290 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <label> |
| 291 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 제목 |
| 292 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <input |
| 293 | 현재 구문에서 다음 값·인자·표현식을 연결한다: name="title" |
| 294 | 현재 구문에서 다음 값·인자·표현식을 연결한다: maxLength={200} |
| 295 | 현재 구문에서 다음 값·인자·표현식을 연결한다: required |
| 296 | 현재 구문에서 다음 값·인자·표현식을 연결한다: defaultValue={ |
| 297 | 현재 구문에서 다음 값·인자·표현식을 연결한다: selected?.author.id === user.id ? selected.title : "" |
| 298 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 299 | 현재 구문에서 다음 값·인자·표현식을 연결한다: /> |
| 300 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </label> |
| 301 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <label> |
| 302 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 본문 |
| 303 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <textarea |
| 304 | 현재 구문에서 다음 값·인자·표현식을 연결한다: name="body" |
| 305 | 현재 구문에서 다음 값·인자·표현식을 연결한다: maxLength={20_000} |
| 306 | 현재 구문에서 다음 값·인자·표현식을 연결한다: required |
| 307 | 현재 구문에서 다음 값·인자·표현식을 연결한다: defaultValue={ |
| 308 | 현재 구문에서 다음 값·인자·표현식을 연결한다: selected?.author.id === user.id ? selected.body : "" |
| 309 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 310 | 현재 구문에서 다음 값·인자·표현식을 연결한다: /> |
| 311 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </label> |
| 312 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <label> |
| 313 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 태그(쉼표 구분) |
| 314 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <input |
| 315 | 현재 구문에서 다음 값·인자·표현식을 연결한다: name="tags" |
| 316 | 현재 구문에서 다음 값·인자·표현식을 연결한다: defaultValue={ |
| 317 | 현재 구문에서 다음 값·인자·표현식을 연결한다: selected?.author.id === user.id ? selected.tags.join(",") : "" |
| 318 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 319 | 현재 구문에서 다음 값·인자·표현식을 연결한다: /> |
| 320 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </label> |
| 321 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <button disabled={pending}>저장</button> |
| 322 | 이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: <button type="button" onClick={() => setSelected(null)}> |
| 323 | 현재 구문에서 다음 값·인자·표현식을 연결한다: 새 글로 전환 |
| 324 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </button> |
| 325 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </form> |
| 326 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 327 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: <Draft /> |
| 328 | JSX로 화면·레이블·입력·조건부 내용을 구성한다: </section> |
| 329 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 330 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

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

## ④ 🔗 연동 포인트

FormData → JSON → /api/posts → 서버 검증 → {data} 또는 {error} → 상태 갱신이다. API 오류의 fields를 각 입력 옆에 배치하는 확장은 직접 해보기에서 한다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| 422를 성공으로 처리 | status===200만 보거나 오류 본문 무시 | response.ok와 공통 error.message 처리 |
| 버튼이 계속 잠김 | 예외 경로에서 pending 복구 누락 | finally에서 상태와 ref 복구 |
| 204 JSON 파싱 오류 | 본문 없는 응답에 json() 호출 | 204는 먼저 반환 |

## ⑥ 직접 해보기

1. 서버 fields.title을 제목 입력 아래에 표시한다.
2. 오프라인 제출 뒤 재시도할 수 있는지 확인한다.
3. 응답 200/400/422를 각각 가짜 fetch로 만들어 오류 경로를 확인한다.

## ⑦ ☐ 체크리스트

- [ ] 클라이언트·서버 검증을 둘 다 수행한다.
- [ ] pending과 finally로 중복 제출·잠금 복구를 처리한다.
- [ ] 200/400/422 및 204의 응답 처리 차이를 설명한다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study6](study6.md)에서 환경변수로 DB를 연결하고 게시글·댓글 CRUD를 공통 v1 계약으로 제공한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
