import { getRepository } from "./repository";
// 단일 워커를 별도 프로세스로 실행한다. HTTP 응답 뒤의 비영속 setTimeout에 의존하지 않는다.
export async function runOnce() {
  const repo = await getRepository();
  return repo.change((state) => {
    const job = state.jobs.find((j) => j.status === "pending");
    if (!job) return null;
    job.attempts++;
    try {
      job.result = job.text.replace(/\s+/g, " ").slice(0, 300);
      job.status = "done";
    } catch {
      job.status = job.attempts >= 3 ? "failed" : "pending";
    }
    return { id: job.id, status: job.status };
  });
}
if (process.argv.includes("--once")) console.log(await runOnce());
