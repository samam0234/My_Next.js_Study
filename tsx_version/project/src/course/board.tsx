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
