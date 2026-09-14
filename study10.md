# study10 — 고급 5: 빌드와 배포

로컬 `next dev`는 학습용입니다. 사용자에게 보여 줄 때는 **빌드한 결과**를 실행합니다.

---

## 1. 프로덕션 빌드

```powershell
cd tsx_version/demo
npm run build
npm run start
```

| 명령 | 역할 |
|---|---|
| `next build` | 서버 컴포넌트/페이지를 미리 분석해 `.next/`에 출력. 타입 에러도 여기서 남 |
| `next start` | 그 결과로 Node 서버. `dev`가 아님 |

`next.config`에 `output: "standalone"`을 넣었습니다. 빌드 후 `.next/standalone`에 **의존성까지 포함한** 작은 서버 폴더가 생깁니다. Docker가 이걸 복사합니다.

## 2. 환경 변수

Vercel/서버에 `JWT_SECRET`을 반드시 넣습니다. `.env.example`이 목록입니다. `NEXT_PUBLIC_`이 아닌 값은 브라우저로 안 내려갑니다.

## 3. Vercel

1. GitHub에 이 저장소를 올리고 Vercel에 import
2. Root Directory를 `tsx_version/demo`(또는 jsx)로
3. Environment Variables에 `JWT_SECRET`
4. 배포. App Router를 아는 호스트라서 설정이 거의 없습니다

JSON 파일 저장소는 서버리스에서 **쓰기가 휘발**될 수 있습니다. 학습용 demo는 로컬/Docker가 맞고, 진짜 배포는 `studyFinal`의 SQLite 또는 외부 DB가 맞습니다.

## 4. Docker

```powershell
cd tsx_version/demo
docker build -t nextjs-demo .
docker run --rm -p 3000:3000 -e JWT_SECRET=super-secret nextjs-demo
```

멀티 스테이지:

1. `npm ci` 로 의존성
2. `npm run build`
3. standalone + `static` + `public` + `data`만 최종 이미지에

이미지 안에 소스 전체와 `node_modules` 전체를 넣지 않습니다.

## 5. 확인

```powershell
npm run build
```

라우트 표에 `/`, `/posts`, `/api/posts` 등이 출력되면 됩니다. 에러 없이 끝나면 `demo/` 실습은 여기까지입니다.

다음: [studyFinal.md](studyFinal.md) — 같은 기술을 **학습 노트 웹사이트**로, 폴더 구조와 저장소를 바꿔 다시 만듭니다.
