import { NextResponse } from "next/server";
import { createPost, listPosts } from "@/lib/posts-store";

export async function GET() {
  const posts = await listPosts();
  return NextResponse.json({ posts });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const post = await createPost({
      title: body.title ?? "",
      body: body.body ?? "",
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "잘못된 요청";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
