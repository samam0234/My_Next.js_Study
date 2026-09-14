import { NoteForm } from "@/components/note-form";

export default function NewNotePage() {
  return (
    <article className="rounded-2xl border border-rule bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-bold">새 노트</h1>
      <div className="mt-4">
        <NoteForm />
      </div>
    </article>
  );
}
