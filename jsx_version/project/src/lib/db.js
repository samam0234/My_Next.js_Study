import { existsSync, mkdirSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import bcrypt from "bcryptjs";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "studylog.db");

let db = null;

export function getDb() {
  if (db) {
    return db;
  }
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get();
  if (count.n === 0 && process.env.NODE_ENV !== "production") {
    db.prepare(
      "INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)",
    ).run(
      "seed-user",
      "demo@example.com",
      "데모",
      bcrypt.hashSync("demo1234", 10),
    );
  }
  return db;
}
