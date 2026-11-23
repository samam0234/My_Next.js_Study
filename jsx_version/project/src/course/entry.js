import { handle } from "./api";
import { protectOrigin } from "./security";
// 심화 기능은 project에서만 HTTP에 연결한다. demo의 게시판은 기초 과정만으로 실행된다.
export async function route(request) {
    return handle(request, async (request) => {
        const pathname = new URL(request.url).pathname.replace(/^\/api\/v1\//, "/api/");
        if (pathname.startsWith("/api/oauth/")) {
            const { oauth } = await import("./oauth");
            return oauth(request);
        }
        if (pathname === "/api/payments/webhook") {
            const { webhook } = await import("./services");
            return webhook(request);
        }
        if (/^\/api\/(ai|files|events|jobs|mail|payments)(\/|$)/.test(pathname)) {
            protectOrigin(request);
            const { advanced } = await import("./advanced");
            return advanced(request);
        }
        return null;
    });
}
