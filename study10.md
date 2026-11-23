# study10 — 빌드·배포·기초 총정리

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

프로덕션 빌드를 실행하고 HTTPS·환경변수·영속 DB 배포 조건을 점검한다.

## ② 📖 이론

build는 서버와 브라우저에 필요한 산출물을 만들고 start는 배포 모드로 실행한다. output=standalone은 필요한 서버 의존성을 추적해 복사한다. .next/static과 public은 별도 포함해야 한다.

도메인은 서버 주소를 가리키는 이름이고 DNS 레코드가 연결을 결정한다. HTTPS는 인증서로 서버 신원을 확인하고 전송을 암호화한다. 운영 쿠키의 Secure 속성은 HTTPS가 있어야 전송된다.

배포는 완성한 가게를 다른 건물에 옮기는 작업이다. 코드만 옮기면 끝나지 않고 비밀키, DB, 저장 공간, 도메인과 건강검사를 함께 맞춰야 한다. 서버리스 임시 파일에 SQLite를 두면 재배포 때 데이터를 잃을 수 있다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. 앱 폴더에서 lint, test, build를 실행한다. 빌드 성공과 실제 배포 성공은 별개로 기록한다.
2. npm run start -- --port 3000으로 실행하고 /health, /board, 가입·로그인을 확인한다.
3. 운영 호스트에 JWT_SECRET, APP_ORIGIN=https 도메인, DB_DRIVER와 DB 연결 정보를 주입한다.
4. SQLite면 영속 볼륨을 연결한다. 복제 서버를 쓸 때는 study11의 서버 DB를 선택한다.
5. 배포 후 작성·수정·삭제·로그아웃·재시작 후 데이터·오류 로그를 점검한다.

~~~powershell
cd tsx_version/demo
npm run lint
npm test
npm run build
npm run start -- --port 3000
# 별도 터미널
curl.exe -i http://localhost:3000/health
~~~

### 배포 후 점검표

- [ ] HTTPS 도메인과 APP_ORIGIN이 일치한다.
- [ ] 로그인 쿠키가 HttpOnly·SameSite·Secure다.
- [ ] /health가 실제 DB를 읽고 200이다.
- [ ] 다른 사용자 수정·삭제가 403이다.
- [ ] DB가 재시작·재배포 후 유지된다.
- [ ] 500 응답에 스택·접속 문자열이 없다.
- [ ] 백업 위치·복원 담당·되돌릴 이미지 태그를 기록했다.

기초 총정리: 환경 → JSX → 컴포넌트 → 상태 → URL → 폼 → DB/API → 인증 → 구조 → 테스트 → 배포 순서로 연결했다. 도메인 구매나 실제 호스트 배포는 실행하지 않았으며 운영 계정 설정 뒤 이 점검표로 확인한다.

### tsx_version/demo/next.config.ts

[실행 파일](tsx_version/demo/next.config.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/next.config.ts sha256:9939c59ed8cf2b67f3b955519d8fb69123f4aaf01e0cbe6241191732b2480483 -->
~~~ts
const nextConfig = { output: "standalone", serverExternalPackages: ["pg", "mysql2", "mongodb"], async headers() { return [{ source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "same-origin" }, { key: "X-Frame-Options", value: "DENY" }] }]; } };
export default nextConfig;
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const nextConfig = { output: "standalone", serverExternalPackages: ["pg", "mysql2", "mongodb"], async headers() { return [{ source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "same-origin" }, { key: "X-Frame-Options", value: "DENY" }] }]; } }; |
| 2 | 현재 구문에서 다음 값·인자·표현식을 연결한다: export default nextConfig; |

### tsx_version/demo/Dockerfile

[실행 파일](tsx_version/demo/Dockerfile)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/Dockerfile sha256:2641eb2a3b4da33ebf7120511649e49d984f62f19932771341be6b83b80019e3 -->
~~~dockerfile
FROM node:24.14.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM builder AS worker
USER node
CMD ["npm", "run", "worker"]

FROM node:24.14.0-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: FROM node:24.14.0-bookworm-slim AS dependencies |
| 2 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: WORKDIR /app |
| 3 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: COPY package.json package-lock.json ./ |
| 4 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: RUN npm ci |
| 6 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: FROM dependencies AS builder |
| 7 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: COPY . . |
| 8 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: ENV NEXT_TELEMETRY_DISABLED=1 |
| 9 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: RUN npm run build |
| 11 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: FROM builder AS worker |
| 12 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: USER node |
| 13 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: CMD ["npm", "run", "worker"] |
| 15 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: FROM node:24.14.0-bookworm-slim AS runner |
| 16 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: WORKDIR /app |
| 17 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 |
| 18 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: COPY --from=builder --chown=node:node /app/.next/standalone ./ |
| 19 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: COPY --from=builder --chown=node:node /app/.next/static ./.next/static |
| 20 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: COPY --from=builder --chown=node:node /app/public ./public |
| 21 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: RUN mkdir -p /app/data && chown node:node /app/data |
| 22 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: USER node |
| 23 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: EXPOSE 3000 |
| 24 | Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: CMD ["node", "server.js"] |

### tsx_version/demo/.dockerignore

[실행 파일](tsx_version/demo/.dockerignore)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/.dockerignore sha256:ecbb6b7c2f56f5eb18df47f662c8f7cc083ab232f7d2645822fbea9babc8c7e8 -->
~~~text
node_modules
.next
.env*
!.env.example
data
backups
*.log
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 현재 구문에서 다음 값·인자·표현식을 연결한다: node_modules |
| 2 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .next |
| 3 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .env* |
| 4 | 현재 구문에서 다음 값·인자·표현식을 연결한다: !.env.example |
| 5 | 현재 구문에서 다음 값·인자·표현식을 연결한다: data |
| 6 | 현재 구문에서 다음 값·인자·표현식을 연결한다: backups |
| 7 | 현재 구문에서 다음 값·인자·표현식을 연결한다: *.log |

## ④ 🔗 연동 포인트

기초 결과물은 midpoint의 로그인 게시판으로 합친다. Docker·자동 배포·백업의 상세 운영은 study16에서 이어진다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| start가 빌드를 못 찾음 | build 이전 실행 | npm run build부터 실행 |
| 로컬만 로그인 성공 | 운영 HTTPS·쿠키·APP_ORIGIN 불일치 | 도메인·Secure·Origin 정합 확인 |
| 재배포 후 글 없음 | 임시 DB 파일 사용 | 영속 볼륨 또는 서버 DB 연결 |

## ⑥ 직접 해보기

1. 다른 포트의 프로덕션 서버에서 health와 화면을 확인한다.
2. 배포 환경변수 이름만 적은 점검표를 작성한다.
3. 프로세스를 재시작하고 등록한 글이 남는지 확인한다.

## ⑦ ☐ 체크리스트

- [ ] 환경 변수, 배포
- [ ] build/start로 배포 모드를 확인했다.
- [ ] 도메인·HTTPS·영속 DB 조건과 배포 후 점검을 설명한다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[studyMidpoint](studyMidpoint.md)에서 study0~10의 기능만으로 회원·게시글·댓글이 있는 작은 서비스를 완성한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
