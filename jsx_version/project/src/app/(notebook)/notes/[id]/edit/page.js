import { notFound } from "next/navigation";
import { NoteForm } from "@/components/note-form";
import { getNote } from "@/features/notes/store";
import { getSession } from "@/lib/session";

export default async function EditNotePage({ params }) {
  const session = await getSession();
  const note = getNote((await params).id, session.sub);
  if (!note) {
    notFound();
  }
  return (
    <article className="rounded-2xl border border-rule bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-bold">노트 수정</h1>
      <div className="mt-4">
        <NoteForm note={note} />
      </div>
    </article>
  );
}
