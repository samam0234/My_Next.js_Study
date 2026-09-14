import { getDb } from "@/lib/db";

export function findUserByEmail(email) {
  return (
    getDb().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) ?? null
  );
}

export function createUserRow(input) {
  const user = {
    id: crypto.randomUUID(),
    email: input.email.toLowerCase(),
    name: input.name,
    password_hash: input.passwordHash,
  };
  getDb()
    .prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)")
    .run(user.id, user.email, user.name, user.password_hash);
  return user;
}
