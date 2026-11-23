import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "./domain";
import { getRepository } from "./repository";
import { issueToken, sessionCookie } from "./security";
export async function oauth(request) {
    if (request.method !== "GET")
        throw new ApiError(405, "METHOD_NOT_ALLOWED", "GET만 지원합니다.");
    const clientId = process.env.GITHUB_CLIENT_ID, clientSecret = process.env.GITHUB_CLIENT_SECRET, origin = process.env.APP_ORIGIN;
    if (!clientId || !clientSecret || !origin)
        throw new ApiError(503, "CONFIG_REQUIRED", "GitHub OAuth 설정이 필요합니다.");
    const url = new URL(request.url), callback = `${origin}/api/oauth/callback`;
    const options = `Path=/api/oauth; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
    if (url.pathname.endsWith("/start")) {
        const state = randomBytes(32).toString("hex"), verifier = randomBytes(32).toString("base64url");
        const target = new URL("https://github.com/login/oauth/authorize");
        target.search = new URLSearchParams({
            client_id: clientId,
            redirect_uri: callback,
            state,
            scope: "read:user",
            code_challenge: createHash("sha256").update(verifier).digest("base64url"),
            code_challenge_method: "S256",
        }).toString();
        const headers = new Headers({ Location: target.href });
        headers.append("Set-Cookie", `course_oauth_state=${state}; ${options}`);
        headers.append("Set-Cookie", `course_oauth_verifier=${verifier}; ${options}`);
        return new Response(null, { status: 302, headers });
    }
    const cookies = Object.fromEntries((request.headers.get("cookie") ?? "")
        .split(";")
        .map((p) => p.trim().split("=")));
    if (!url.searchParams.get("code") ||
        !cookies.course_oauth_state ||
        cookies.course_oauth_state !== url.searchParams.get("state") ||
        !cookies.course_oauth_verifier)
        throw new ApiError(400, "BAD_REQUEST", "OAuth state 또는 code가 유효하지 않습니다.");
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code: url.searchParams.get("code"),
            redirect_uri: callback,
            code_verifier: cookies.course_oauth_verifier,
        }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token)
        throw new ApiError(502, "UPSTREAM_ERROR", "OAuth 토큰 교환에 실패했습니다.");
    const profileResponse = await fetch("https://api.github.com/user", {
        signal: AbortSignal.timeout(10_000),
        headers: {
            Authorization: `Bearer ${token.access_token}`,
            Accept: "application/vnd.github+json",
        },
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !Number.isInteger(profile.id))
        throw new ApiError(502, "UPSTREAM_ERROR", "OAuth 사용자 확인에 실패했습니다.");
    const user = await (await getRepository()).change((state) => {
        const existing = state.users.find((u) => u.githubId === profile.id);
        if (existing)
            return existing;
        // 이메일로 기존 계정과 자동 연결하지 않는다. 공급자의 불변 id로 식별한다.
        const created = {
            id: ++state.seq,
            githubId: profile.id,
            email: `github-${profile.id}@oauth.invalid`,
            nickname: String(profile.login).slice(0, 40),
            passwordHash: "oauth-only",
        };
        state.users.push(created);
        return created;
    });
    const headers = new Headers({ Location: `${origin}/board` });
    headers.append("Set-Cookie", sessionCookie(issueToken(user.id)));
    headers.append("Set-Cookie", `course_oauth_state=; ${options.replace("Max-Age=600", "Max-Age=0")}`);
    headers.append("Set-Cookie", `course_oauth_verifier=; ${options.replace("Max-Age=600", "Max-Age=0")}`);
    return new Response(null, { status: 302, headers });
}
