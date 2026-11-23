import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { emptyState, type State } from "./domain";
import type { Repository } from "./repository";
let repository: Repository | undefined;
export async function getSqliteRepository(): Promise<Repository> {
  if (repository) return repository;
  const file = path.resolve(
    /* turbopackIgnore: true */ process.env.COURSE_DB_PATH ?? "data/course.db",
  );
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS course_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL)",
  );
  db.prepare("INSERT OR IGNORE INTO course_state VALUES (1, ?)").run(
    JSON.stringify(emptyState()),
  );
  const read = () =>
    JSON.parse(
      (
        db.prepare("SELECT data FROM course_state WHERE id=1").get() as {
          data: string;
        }
      ).data,
    ) as State;
  repository = {
    read: async () => read(),
    change: async (fn) => {
      db.exec("BEGIN IMMEDIATE");
      try {
        const state = read(),
          result = fn(state);
        db.prepare("UPDATE course_state SET data=? WHERE id=1").run(
          JSON.stringify(state),
        );
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return repository;
}
