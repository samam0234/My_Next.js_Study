import { promises as fs } from "fs";
import path from "path";

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
};

const filePath = path.join(process.cwd(), "data", "users.json");

async function readAll(): Promise<User[]> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as User[];
}

async function writeAll(users: User[]) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

export async function findUserByEmail(email: string) {
  const users = await readAll();
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function findUserById(id: string) {
  const users = await readAll();
  return users.find((user) => user.id === id) ?? null;
}

export async function createUser(input: { email: string; name: string; passwordHash: string }) {
  const users = await readAll();
  const user: User = {
    id: crypto.randomUUID(),
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash: input.passwordHash,
  };
  users.push(user);
  await writeAll(users);
  return user;
}

export function publicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name };
}
