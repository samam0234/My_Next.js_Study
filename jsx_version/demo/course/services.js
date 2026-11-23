import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "./domain";
import { getRepository } from "./repository";
import { reply } from "./http";
export async function sendMail(to, text, key) {
    if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
        throw new ApiError(503, "CONFIG_REQUIRED", "메일 키와 검증된 발신 주소가 필요합니다.");
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": key,
        },
        body: JSON.stringify({
            from: process.env.MAIL_FROM,
            to: [to],
            subject: "학습 문서",
            text,
        }),
    });
    if (!response.ok)
        throw new ApiError(502, "UPSTREAM_ERROR", "메일 발송에 실패했습니다.");
    return response.json();
}
export async function checkout(ownerId, key) {
    if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ||
        !process.env.STRIPE_PRICE_ID ||
        !process.env.APP_ORIGIN)
        throw new ApiError(503, "CONFIG_REQUIRED", "Stripe 테스트 키, 가격, APP_ORIGIN이 필요합니다.");
    const form = new URLSearchParams({
        mode: "payment",
        "line_items[0][price]": process.env.STRIPE_PRICE_ID,
        "line_items[0][quantity]": "1",
        client_reference_id: String(ownerId),
        success_url: `${process.env.APP_ORIGIN}/board?payment=returned`,
        cancel_url: `${process.env.APP_ORIGIN}/board?payment=cancelled`,
    });
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
            Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": `user-${ownerId}-${key}`,
        },
        body: form,
    });
    if (!response.ok)
        throw new ApiError(502, "UPSTREAM_ERROR", "결제 세션 생성에 실패했습니다.");
    const session = await response.json();
    return { id: session.id, url: session.url };
}
export async function webhook(request) {
    if (request.method !== "POST")
        throw new ApiError(405, "METHOD_NOT_ALLOWED", "POST만 지원합니다.");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret)
        throw new ApiError(503, "CONFIG_REQUIRED", "웹훅 비밀키가 필요합니다.");
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 64_000)
        throw new ApiError(413, "PAYLOAD_TOO_LARGE", "웹훅 크기 초과");
    const parts = request.headers.get("stripe-signature")?.split(",") ?? [];
    const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
    const signatures = parts
        .filter((p) => p.startsWith("v1="))
        .map((p) => p.slice(3));
    if (!timestamp ||
        !/^\d+$/.test(timestamp) ||
        Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)
        throw new ApiError(400, "BAD_REQUEST", "웹훅 시각이 유효하지 않습니다.");
    const expected = createHmac("sha256", secret)
        .update(`${timestamp}.${raw}`)
        .digest();
    if (!signatures.some((s) => /^[a-f0-9]{64}$/i.test(s) &&
        timingSafeEqual(expected, Buffer.from(s, "hex"))))
        throw new ApiError(400, "BAD_REQUEST", "웹훅 서명이 유효하지 않습니다.");
    let event;
    try {
        event = JSON.parse(raw);
    }
    catch {
        throw new ApiError(400, "BAD_REQUEST", "웹훅 JSON 오류");
    }
    if (typeof event.id !== "string" || typeof event.type !== "string")
        throw new ApiError(400, "BAD_REQUEST", "웹훅 이벤트 오류");
    const duplicate = await (await getRepository()).change((state) => {
        if (state.webhookIds.includes(event.id))
            return true;
        state.webhookIds.push(event.id);
        return false;
    });
    // 수신·중복 제거까지만 구현. 유료 권한을 추가할 때 paid 상태와 주문 소유자를 트랜잭션으로 확인한다.
    return reply({ data: { received: true, duplicate } });
}
