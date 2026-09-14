import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteNoteAction } from "@/features/notes/actions";
import { getNote } from "@/features/notes/store";
import { getSession } from "@/lib/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await getSession();
  if (!session) {
    return { title: "노트" };
  }
  const note = getNote((await params).id, session.sub);
  return { title: note?.title ?? "노트" };
}

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  const note = getNote(id, session!.sub);
  if (!note) {
    notFound();
  }

  return (
    <article className="rounded-2xl border border-rule bg-card p-6 shadow-sm">
      <p className="text-xs uppercase tracking-widest text-mark">{note.tag || "메모"}</p>
      <h1 className="mt-2 text-2xl font-bold">{note.title}</h1>
      <p className="mt-4 whitespace-pre-wrap leading-7 text-ink">{note.body}</p>
      <div className="mt-6 flex gap-4 text-sm">
        <Link href={`/notes/${note.id}/edit`} className="underline">
          수정
        </Link>
        <form action={deleteNoteAction.bind(null, note.id)}>
          <button type="submit" className="text-red-700 underline">
            삭제
          </button>
        </form>
      </div>
    </article>
  );
}
