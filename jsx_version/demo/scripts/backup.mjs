import { DatabaseSync, backup } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
if ((process.env.DB_DRIVER ?? "sqlite") !== "sqlite")
  throw new Error("서버 DB는 study16의 DB별 백업 명령을 사용하세요.");
const source = path.resolve(process.env.COURSE_DB_PATH ?? "data/course.db");
if (!fs.existsSync(source)) throw new Error("DB를 먼저 실행하세요.");
const target = path.resolve("backups", `course-${Date.now()}.db`);
fs.mkdirSync(path.dirname(target), { recursive: true });
const db = new DatabaseSync(source);
try {
  await backup(db, target);
  console.log(`백업 완료: ${target}`);
} finally {
  db.close();
}
