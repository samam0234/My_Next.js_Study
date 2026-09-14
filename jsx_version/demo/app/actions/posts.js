"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPost, deletePost, updatePost } from "@/lib/posts-store";
import { getSession } from "@/lib/session";

export async function createPostAction(formData) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const post = await createPost({
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    authorName: session.name,
  });
  revalidatePath("/posts");
  redirect(`/posts/${post.id}`);
}

export async function updatePostAction(id, formData) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const post = await updatePost(id, {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!post) {
    redirect("/posts");
  }
  revalidatePath("/posts");
  revalidatePath(`/posts/${id}`);
  redirect(`/posts/${id}`);
}

export async function deletePostAction(id) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  await deletePost(id);
  revalidatePath("/posts");
  redirect("/posts");
}
