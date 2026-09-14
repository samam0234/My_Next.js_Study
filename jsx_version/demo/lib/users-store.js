import { promises as fs } from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "users.json");

async function readAll() {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeAll(users) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

export async function findUserByEmail(email) {
  const users = await readAll();
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function findUserById(id) {
  const users = await readAll();
  return users.find((user) => user.id === id) ?? null;
}

export async function createUser(input) {
  const users = await readAll();
  const user = {
    id: crypto.randomUUID(),
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash: input.passwordHash,
  };
  users.push(user);
  await writeAll(users);
  return user;
}

export function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}
