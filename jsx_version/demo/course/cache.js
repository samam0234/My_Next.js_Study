import { unstable_cache } from "next/cache";
// 공개된 개념 설명만 캐시한다. 쿠키·세션·개인 문서는 이 함수에 넣지 않는다.
export const readGlossary = unstable_cache(async () => ({
    routing: "폴더와 page가 URL을 만든다.",
    generatedAt: new Date().toISOString(),
}), ["public-glossary-v1"], { revalidate: 60, tags: ["glossary"] });
