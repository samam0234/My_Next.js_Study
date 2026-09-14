import { getDb } from "@/lib/db";

export type NoteRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  tag: string;
  created_at: string;
};

export function listNotes(userId: string) {
  return getDb()
    .prepare("SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as NoteRow[];
}

export function getNote(id: string, userId: string) {
  return (
    (getDb()
      .prepare("SELECT * FROM notes WHERE id = ? AND user_id = ?")
      .get(id, userId) as NoteRow | undefined) ?? null
  );
}

export function createNote(input: {
  userId: string;
  title: string;
  body: string;
  tag: string;
}) {
  const note: NoteRow = {
    id: crypto.randomUUID(),
    user_id: input.userId,
    title: input.title.trim(),
    body: input.body.trim(),
    tag: input.tag.trim(),
    created_at: new Date().toISOString(),
  };
  getDb()
    .prepare(
      "INSERT INTO notes (id, user_id, title, body, tag, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(note.id, note.user_id, note.title, note.body, note.tag, note.created_at);
  return note;
}

export function updateNote(
  id: string,
  userId: string,
  input: { title: string; body: string; tag: string },
) {
  const result = getDb()
    .prepare(
      "UPDATE notes SET title = ?, body = ?, tag = ? WHERE id = ? AND user_id = ?",
    )
    .run(input.title.trim(), input.body.trim(), input.tag.trim(), id, userId);
  return result.changes > 0;
}

export function deleteNote(id: string, userId: string) {
  const result = getDb()
    .prepare("DELETE FROM notes WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return result.changes > 0;
}
