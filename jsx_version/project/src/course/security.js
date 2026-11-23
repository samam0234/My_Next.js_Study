import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ApiError } from "./domain";
export const COOKIE = "course_session";
export function secret() {
    const value = process.env.JWT_SECRET;
    if (!value || value.length < 32)
        throw new ApiError(503, "CONFIG_REQUIRED", "JWT_SECRET을 32자 이상 설정하세요.");
    return value;
}
export const hashPassword = (password) => bcrypt.hash(password, 12);
export const checkPassword = (password, hash) => bcrypt.compare(password, hash);
export function issueToken(id) {
    return jwt.sign({ sub: String(id), jti: crypto.randomUUID() }, secret(), {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: "next-study",
        audience: "next-study",
    });
}
export function tokenFrom(request) {
    const bearer = request.headers.get("authorization");
    if (bearer?.startsWith("Bearer "))
        return bearer.slice(7);
    return request.headers
        .get("cookie")
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith(`${COOKIE}=`))
        ?.slice(COOKIE.length + 1);
}
export function authenticate(request, state) {
    const token = tokenFrom(request);
    if (!token)
        throw new ApiError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
    try {
        const payload = jwt.verify(token, secret(), {
            algorithms: ["HS256"],
            issuer: "next-study",
            audience: "next-study",
        });
        const user = state.users.find((u) => String(u.id) === payload.sub);
        if (!user || !payload.jti || state.revoked.includes(payload.jti))
            throw new Error("invalid session");
        return { user, jti: payload.jti };
    }
    catch (error) {
        if (error instanceof ApiError)
            throw error;
        throw new ApiError(401, "UNAUTHORIZED", "세션이 만료되었거나 유효하지 않습니다.");
    }
}
export function sessionCookie(token, maxAge = 3600) {
    return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function protectOrigin(request) {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method))
        return;
    const expected = process.env.APP_ORIGIN ?? new URL(request.url).origin;
    const origin = request.headers.get("origin");
    if (origin && origin !== expected)
        throw new ApiError(403, "FORBIDDEN", "허용되지 않은 출처입니다.");
    if (!origin && tokenFrom(request) && !request.headers.get("authorization"))
        throw new ApiError(403, "FORBIDDEN", "쿠키 쓰기 요청에는 Origin이 필요합니다.");
}
const attempts = new Map();
export function rateLimit(key, max = 30) {
    const now = Date.now();
    for (const [k, v] of attempts)
        if (v.until <= now)
            attempts.delete(k);
    const entry = attempts.get(key) ?? { count: 0, until: now + 60_000 };
    if (++entry.count > max)
        throw new ApiError(429, "RATE_LIMITED", "잠시 후 다시 시도하세요.");
    attempts.set(key, entry); // 단일 프로세스 학습용. 복제 배포에서는 공유 저장소로 바꾼다.
}
