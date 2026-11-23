import { ApiError } from "./domain";
export async function jsonBody(request) {
    if (!request.headers.get("content-type")?.includes("application/json"))
        throw new ApiError(400, "BAD_REQUEST", "application/json이 필요합니다.");
    const reader = request.body?.getReader();
    if (!reader)
        throw new ApiError(400, "BAD_REQUEST", "JSON 본문이 필요합니다.");
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.length;
            if (size > 64_000) {
                await reader.cancel();
                throw new ApiError(413, "PAYLOAD_TOO_LARGE", "JSON은 64KB까지입니다.");
            }
            chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
        }
        const body = JSON.parse(new TextDecoder().decode(bytes));
        if (!body || typeof body !== "object" || Array.isArray(body))
            throw new Error("object required");
        return body;
    }
    catch (error) {
        if (error instanceof ApiError)
            throw error;
        throw new ApiError(400, "BAD_REQUEST", "JSON 문법을 확인하세요.");
    }
    finally {
        reader.releaseLock();
    }
}
export function reply(data, status = 200, headers = {}) {
    return Response.json(data, { status, headers });
}
export function failure(error, requestId) {
    const known = error instanceof ApiError;
    if (!known)
        console.error(JSON.stringify({
            requestId,
            event: "request_failed",
            error: error instanceof Error ? error.message : "unknown",
        }));
    return reply({
        error: {
            code: known ? error.code : "INTERNAL",
            message: known ? error.message : "서버 오류가 발생했습니다.",
            fields: known ? error.fields : {},
            requestId,
        },
    }, known ? error.status : 500);
}
