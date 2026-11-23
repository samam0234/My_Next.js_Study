# study0 — 환경 설정과 실행 준비

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

Next.js 앱을 설치하고 Git·환경변수를 분리해 개발 서버를 실행한다.

## ② 📖 이론

Next.js는 URL에 대응하는 화면과 HTTP 응답을 같은 앱에서 만드는 프레임워크다. Node.js는 서버 실행기, npm은 의존성 설치 도구, package-lock.json은 설치 버전을 재현하는 명세다. 이번 저장소의 기준은 Node 24.14.0과 Next.js 16.4.6이다.

프로젝트를 식당에 비유하면 app은 손님에게 보이는 메뉴, Route Handler는 주문 접수 창구, 서버 모듈은 주방이다. App Router는 app 폴더 이름으로 URL을 정하고 page 파일로 화면을 공개한다.

개발 모드는 파일 변경을 빠르게 반영한다. build는 배포용 결과물을 만들고 start는 그 결과물을 실행한다. .env.local은 서버 접속 정보와 비밀키를 담으므로 Git에서 제외한다. NEXT_PUBLIC_ 접두사는 브라우저 공개를 뜻한다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. nodejs.org의 공식 다운로드에서 Node 24 LTS를 설치한 뒤 새 터미널에서 node -v, npm -v를 확인한다. 이 저장소의 실검증 버전은 24.14.0 / 11.9.0이다.
2. 기존 저장소에서는 생성 명령을 다시 실행하지 않는다. tsx_version/demo로 이동해 npm ci를 실행한다. 새 빈 연습 폴더를 만들 때만 create-next-app 명령을 쓴다.
3. .env.example을 .env.local로 복사하고 JWT_SECRET에 암호학적 난수 32바이트 이상을 설정한다. 개발 URL을 APP_ORIGIN과 맞춘다.
4. VS Code에서 ESLint, Prettier, Tailwind CSS IntelliSense 확장을 설치한다. TypeScript는 VS Code 내장 기능을 사용한다.
5. 개발 서버를 열어 /lab에 접속한다. Git 상태에서 .env.local과 DB 파일이 보이지 않는지 확인한다.

~~~powershell
node -v
npm -v
git status --short
cd tsx_version/demo
npm ci
Copy-Item .env.example .env.local
# 아래 출력값을 .env.local의 JWT_SECRET에 붙인다. 공유 로그에는 남기지 않는다.
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npm run dev
# 새 빈 폴더를 위한 생성 예시(기존 demo에 실행 금지)
# npx create-next-app@16.4.6 next-sandbox --ts --app --eslint --use-npm --disable-git --yes
~~~

### 폴더와 용어

| 경로·용어 | 역할 |
|---|---|
| app/page.tsx · app/layout.tsx | 화면과 공통 HTML 껍데기 |
| app/api/.../route.ts | HTTP 요청 처리 |
| public | 정적 파일 |
| course | 과정에서 사용하는 기능 모듈 |
| node_modules · .next | 설치·빌드 산출물, Git 제외 |
| JSX / TSX | JavaScript 표현식을 넣는 화면 문법 / 타입을 추가한 문법 |
| RSC / hydration | 서버 컴포넌트 결과 / 초기 HTML에 브라우저 이벤트 연결 |

새 저장소라면 루트에서 git init 후 git add .gitignore README.md, git commit을 실행한다. 이 저장소는 이미 origin이 있으므로 git init을 반복할 필요가 없다. GitHub에 빈 저장소를 만든 후에만 git remote add origin을 사용한다.

### .gitignore

[실행 파일](.gitignore)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:.gitignore sha256:12aafa09b7272fc92719ee43bd080c3b80853db68906de4bcc5844f161aaa48d -->
~~~text
# dependencies
**/node_modules/

# next.js
**/.next/
**/.turbo/
**/out/

# build
**/dist/
**/build/
**/*.tsbuildinfo

# env
**/.env
**/.env.*
!**/.env.example

# db / local data dumps
**/*.sqlite
**/*.sqlite3
**/*.db
**/*.db-wal
**/*.db-shm
**/backups/
**/test-results/

