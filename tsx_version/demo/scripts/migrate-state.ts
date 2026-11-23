import fs from "node:fs/promises";
import path from "node:path";
import { getRepository } from "../course/repository";
import { emptyState, type State } from "../course/domain";
const [operation, file] = process.argv.slice(2);
if (!["export", "import"].includes(operation) || !file)
  throw new Error(
    "사용법: npx tsx scripts/migrate-state.ts export|import backups/state.json",
  );
const repo = await getRepository();
if (operation === "export") {
  await fs.mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await fs.writeFile(file, JSON.stringify(await repo.read()), { mode: 0o600 });
  console.log("내보내기 완료. 비밀번호 해시를 포함하므로 Git에 올리지 마세요.");
} else {
  const state = JSON.parse(await fs.readFile(file, "utf8")) as State;
  if (
    !Number.isSafeInteger(state.seq) ||
    Object.keys(emptyState()).some(
      (key) => key !== "seq" && !Array.isArray(state[key as keyof State]),
    )
  )
    throw new Error("스냅샷 형식이 올바르지 않습니다.");
  await repo.change((current) => {
    if (current.users.length || current.posts.length)
      throw new Error("대상 DB가 비어 있어야 합니다.");
    Object.assign(current, state);
  });
  console.log("가져오기 완료. /health와 원본 건수를 대조하세요.");
}
process.exit(0); // CLI에서 DB 풀을 소유하므로 결과 기록 뒤 연결을 종료한다.
