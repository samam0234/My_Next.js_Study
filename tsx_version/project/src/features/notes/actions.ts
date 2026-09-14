"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNote, deleteNote, updateNote } from "@/features/notes/store";
import { getSession } from "@/lib/session";

async function requireUser() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function createNoteAction(formData: FormData) {
  const session = await requireUser();
  const note = createNote({
    userId: session.sub,
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    tag: String(formData.get("tag") ?? ""),
  });
  revalidatePath("/notes");
  redirect(`/notes/${note.id}`);
}

export async function updateNoteAction(id: string, formData: FormData) {
  const session = await requireUser();
  const ok = updateNote(id, session.sub, {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    tag: String(formData.get("tag") ?? ""),
  });
  if (!ok) {
    redirect("/notes");
  }
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
  redirect(`/notes/${id}`);
}

export async function deleteNoteAction(id: string) {
  const session = await requireUser();
  deleteNote(id, session.sub);
  revalidatePath("/notes");
  redirect("/notes");
}
