import { NextResponse } from "next/server";
import { createPost, listPosts } from "@/lib/posts-store";
import { getSession } from "@/lib/session";

export async function GET() {
  const posts = await listPosts();
  return NextResponse.json({ posts });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const body = await request.json();
    const post = await createPost({
      title: body.title ?? "",
      body: body.body ?? "",
      authorName: session.name,
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "잘못된 요청";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
