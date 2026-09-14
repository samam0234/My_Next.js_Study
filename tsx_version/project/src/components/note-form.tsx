import { createNoteAction, updateNoteAction } from "@/features/notes/actions";
import { SubmitButton } from "@/components/submit-button";
import type { NoteRow } from "@/features/notes/store";

export function NoteForm({ note }: { note?: NoteRow }) {
  const action = note ? updateNoteAction.bind(null, note.id) : createNoteAction;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        name="title"
        required
        defaultValue={note?.title}
        placeholder="제목"
        className="rounded-md border border-rule bg-white px-3 py-2"
      />
      <input
        name="tag"
        defaultValue={note?.tag}
        placeholder="태그 (예: next, auth)"
        className="rounded-md border border-rule bg-white px-3 py-2"
      />
      <textarea
        name="body"
        required
        rows={8}
        defaultValue={note?.body}
        placeholder="오늘 이해한 것을 적습니다."
        className="rounded-md border border-rule bg-white px-3 py-2"
      />
      <SubmitButton label={note ? "고치기" : "남기기"} />
    </form>
  );
}
