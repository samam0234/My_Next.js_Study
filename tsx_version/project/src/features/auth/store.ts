import { getDb } from "@/lib/db";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
};

export function findUserByEmail(email: string) {
  return (
    (getDb()
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email.toLowerCase()) as UserRow | undefined) ?? null
  );
}

export function createUserRow(input: {
  email: string;
  name: string;
  passwordHash: string;
}) {
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
