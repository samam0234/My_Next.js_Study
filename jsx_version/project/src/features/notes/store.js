import { getDb } from "@/lib/db";

export function listNotes(userId) {
  return getDb()
    .prepare("SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId);
}

export function getNote(id, userId) {
  return (
    getDb().prepare("SELECT * FROM notes WHERE id = ? AND user_id = ?").get(id, userId) ??
    null
  );
}

export function createNote(input) {
  const note = {
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

export function updateNote(id, userId, input) {
  const result = getDb()
    .prepare(
      "UPDATE notes SET title = ?, body = ?, tag = ? WHERE id = ? AND user_id = ?",
    )
    .run(input.title.trim(), input.body.trim(), input.tag.trim(), id, userId);
  return result.changes > 0;
}

export function deleteNote(id, userId) {
  const result = getDb()
    .prepare("DELETE FROM notes WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return result.changes > 0;
}
