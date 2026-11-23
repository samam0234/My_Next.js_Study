"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { authenticate, COOKIE } from "./security";
import { text } from "./domain";
import { getRepository } from "./repository";
// 버튼 숨김·proxy를 신뢰하지 않는다. Action 자체에서 세션과 필드 검사를 반복한다.
export async function addQuickPost(form) {
    const token = (await cookies()).get(COOKIE)?.value;
    const request = new Request("http://internal/action", {
        headers: { cookie: `${COOKIE}=${token ?? ""}` },
    });
    const title = text(form.get("title"), "title", 200), body = text(form.get("body"), "body", 20_000);
    await (await getRepository()).change((state) => {
        const { user } = authenticate(request, state), now = new Date().toISOString();
        state.posts.push({
            id: ++state.seq,
            title,
            body,
            tags: [],
            authorId: user.id,
            createdAt: now,
            updatedAt: now,
        });
    });
    revalidatePath("/board");
}