# uploaded files
**/uploads/*
!**/uploads/.gitkeep

# test / coverage
**/coverage/

# logs
**/npm-debug.log*
**/*.log

# editor
.vscode/*
!.vscode/extensions.json

# OS
.DS_Store
Thumbs.db
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 현재 구문에서 다음 값·인자·표현식을 연결한다: # dependencies |
| 2 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/node_modules/ |
| 4 | 현재 구문에서 다음 값·인자·표현식을 연결한다: # next.js |
| 5 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/.next/ |
| 6 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/.turbo/ |
| 7 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/out/ |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: # build |
| 10 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/dist/ |
| 11 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/build/ |
| 12 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/*.tsbuildinfo |
| 14 | 현재 구문에서 다음 값·인자·표현식을 연결한다: # env |
| 15 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/.env |
| 16 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/.env.* |
| 17 | 현재 구문에서 다음 값·인자·표현식을 연결한다: !**/.env.example |
| 19 | 현재 구문에서 다음 값·인자·표현식을 연결한다: # db / local data dumps |
| 20 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/*.sqlite |
| 21 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/*.sqlite3 |
| 22 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/*.db |
| 23 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/*.db-wal |
| 24 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/*.db-shm |
| 25 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/backups/ |
| 26 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/test-results/ |
| 28 | 현재 구문에서 다음 값·인자·표현식을 연결한다: # uploaded files |
| 29 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/uploads/* |
| 30 | 현재 구문에서 다음 값·인자·표현식을 연결한다: !**/uploads/.gitkeep |
| 32 | 현재 구문에서 다음 값·인자·표현식을 연결한다: # test / coverage |
| 33 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/coverage/ |
| 35 | 현재 구문에서 다음 값·인자·표현식을 연결한다: # logs |
| 36 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/npm-debug.log* |
| 37 | 현재 구문에서 다음 값·인자·표현식을 연결한다: **/*.log |
| 39 | 현재 구문에서 다음 값·인자·표현식을 연결한다: # editor |
| 40 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .vscode/* |
| 41 | 현재 구문에서 다음 값·인자·표현식을 연결한다: !.vscode/extensions.json |
| 43 | 현재 구문에서 다음 값·인자·표현식을 연결한다: # OS |
| 44 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .DS_Store |
| 45 | 현재 구문에서 다음 값·인자·표현식을 연결한다: Thumbs.db |

### tsx_version/demo/.env.example

[실행 파일](tsx_version/demo/.env.example)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/.env.example sha256:2416b41af6c1e5a5bf57153650cc37b24af6d7d80db1eeeedaab1ad7205351d5 -->
~~~text
# 이 파일을 .env.local로 복사하고 JWT_SECRET을 직접 생성하세요.
JWT_SECRET=
APP_ORIGIN=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
DB_DRIVER=sqlite
COURSE_DB_PATH=data/course.db
DATABASE_URL=
AI_MODE=live
AI_GATEWAY_API_KEY=
AI_MODEL=openai/gpt-5.4
RESEND_API_KEY=
MAIL_FROM=
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 현재 구문에서 다음 값·인자·표현식을 연결한다: # 이 파일을 .env.local로 복사하고 JWT_SECRET을 직접 생성하세요. |
| 2 | 현재 구문에서 다음 값·인자·표현식을 연결한다: JWT_SECRET= |
| 3 | 현재 구문에서 다음 값·인자·표현식을 연결한다: APP_ORIGIN=http://localhost:3000 |
| 4 | 현재 구문에서 다음 값·인자·표현식을 연결한다: CORS_ORIGIN=http://localhost:3000 |
| 5 | 현재 구문에서 다음 값·인자·표현식을 연결한다: DB_DRIVER=sqlite |
| 6 | 현재 구문에서 다음 값·인자·표현식을 연결한다: COURSE_DB_PATH=data/course.db |
| 7 | 현재 구문에서 다음 값·인자·표현식을 연결한다: DATABASE_URL= |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: AI_MODE=live |
| 9 | 현재 구문에서 다음 값·인자·표현식을 연결한다: AI_GATEWAY_API_KEY= |
| 10 | 현재 구문에서 다음 값·인자·표현식을 연결한다: AI_MODEL=openai/gpt-5.4 |
| 11 | 현재 구문에서 다음 값·인자·표현식을 연결한다: RESEND_API_KEY= |
| 12 | 현재 구문에서 다음 값·인자·표현식을 연결한다: MAIL_FROM= |
| 13 | 현재 구문에서 다음 값·인자·표현식을 연결한다: STRIPE_SECRET_KEY= |
| 14 | 현재 구문에서 다음 값·인자·표현식을 연결한다: STRIPE_PRICE_ID= |
| 15 | 현재 구문에서 다음 값·인자·표현식을 연결한다: STRIPE_WEBHOOK_SECRET= |
| 16 | 현재 구문에서 다음 값·인자·표현식을 연결한다: GITHUB_CLIENT_ID= |
| 17 | 현재 구문에서 다음 값·인자·표현식을 연결한다: GITHUB_CLIENT_SECRET= |

### tsx_version/demo/package.json

[실행 파일](tsx_version/demo/package.json)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/demo/package.json sha256:5e73858acb2c699854432b3113e9161f78fd668cdfd458372262db6cee1494a8 -->
~~~json
{
  "name": "demo",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "node --import tsx --test tests/*.test.ts",
    "test:http": "node scripts/http-smoke.mjs",
    "worker": "node --env-file-if-exists=.env.local --import tsx course/worker.ts --once",
    "mcp:server": "node --import tsx course/mcp-server.ts --stdio",
    "mcp:client": "node --import tsx course/mcp-client.ts",
    "backup": "node --env-file-if-exists=.env.local scripts/backup.mjs"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.32.2",
    "@radix-ui/react-dialog": "^1.3.1",
    "ai": "^7.0.179",
    "bcryptjs": "^3.0.3",
    "jsonwebtoken": "^9.0.3",
    "mongodb": "^7.9.1",
    "mysql2": "^3.24.6",
    "next": "^16.4.6",
    "pg": "^8.23.1",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "react-hook-form": "^7.92.0",
    "ws": "^8.23.0",
    "zod": "^4.6.7",
    "zustand": "^5.1.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^24",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "^16.4.6",
    "tailwindcss": "^4",
    "typescript": "^5",
    "@types/pg": "^8.23.1",
    "tsx": "^4.23.15",
    "@types/ws": "^8.18.2"
  },
  "type": "module",
  "engines": {
    "node": ">=24.14.0"
  }
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { |
| 2 | 객체·스키마·속성의 값을 지정한다: "name": "demo", |
| 3 | 객체·스키마·속성의 값을 지정한다: "version": "0.1.0", |
| 4 | 객체·스키마·속성의 값을 지정한다: "private": true, |
| 5 | 객체·스키마·속성의 값을 지정한다: "scripts": { |
| 6 | 객체·스키마·속성의 값을 지정한다: "dev": "next dev", |
| 7 | 객체·스키마·속성의 값을 지정한다: "build": "next build", |
| 8 | 객체·스키마·속성의 값을 지정한다: "start": "next start", |
| 9 | 객체·스키마·속성의 값을 지정한다: "lint": "eslint", |
| 10 | 객체·스키마·속성의 값을 지정한다: "test": "node --import tsx --test tests/*.test.ts", |
| 11 | 객체·스키마·속성의 값을 지정한다: "test:http": "node scripts/http-smoke.mjs", |
| 12 | 객체·스키마·속성의 값을 지정한다: "worker": "node --env-file-if-exists=.env.local --import tsx course/worker.ts --once", |
| 13 | 객체·스키마·속성의 값을 지정한다: "mcp:server": "node --import tsx course/mcp-server.ts --stdio", |
| 14 | 객체·스키마·속성의 값을 지정한다: "mcp:client": "node --import tsx course/mcp-client.ts", |
| 15 | 객체·스키마·속성의 값을 지정한다: "backup": "node --env-file-if-exists=.env.local scripts/backup.mjs" |
| 16 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 17 | 객체·스키마·속성의 값을 지정한다: "dependencies": { |
| 18 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "@modelcontextprotocol/sdk": "^1.32.2", |
| 19 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "@radix-ui/react-dialog": "^1.3.1", |
| 20 | 객체·스키마·속성의 값을 지정한다: "ai": "^7.0.179", |
| 21 | 객체·스키마·속성의 값을 지정한다: "bcryptjs": "^3.0.3", |
| 22 | 객체·스키마·속성의 값을 지정한다: "jsonwebtoken": "^9.0.3", |
| 23 | 객체·스키마·속성의 값을 지정한다: "mongodb": "^7.9.1", |
| 24 | 객체·스키마·속성의 값을 지정한다: "mysql2": "^3.24.6", |
| 25 | 객체·스키마·속성의 값을 지정한다: "next": "^16.4.6", |
| 26 | 객체·스키마·속성의 값을 지정한다: "pg": "^8.23.1", |
| 27 | 객체·스키마·속성의 값을 지정한다: "react": "19.2.8", |
| 28 | 객체·스키마·속성의 값을 지정한다: "react-dom": "19.2.8", |
| 29 | 객체·스키마·속성의 값을 지정한다: "react-hook-form": "^7.92.0", |
| 30 | 객체·스키마·속성의 값을 지정한다: "ws": "^8.23.0", |
| 31 | 객체·스키마·속성의 값을 지정한다: "zod": "^4.6.7", |
| 32 | 객체·스키마·속성의 값을 지정한다: "zustand": "^5.1.0" |
| 33 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 34 | 객체·스키마·속성의 값을 지정한다: "devDependencies": { |
| 35 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "@tailwindcss/postcss": "^4", |
| 36 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "@types/bcryptjs": "^2.4.6", |
| 37 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "@types/jsonwebtoken": "^9.0.10", |
| 38 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "@types/node": "^24", |
| 39 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "@types/react": "^19", |
| 40 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "@types/react-dom": "^19", |
| 41 | 객체·스키마·속성의 값을 지정한다: "eslint": "^9", |
| 42 | 객체·스키마·속성의 값을 지정한다: "eslint-config-next": "^16.4.6", |
| 43 | 객체·스키마·속성의 값을 지정한다: "tailwindcss": "^4", |
| 44 | 객체·스키마·속성의 값을 지정한다: "typescript": "^5", |
| 45 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "@types/pg": "^8.23.1", |
| 46 | 객체·스키마·속성의 값을 지정한다: "tsx": "^4.23.15", |
| 47 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "@types/ws": "^8.18.2" |
| 48 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 49 | 객체·스키마·속성의 값을 지정한다: "type": "module", |
| 50 | 객체·스키마·속성의 값을 지정한다: "engines": { |
| 51 | 객체·스키마·속성의 값을 지정한다: "node": ">=24.14.0" |
| 52 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 53 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

## ④ 🔗 연동 포인트

.env.local → 서버 모듈 → DB/API 연결이다. 공개 URL만 NEXT_PUBLIC_로 내보낸다. 다음 단계에서는 /lab의 첫 화면을 바꾼다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| node를 찾을 수 없음 | 설치 후 PATH가 갱신되지 않음 | 터미널을 다시 열고 node -v 확인 |
| EADDRINUSE | 3000 포트 사용 중 | npm run dev -- --port 3001, APP_ORIGIN도 변경 |
| 설정했는데 503 | JWT_SECRET이 비었거나 32자 미만 | .env.local 수정 후 서버 재시작 |

## ⑥ 직접 해보기

1. 별도 빈 폴더에 앱을 생성하고 app, public, 설정 파일의 역할을 설명한다.
2. 포트를 3001로 바꾸고 APP_ORIGIN을 맞춰 /lab을 연다.
3. git check-ignore .env.local data/course.db로 비밀과 데이터가 제외되는지 확인한다.

## ⑦ ☐ 체크리스트

- [ ] 설치 버전과 실행 경로를 확인했다.
- [ ] 개발 서버와 build/start의 차이를 설명할 수 있다.
- [ ] .env.local은 제외하고 .env.example만 커밋한다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study1](study1.md)에서 서버에서 첫 화면을 그리고 JSX 표현식·조건·반복을 이해한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
