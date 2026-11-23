import { ApiError, identifier, text } from "./domain";
import { getRepository } from "./repository";
import { authenticate, rateLimit } from "./security";
import { jsonBody, reply } from "./http";
import { summarize } from "./ai";
import { checkout, sendMail } from "./services";

export async function advanced(request: Request): Promise<Response> {
  const repo = await getRepository(),
    state = await repo.read(),
    { user } = authenticate(request, state);
  const pathname = new URL(request.url).pathname.replace(
    /^\/api\/v1\//,
    "/api/",
  );
  rateLimit(`advanced:${user.id}`, 30);
  if (pathname === "/api/files" && request.method === "POST") {
    // 작은 텍스트 문서만 허용한다. PDF/OCR은 별도 파서·악성 파일 검사 단계가 필요하다.
    if (Number(request.headers.get("content-length")) > 100_000)
      throw new ApiError(
        413,
        "PAYLOAD_TOO_LARGE",
        "파일 요청은 100KB 이하입니다.",
      );
    const body = await jsonBody(request); // 실제 읽기 64KB 제한. base64 대신 UTF-8 JSON 업로드.
    const name = text(body.name, "name", 100),
      content = text(body.text, "text", 20_000);
    if (!/^[\w가-힣 .-]+\.(txt|md)$/i.test(name))
      throw new ApiError(400, "VALIDATION_ERROR", "txt/md 파일만 허용합니다.");
    const file = await repo.change((s) => {
      const file = { id: ++s.seq, ownerId: user.id, name, text: content };
      s.files.push(file);
      return file;
    });
    return reply({ data: file }, 201);
  }
  if (pathname === "/api/files" && request.method === "GET")
    return reply({ data: state.files.filter((f) => f.ownerId === user.id) });
  if (pathname === "/api/ai/summary" && request.method === "POST") {
    const body = await jsonBody(request);
    let content: string;
    if (body.fileId !== undefined) {
      const file = state.files.find(
        (f) =>
          f.id === identifier(String(body.fileId)) && f.ownerId === user.id,
      );
      if (!file)
        throw new ApiError(404, "NOT_FOUND", "내 문서를 찾을 수 없습니다.");
      content = file.text;
    } else content = text(body.text, "text", 20_000);
    const question =
      body.question === undefined
        ? undefined
        : text(body.question, "question", 1000);
    return summarize(content, question);
  }
  if (pathname === "/api/mail" && request.method === "POST") {
    const body = await jsonBody(request),
      content = text(body.text, "text", 5000);
    // 목적지는 세션 사용자로 고정하여 임의 주소 스팸 발송을 막는다.
    return reply({
      data: await sendMail(
        user.email,
        content,
        text(request.headers.get("idempotency-key"), "idempotency-key", 100),
      ),
    });
  }
  if (pathname === "/api/payments/checkout" && request.method === "POST")
    return reply(
      {
        data: await checkout(
          user.id,
          text(request.headers.get("idempotency-key"), "idempotency-key", 100),
        ),
      },
      201,
    );
  if (pathname === "/api/jobs" && request.method === "POST") {
    const content = text((await jsonBody(request)).text, "text", 20_000);
    const job = await repo.change((s) => {
      const job = {
        id: ++s.seq,
        ownerId: user.id,
        status: "pending" as const,
        attempts: 0,
        text: content,
      };
      s.jobs.push(job);
      return job;
    });
    return reply({ data: job }, 202, { Location: `/api/jobs/${job.id}` });
  }
  const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
  if (jobMatch && request.method === "GET") {
    const job = state.jobs.find(
      (j) => j.id === identifier(jobMatch[1]) && j.ownerId === user.id,
    );
    if (!job) throw new ApiError(404, "NOT_FOUND", "작업이 없습니다.");
    return reply({ data: job });
  }
  if (pathname === "/api/events" && request.method === "GET") {
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    let busy = false,
      stopped = false,
      ticks = 0;
    const stop = () => {
      stopped = true;
      if (timer) clearInterval(timer);
      request.signal.removeEventListener("abort", abort);
    };
    let closeStream: (() => void) | undefined;
    const abort = () => {
      stop();
      closeStream?.();
    };
    return new Response(
      new ReadableStream({
        start(controller) {
          closeStream = () => {
            try {
              controller.close();
            } catch {}
          };
          controller.enqueue(encoder.encode("retry: 3000\n\n"));
          timer = setInterval(async () => {
            if (busy || stopped) return;
            busy = true;
            try {
              const current = await repo.read();
              authenticate(request, current);
              if (stopped) return;
              const jobs = current.jobs
                .filter((j) => j.ownerId === user.id)
                .map((j) => ({ id: j.id, status: j.status }));
              controller.enqueue(
                encoder.encode(
                  `id: ${Date.now()}\ndata: ${JSON.stringify(jobs)}\n\n`,
                ),
              );
              if (++ticks >= 15) {
                stop();
                closeStream?.();
              }
            } catch {
              stop();
              closeStream?.();
            } finally {
              busy = false;
            }
          }, 2000);
          request.signal.addEventListener("abort", abort, { once: true });
        },
        cancel() {
          stop();
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      },
    );
  }
  throw new ApiError(404, "NOT_FOUND", "없는 확장 API 경로입니다.");
}
