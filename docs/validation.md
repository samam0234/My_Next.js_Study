# 검증 기록

기준일: 2026-11-23 (Asia/Seoul). Node 24.14.0, npm 11.9.0, Next.js 16.4.6에서 실행했다. 문서·코드 작성, 자동 테스트, 외부 환경 검증을 구분한다.

| 항목 | 현재 상태 | 증거·조건 |
|---|---|---|
| 노션 전체 본문·관련 명세 읽기 | 확인 | Next.js 본문, 공통 API v1, 미니 프로젝트 목록, DocuForge, ReviewForge |
| 21개 문서와 전체 코드·줄별 설명 | 작성 | study0~18, studyMidpoint, studyFinal |
| 원문 체크 매핑 | 작성 | 7개 해당 단계, 충돌 3개 마지막 제외 목록 |
| SQLite·API·보안·MCP | 통과 | 네 앱 각각 25개 테스트. 동시 가입·두 사용자 소유권·CSRF·위조 JWT·웹훅 서명/중복·OAuth mock 포함 |
| Next.js 프로덕션 빌드 | 통과 | JSX·TSX의 demo/project 네 앱 모두 성공 |
| ESLint | 통과 | 네 앱 모두 오류·경고 0 |
| 실제 HTTP 경로·CRUD·쿠키·서버 DB·proxy | 통과 | 네 앱 모두 실제 Next start로 가입·로그인·글/댓글·서버 DB 직접 조회·로그아웃 후 접근 차단 |
| AI mock·SSE 실제 HTTP | 통과 | project 두 앱에서 스트림과 알림 content-type 및 수신 확인. demo HTTP에는 심화 기능을 연결하지 않음 |
| MCP stdio 클라이언트 | 통과 | tools/list와 explain_next 호출 응답 |
| 의존성 audit | 통과 | 최종 네 앱 npm audit --omit=dev --audit-level=high: 0 vulnerabilities |
| 전체 문서 검증 | 통과 | 21문서·공통 8구성·연습 2~3개·전체 코드 108개 원본 일치·노션 체크 7개/제외 3개 |
| Prisma 6 설정 실습 | 통과 | 6.19.0 validate로 SQLite/PostgreSQL/MariaDB/MongoDB 네 스키마 구문 확인. 실접속 시험과는 다름 |
| Compose 설정 | 통과 | config --no-interpolate --no-env-resolution --quiet. env 값·엔진·기동 검증과는 다름 |
| SQLite 백업·스냅샷 이관 | 통과 | 온라인 backup 결과 원본 일치, export→빈 SQLite import 뒤 전체 상태 일치 |
| Docker·컨테이너 서버 DB | 미검증 | Docker Desktop Linux 엔진 named pipe 없음 |
| PostgreSQL·MariaDB·MongoDB 실접속·이관 | 미검증 | 드라이버 구현·설정·이관 CLI 제공, DB 엔진 필요 |
| 메일·Stripe·OAuth 실제 계정 | 미검증 | 키 없음, HTTP mock과 서명/상태 검증만 수행 |
| AI live 호출·품질 평가 | 미검증 | AI_MODE=mock 통신 검증, 실제 모델 키 필요 |
| 원격 배포·HTTPS·서버 DB 복원 | 미검증 | workflow·배포·백업 코드 제공, 서버 설정 필요. 로컬 SQLite 복사·복원은 별도 통과 |
| 브라우저 화면 클릭 검증 | 미검증 | 브라우저 연결 호스트를 사용할 수 없고 Windows 현재 URL 확인도 실패하여 Computer Use가 중단됨. DOM 상호작용 통과로 주장하지 않음 |

테스트용 DB는 매 실행 UUID 파일로 만들어 학습자 데이터를 덮어쓰지 않는다. mock AI 결과는 실제 모델 품질이나 RAG 구현의 증거가 아니다. 메일·결제 mock은 실제 공급자 전송의 증거가 아니다. Docker config 검사와 실제 컨테이너 기동도 구분한다.

## 재현 명령

각 앱에서 다음을 실행한다.

```powershell
npm ci
npm run lint
npm test
npm run build
npm run test:http
npm audit --omit=dev --audit-level=high
```

TS project에서 `npm run mcp:client`, `node scripts/storage-check.mjs`도 확인했다. HTTP smoke는 앱별로 다른 loopback 포트를 사용한다. 검증 과정에서 Next의 route context가 내부 extension 인자로 잘못 전달되는 문제를 한 인자 어댑터로 수정했고, Node 24 타입과 SQLite 기본 저장소를 분리했다. project의 proxy는 src/app과 같은 수준인 src/proxy로 옮겼다.

학습자의 연습 체크와 실제 운영 체크는 비워 두었다. 코드가 준비됐다는 이유로 서버 DB·외부 계정·실모델·원격 배포 체크를 완료로 바꾸지 않았다. 문서와 코드 검증 후 노션에 이 결과와 문서 링크, 제외한 원문 3개를 반영했다.
