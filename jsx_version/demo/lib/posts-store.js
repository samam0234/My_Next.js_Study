import { promises as fs } from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "posts.json");

async function readAll() {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeAll(posts) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
}

export async function listPosts() {
  return readAll();
}

export async function getPost(id) {
  const posts = await readAll();
  return posts.find((post) => post.id === id) ?? null;
}

export async function createPost(input) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) {
    throw new Error("제목과 본문은 필수입니다.");
  }
  const posts = await readAll();
  const post = {
    id: crypto.randomUUID(),
    title,
    body,
    createdAt: new Date().toISOString(),
    authorName: input.authorName,
  };
  posts.unshift(post);
  await writeAll(posts);
  return post;
}

export async function updatePost(id, input) {
  const posts = await readAll();
  const index = posts.findIndex((post) => post.id === id);
  if (index < 0) {
    return null;
  }
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) {
    throw new Error("제목과 본문은 필수입니다.");
  }
  posts[index] = { ...posts[index], title, body };
  await writeAll(posts);
  return posts[index];
}

export async function deletePost(id) {
  const posts = await readAll();
  const next = posts.filter((post) => post.id !== id);
  if (next.length === posts.length) {
    return false;
  }
  await writeAll(next);
  return true;
}
