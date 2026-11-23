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
