# Next.js 단일 프레임워크 학습 과정

[노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)을 기준으로 study0~10 → studyMidpoint → study11~18 → studyFinal의 **21개 문서**와 JSX·TSX 실행 코드를 정리했다. 기존 study 파일은 같은 이름에 덮어썼다. 다른 프레임워크와의 비교·통합은 이번 과정에서 수행하지 않는다. 노션 원문 체크 7개는 해당 단계에 그대로 넣었고 범위와 충돌하는 추가 체크 3개는 [studyFinal 마지막](studyFinal.md#마지막-모음--노션에서-이번-범위에-넣지-못한-항목)에 보존했다.

## 실행

~~~powershell
cd tsx_version/demo
npm ci
Copy-Item .env.example .env.local
# JWT_SECRET에 32바이트 이상 난수를 설정한다.
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npm run dev
~~~

기준 버전은 Node 24.14.0 / npm 11.9.0 / Next.js 16.4.6 / React 19.2.8이다. 새로 받은 저장소에서는 create-next-app을 다시 실행하지 않는다. 비밀값은 .env.local에서만 관리한다.

| 앱 | 역할 |
|---|---|
| tsx_version/demo · jsx_version/demo | midpoint 기초 게시판. core API 진입점 |
| tsx_version/project · jsx_version/project | final 문서·AI 작업실. core + 심화 entry |

| 경로 | 내용 |
|---|---|
| /lab | Hello·props·상태·로컬 초안·공개 캐시 |
| /board | 가입·로그인·게시글·댓글·검색·페이지네이션 |
| /workbench | project에서 사용하는 문서·AI·작업·SSE·외부 서비스 |
| /health | DB 연결 상태 |
| /api-docs · /api/openapi | OpenAPI 3 읽기·JSON 다운로드 |

기존 /posts(JSON 게시판)·/notes(SQLite 노트)는 이전 실습 기록으로 보존한다. 새 v1 서비스의 data/course.db와 서로 다른 데이터다. 기존 인증도 JWT_SECRET 설정을 요구하도록 보완했고 운영에서는 기본 데모 계정을 자동 생성하지 않는다.

## 학습 순서

| 문서 | 주제 |
|---|---|
| [study0.md](study0.md) | 환경 설정과 실행 준비 |
| [study1.md](study1.md) | Hello World와 JSX 기본 문법 |
| [study2.md](study2.md) | 컴포넌트와 서버·클라이언트 경계 |
| [study3.md](study3.md) | 상태·바인딩·로컬 초안 저장 |
| [study4.md](study4.md) | 라우팅·요청·오류 화면 |
| [study5.md](study5.md) | 폼·검증·중복 제출 방지 |
| [study6.md](study6.md) | SQLite·공통 API v1·CRUD |
| [study7.md](study7.md) | 인증·작성자 권한·보안 기초 |
| [study8.md](study8.md) | 구조화·재사용·환경 분리 |
| [study9.md](study9.md) | 테스트·디버깅·오류 TOP 10 |
| [study10.md](study10.md) | 빌드·배포·기초 총정리 |
| [studyMidpoint.md](studyMidpoint.md) | 중간 응용 — 로그인 게시판 |
| [study11.md](study11.md) | DB 확장 — PostgreSQL·MariaDB·MongoDB |
| [study12.md](study12.md) | UI·상태·폼 라이브러리 연동 |
| [study13.md](study13.md) | 결제·메일·파일·OAuth 외부 서비스 |
| [study14.md](study14.md) | REST·OpenAPI·버전·오류 규칙 |
| [study15.md](study15.md) | 성능·캐시·비동기 작업 |
| [study16.md](study16.md) | 운영·Docker·GitHub Actions·백업 |
| [study17.md](study17.md) | 실시간 알림·WebSocket·파일 확장 |
| [study18.md](study18.md) | AI 모델 API·프롬프트·스트리밍·MCP |
| [studyFinal.md](studyFinal.md) | 심화 응용 — 문서·AI 학습 서비스 |

모든 문서는 목표·이론·전체 실습 코드와 줄별 설명·연동·오류·직접 해보기·빈 체크리스트·다음 단계 연결을 포함한다. 체크는 학습자가 수행하며, 자동 검증 상태와 섞지 않는다.

## 검증과 운영 명령

앱 디렉터리에서 npm run lint, npm test, npm run build, npm run test:http를 실행한다. project에서는 npm run mcp:client, npm run worker, npm run backup도 사용한다. JS와 TS의 기능은 같고 TS project의 src/course가 원본이다. 루트에서 node scripts/sync-course.mjs, node scripts/configure-course.mjs, node scripts/sync-support.mjs로 동기화한다. 문서는 node scripts/generate-study.mjs로 실제 코드 전체와 줄별 설명을 반영하고 node scripts/verify-study.mjs로 구조·원문 체크·코드 일치를 확인한다.

[검증 기록](docs/validation.md) · [노션 반영표](docs/notion-coverage.json) · [운영·배포](study16.md)

## 구현 범위와 실행 조건

기본 SQLite와 v1 API·보안·텍스트 문서·작업 큐·SSE·AI 통신 mock·MCP 도구는 로컬 검증 대상이다. PostgreSQL·MariaDB·MongoDB 드라이버, 메일·Stripe 테스트 결제·GitHub OAuth, 실모델 호출 코드는 설정 가능하게 준비했다. 실제 서버 DB·Docker 엔진·외부 계정·원격 배포와 복원은 해당 환경에서 따로 확인한다. AI mock은 명시적 테스트 모드이며 live 호출 성공으로 계산하지 않는다. 유료 권한 부여, PDF/OCR·벡터 RAG, 대규모 정규화 저장소는 구현했다고 주장하지 않는다.

## 공식 참고

- [Next.js App Router](https://nextjs.org/docs/app) · [Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy): Proxy 명칭은 Next.js 16부터 적용된다.
- [AI SDK streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) · [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Stripe 웹훅](https://docs.stripe.com/webhooks) · [Resend 이메일 API](https://resend.com/docs/api-reference/emails/send-email) · [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Prisma DB 커넥터](https://www.prisma.io/docs/orm/overview/databases): labs/prisma는 Prisma 6 설정 차이 실습이며 앱 런타임은 직접 드라이버다.
