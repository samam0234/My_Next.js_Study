# study9 — 고급 4: 환경 변수, 이미지, 메타데이터

배포 전에 비밀값과 "탭 제목/미리보기/이미지"를 정리합니다.

---

## 1. 환경 변수

`.env.example`만 Git에 올립니다. 실제 비밀은 `.env.local` (gitignore).

```
JWT_SECRET=replace-me-in-production
```

- 접두사 없음 → **서버만**. `lib/auth`의 `process.env.JWT_SECRET`
- `NEXT_PUBLIC_` → 브라우저 번들에 박힘. 공개돼도 되는 값만.

`next dev`는 `.env.local`을 읽고, 값을 바꾼 뒤에는 서버를 재시작합니다. 코드에서 `process.env.JWT_SECRET`은 빌드 시점에 인라인될 수 있으니 프로덕션 비밀은 호스트(Vercel 환경 변수)에 둡니다.

개발 중 변수를 안 넣으면 `dev-secret-change-me`로 동작합니다. 배포에서는 반드시 바꿉니다.

## 2. `next/image`

홈의 Next 로고는 `<img>`가 아니라 `next/image`입니다.

- 로컬 파일은 `public/next.svg` → `src="/next.svg"`
- `width`/`height` 필수 (레이아웃 시프트 방지)
- `priority` — LCP(첫 화면 큰 이미지)에만. 목록의 작은 썸네일에는 빼기

외부 URL을 쓰려면 `next.config`의 `images.remotePatterns`에 호스트를 적습니다. 이번 실습은 `public/`만 씁니다.

## 3. Metadata API

루트 레이아웃:

```ts
export const metadata = {
  title: { default: "Next.js 실습 데모", template: "%s · Next.js 실습" },
  description: "...",
}
```

글 상세는 서버에서 글을 읽은 뒤 제목을 만듭니다.

```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost((await params).id)
  if (!post) return { title: "글을 찾을 수 없음" }
  return { title: post.title, description: post.body.slice(0, 80) }
}
```

탭 제목이 글 제목으로 바뀌고, 카톡/슬랙 링크 미리보기의 `og:title`에도 쓰입니다. SPA는 JS가 실행된 뒤에야 제목을 바꿀 수 있어서 크롤러가 빈 제목을 보는 일이 많습니다.

## 4. 확인

- 홈 소스에 `/_next/image` 또는 최적화된 이미지 URL
- `/posts/1`의 `<title>`에 글 제목
- `.env.example`은 있고 `.env.local`은 커밋되지 않음

다음: [study10.md](study10.md) — 프로덕션 빌드와 배포.
