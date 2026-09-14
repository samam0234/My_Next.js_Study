import { NextResponse } from "next/server";
import { deletePost, getPost, updatePost } from "@/lib/posts-store";

export async function GET(_request, { params }) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ post });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const post = await updatePost(id, {
      title: body.title ?? "",
      body: body.body ?? "",
    });
    if (!post) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : "잘못된 요청";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const ok = await deletePost(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
