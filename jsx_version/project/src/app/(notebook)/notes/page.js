import Link from "next/link";
import { listNotes } from "@/features/notes/store";
import { getSession } from "@/lib/session";

export default async function NotesPage() {
  const session = await getSession();
  const notes = listNotes(session.sub);

  return (
    <article className="rounded-2xl border border-rule bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">내 노트</h1>
        <Link href="/notes/new" className="rounded-md bg-ink px-3 py-1.5 text-sm text-card">
          새 노트
        </Link>
      </div>
      {notes.length === 0 ? (
        <p className="mt-6 text-sm text-ink">아직 노트가 없습니다. 오늘 배운 것 한 줄을 남겨 보세요.</p>
      ) : (
        <ul className="mt-4 divide-y divide-rule">
          {notes.map((note) => (
            <li key={note.id} className="py-3">
              <Link href={`/notes/${note.id}`} className="font-medium hover:underline">
                {note.title}
              </Link>
              {note.tag ? (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-mark">
                  {note.tag}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
