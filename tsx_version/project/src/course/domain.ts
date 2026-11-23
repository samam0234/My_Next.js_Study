export type User = {
  id: number;
  email: string;
  nickname: string;
  passwordHash: string;
  githubId?: number;
};
export type Post = {
  id: number;
  title: string;
  body: string;
  tags: string[];
  authorId: number;
  createdAt: string;
  updatedAt: string;
};
export type Comment = {
  id: number;
  postId: number;
  authorId: number;
  body: string;
  createdAt: string;
};
export type Job = {
  id: number;
  ownerId: number;
  status: "pending" | "done" | "failed";
  attempts: number;
  text: string;
  result?: string;
};
export type State = {
  seq: number;
  users: User[];
  posts: Post[];
  comments: Comment[];
  files: { id: number; ownerId: number; name: string; text: string }[];
  jobs: Job[];
  revoked: string[];
  webhookIds: string[];
};
export const emptyState = (): State => ({
  seq: 0,
  users: [],
  posts: [],
  comments: [],
  files: [],
  jobs: [],
  revoked: [],
  webhookIds: [],
});
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}
export function text(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new ApiError(400, "VALIDATION_ERROR", "입력값을 확인하세요.", {
      [field]: [`1~${max}자로 입력하세요.`],
    });
  return value.trim();
}
export function identifier(value: string) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new ApiError(400, "BAD_REQUEST", "id는 양의 정수입니다.");
  return Number(value);
}
export function publicUser(user: User) {
  return { id: user.id, email: user.email, nickname: user.nickname };
}
export function postView(state: State, post: Post) {
  const user = state.users.find((u) => u.id === post.authorId)!;
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    tags: post.tags,
    author: { id: user.id, nickname: user.nickname },
    commentCount: state.comments.filter((c) => c.postId === post.id).length,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}
export function listPosts(state: State, query: URLSearchParams) {
  const number = (key: string, fallback: number) => {
    const raw = query.get(key);
    if (raw === null) return fallback;
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      throw new ApiError(400, "BAD_REQUEST", `${key}는 양의 정수입니다.`);
    return Number(raw);
  };
  const page = number("page", 1),
    limit = Math.min(number("limit", 10), 50),
    q = query.get("q") ?? "";
  const sort = query.get("sort") ?? "-createdAt";
  if (!["createdAt", "-createdAt", "-commentCount"].includes(sort))
    throw new ApiError(400, "BAD_REQUEST", "정렬 값을 확인하세요.");
  const rows = state.posts
    .filter((p) =>
      `${p.title}\n${p.body}`.toLowerCase().includes(q.toLowerCase()),
    )
    .map((p) => postView(state, p));
  rows.sort((a, b) =>
    sort === "-commentCount"
      ? b.commentCount - a.commentCount || b.id - a.id
      : (sort === "createdAt" ? 1 : -1) *
        (a.createdAt.localeCompare(b.createdAt) || a.id - b.id),
  );
  return {
    data: rows.slice((page - 1) * limit, page * limit),
    meta: {
      page,
      limit,
      total: rows.length,
      totalPages: Math.ceil(rows.length / limit),
      q,
    },
  };
}
