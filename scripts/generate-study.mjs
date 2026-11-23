import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chapters, demo, project } from './course-chapters.mjs';
const coverage = JSON.parse(fs.readFileSync('docs/notion-coverage.json', 'utf8'));
const guide = {
  'api.ts': '요청의 URL·메서드에 맞는 분기를 고른 뒤 모델 검증·세션·소유권·저장을 연결한다. 반환값은 공통 v1 계약이며 모든 실패는 handle의 failure 경로로 모인다.',
  'repository.ts': 'read는 현재 상태를 읽고 change는 원자적인 읽기·수정·쓰기를 제공한다. 드라이버별 잠금 또는 revision 비교가 동시 갱신의 유실을 막는다.',
  'board.tsx': '로그인·목록·선택 글·댓글·pending을 브라우저 상태로 관리한다. 폼에서 값을 읽고 api를 호출한 뒤 최신 목록과 상세를 다시 읽는다.',
  'workbench.tsx': '문서 초안은 Zustand, 질문 검증은 React Hook Form, 결제 안내는 Radix Dialog가 맡는다. AI stream reader와 EventSource를 서로 다른 통신 방식으로 정리한다.',
  'security.ts': '비밀번호·토큰·쿠키·Origin·호출 제한을 한 서버 모듈에서 처리한다. UI 상태를 신뢰하지 않고 API 요청마다 세션과 작성자를 검사한다.',
  'openapi.ts': 'OpenAPI 3의 paths·schemas·securitySchemes를 구성한다. 이 객체를 Route Handler에서 JSON으로 반환하고 /api-docs에서 읽는다.',
  'course.test.ts': '실제 Request와 임시 DB로 상태·응답·데이터 변화를 확인한다. 외부 fetch는 필요한 시험 안에서만 바꾸고 finally로 원복한다.',
};
function explain(line, file) {
  const s = line.trim();
  if (!s) return null;
  if (/^\/\//.test(s)) return `주석: ${s.replace(/^\/\/\s*/, '')}`;
  if (/^['"]use client/.test(s)) return '이 모듈과 하위 import를 브라우저 상호작용 경계로 선언한다.';
  if (/^['"]use server/.test(s)) return 'export한 비동기 함수를 서버에서 실행하는 Action으로 선언한다.';
  if (/^import\b/.test(s)) return `외부 모듈 또는 공용 함수·타입을 가져온다: ${s.replace(/^import\s*/, '')}`;
  if (/^export (type|interface)/.test(s)) return `다른 모듈이 공유할 데이터 구조를 선언한다: ${s}`;
  if (/^(export )?(async )?function /.test(s)) return `${s.match(/function\s+(\w+)/)?.[1] ?? '함수'}의 입력·반환 경계를 정의한다${s.includes('async') ? '. 비동기 I/O는 await로 완료를 기다린다.' : '.'}`;
  if (/^class |^export class /.test(s)) return '상태 코드·오류 code·필드 오류를 함께 전달할 오류 객체를 정의한다.';
  if (/throw new ApiError/.test(s)) return `요청 처리를 중단하고 공통 오류 응답에 상태·code·설명을 전달한다: ${s}`;
  if (/throw new Error/.test(s)) return `현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: ${s}`;
  if (/authenticate\(/.test(s)) return '현재 요청의 토큰·서명·만료·로그아웃 상태와 사용자 존재를 확인한다.';
  if (/protectOrigin\(/.test(s)) return '쿠키 쓰기 요청의 출처를 확인해 CSRF 경계를 적용한다.';
  if (/\.change\(/.test(s)) return 'Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다.';
  if (/BEGIN|beginTransaction/.test(s)) return 'DB 트랜잭션을 시작한다. SQLite는 쓰기 잠금을, 서버 SQL은 행 잠금을 사용한다.';
  if (/ROLLBACK|rollback/.test(s)) return '실패한 트랜잭션의 데이터 변경을 되돌린다.';
  if (/COMMIT|\.commit\(/.test(s)) return '검증을 마친 데이터 변경을 트랜잭션으로 확정한다.';
  if (/FOR UPDATE/.test(s)) return '동시 작성자가 같은 상태를 덮어쓰지 않도록 행 잠금을 획득한다.';
  if (/\.prepare\(|\.query\(|\.execute\(/.test(s)) return `DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: ${s}`;
  if (/timingSafeEqual|createHmac/.test(s)) return '웹훅 원문의 HMAC 서명을 계산하거나 일정 시간 비교로 검증한다.';
  if (/\.hash\(|\.compare\(/.test(s)) return '비밀번호를 안전한 해시로 저장하거나 입력 비밀번호와 해시를 비교한다.';
  if (/jwt\.sign|jwt\.verify/.test(s)) return 'JWT를 발급하거나 허용 알고리즘·발급자·대상·만료 조건으로 검증한다.';
  if (/AbortSignal|AbortController/.test(s)) return '외부 호출 시간 제한 또는 사용자 취소 신호를 준비한다.';
  if (/\.fetch\(|\bfetch\(/.test(s)) return `HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: ${s}`;
  if (/setPending|busy\.current/.test(s)) return '중복 제출 상태를 제어한다. ref는 즉시 잠금, state는 버튼 화면 갱신에 사용한다.';
  if (/set[A-Z]\w*\(/.test(s)) return `이벤트 또는 요청 결과를 상태 setter에 반영해 화면을 갱신한다: ${s}`;
  if (/useState|useRef|useEffect/.test(s)) return '브라우저 상태·렌더와 무관한 값·수명에 따른 연결 정리를 설정한다.';
  if (/register\(|handleSubmit|useForm/.test(s)) return '입력을 폼 라이브러리에 등록하거나 검증을 거쳐 제출한다.';
  if (/EventSource|text\/event-stream/.test(s)) return '서버가 보내는 작업 알림 SSE 연결 또는 응답 형식을 구성한다.';
  if (/TextDecoder|decoder\.decode/.test(s)) return 'UTF-8 조각 경계를 유지하며 스트림 바이트를 문자열로 바꾼다.';
  if (/getReader|reader\.read|reader\.releaseLock/.test(s)) return '응답 스트림을 순서대로 읽거나 읽기 잠금을 정리한다.';
  if (/controller\.(enqueue|close)|clearInterval|removeEventListener/.test(s)) return '스트림 데이터를 전달하거나 연결·타이머·이벤트를 정리한다.';
  if (/revalidatePath/.test(s)) return '데이터 변경 뒤 해당 경로의 서버 화면 캐시를 재검증한다.';
  if (/redirect\(/.test(s)) return '인증 또는 저장 결과에 따라 다음 화면으로 이동한다.';
  if (/assert\./.test(s)) return `관찰한 응답·값이 요구 조건과 같은지 검증한다: ${s}`;
  if (/test\(/.test(s)) return `독립적으로 확인할 동작과 기대 결과를 테스트로 묶는다: ${s}`;
  if (/^if\s*\(/.test(s)) return `입력·상태 조건에 따라 처리 경로를 고른다: ${s}`;
  if (/^return\b/.test(s)) return `현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: ${s}`;
  if (/^try\b/.test(s)) return '실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다.';
  if (/catch/.test(s)) return '예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다.';
  if (/finally/.test(s)) return '성공·실패에 관계없이 잠금·연결·mock을 정리한다.';
  if (/^for |^while /.test(s)) return '배열·반복 요청·스트림을 순서대로 처리하며 종료 조건을 확인한다.';
  if (/^<|^\{.*&&|^\{.*\?/.test(s)) return `JSX로 화면·레이블·입력·조건부 내용을 구성한다: ${s}`;
  if (/^(const|let|export const|export let) /.test(s)) return `이름 있는 값·설정·함수 또는 상태를 준비한다: ${s}`;
  if (/^\s*[\w'"-]+\s*:/.test(s)) return `객체·스키마·속성의 값을 지정한다: ${s}`;
  if (/^[\]});,()]+$/.test(s)) return '열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다.';
  if (file.endsWith('.prisma')) return `ORM의 provider·연결·필드·id 규칙을 설정한다: ${s}`;
  if (file.endsWith('Dockerfile')) return `Docker 이미지의 단계·작업 경로·복사·실행 조건을 지정한다: ${s}`;
  if (/\.ya?ml$/.test(file)) return `컨테이너 또는 CI 단계의 설정과 실행 값을 지정한다: ${s}`;
  if (/process\.env/.test(s)) return `실행 환경에서 서버 설정을 읽는다. 비밀값을 브라우저나 Git에 노출하지 않는다: ${s}`;
  return `현재 구문에서 다음 값·인자·표현식을 연결한다: ${s}`;
}
const cell = value => value.replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('`', 'ˋ');
function fullSource(file) {
  const raw = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n').trimEnd();
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const language = file.endsWith('.tsx') ? 'tsx' : /\.(ts|mjs)$/.test(file) ? 'ts' : file.endsWith('.json') ? 'json' : /\.ya?ml$/.test(file) ? 'yaml' : file.endsWith('.prisma') ? 'prisma' : file.endsWith('.sh') ? 'sh' : file.endsWith('Dockerfile') ? 'dockerfile' : 'text';
  const rows = raw.split('\n').map((line, i) => { const description = explain(line, file); return description ? `| ${i + 1} | ${cell(description)} |` : null; }).filter(Boolean).join('\n');
  return `### ${file}\n\n[실행 파일](${file})\n\n${guide[path.basename(file)] ?? '아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.'}\n\n<!-- source:${file} sha256:${hash} -->\n~~~${language}\n${raw}\n~~~\n\n줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.\n\n| 줄 | 설명 |\n|---|---|\n${rows}\n`;
}
const render = chapter => {
  const commands = `~~~powershell\n${chapter.commands}\n~~~`;
  let workflow = `${chapter.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n${commands}\n\n${chapter.extra ?? ''}`;
  if (chapter.id === 'Midpoint') {
    const divider = chapter.extra.indexOf('### DB·API 연동 구성도');
    workflow = `### 기능 목록\n\n${chapter.steps[0].replace('목표와 기능 목록: ', '')}\n\n${chapter.extra.slice(0, divider)}\n### 단계별 구현 순서\n\n${chapter.steps.slice(1).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n${commands}\n\n${chapter.extra.slice(divider)}`;
  }
  if (chapter.id === 'Final') workflow = `### 기능 목록\n\n${chapter.steps[0].replace('목표와 기능 목록: ', '')}\n\n${chapter.extra}\n\n### 실행 명령\n\n${commands}`;
  let text = `# study${chapter.id} — ${chapter.title}\n\n[전체 과정](README.md) · [노션 원문](${coverage.source})\n\n## ① 목표 한 줄\n\n${chapter.goal}\n\n## ② 📖 이론\n\n${chapter.theory.join('\n\n')}\n\n## ③ 🛠️ 실기 — 전체 코드와 줄별 설명\n\n기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.\n\n${workflow}\n\n${chapter.files.map(fullSource).join('\n')}\n## ④ 🔗 연동 포인트\n\n${chapter.links}\n\n## ⑤ 오류 노트\n\n| 증상 | 원인 | 해결 |\n|---|---|---|\n${chapter.errors.map(row => '| ' + row.map(cell).join(' | ') + ' |').join('\n')}\n\n## ⑥ 직접 해보기\n\n${chapter.practices.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n## ⑦ ☐ 체크리스트\n\n${chapter.checks.map(s => `- [ ] ${s}`).join('\n')}\n\n문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.\n\n## ⑧ 다음 단계 연결\n\n`;
  const next = chapters[chapters.indexOf(chapter) + 1];
  text += next ? `[study${next.id}](study${next.id}.md)에서 ${next.goal}\n` : '기능 확장 전 운영 체크를 수행하고 검증 기록과 노션을 같은 결과로 유지한다.\n';
  text += '\n공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.\n';
  if (chapter.id === 'Final') text += `\n## 마지막 모음 — 노션에서 이번 범위에 넣지 못한 항목\n\n다음 3개는 원문을 그대로 기록한다. ${coverage.exclusionReason}\n\n${coverage.excluded.map(s => `- [ ] ${s}`).join('\n')}\n\n이 항목을 구현 완료로 표시하지 않았다. 추가로 Docker 엔진·서버 DB 실접속·외부 서비스 실제 계정·실모델·원격 배포·복원 실험은 환경 조건 때문에 미검증이며 [검증 기록](docs/validation.md)에 구분했다. 기존 노션의 비교·ReviewForge 이력은 삭제하지 않고 보존했다.\n`;
  return text;
};
// 원문 데이터 패칭 항목을 서버·외부 HTTP 양쪽 실제 코드로 뒷받침한다.
chapters.find(c => c.id === '6').files.push(demo + 'lib/external-posts.ts');
chapters.find(c => c.id === '6').files.push(demo + 'course/sqlite-repository.ts', demo + 'course/server-page.tsx');
chapters.find(c => c.id === 'Midpoint').files.push(demo + 'course/sqlite-repository.ts');
chapters.find(c => c.id === '2').files.push(demo + 'app/ui/site-header.tsx');
chapters.find(c => c.id === '16').files.push(project + 'scripts/storage-check.mjs');
chapters.find(c => c.id === '2').extra = '### 렌더링 용어\n\nSSR은 요청 시 HTML 준비, SSG는 빌드 시 준비, CSR은 브라우저에서 화면 갱신, RSC는 서버 컴포넌트 실행 결과다. 서로 같은 분류 축이 아니며 use client도 최초 HTML을 서버에서 미리 그릴 수 있다. 모든 페이지가 요청마다 새 시각으로 렌더링된다고 가정하지 않는다. Route Group은 URL을 늘리지 않고 레이아웃을 묶는다.';
chapters.find(c => c.id === '8').extra = '### 이미지·메타데이터와 기존 실습\n\n기존 demo의 /posts/[id]는 generateMetadata로 제목을 만들며 next/image는 크기·대체 텍스트·허용 원격 주소를 명시해 사용한다. API·DB 키를 metadata나 클라이언트 props에 넣지 않는다. 기존 src/features/{auth,notes}의 SQLite 학습 노트는 보존했고, 새 과정의 /board·/workbench는 course 모듈의 v1 서비스를 사용한다.';
chapters.find(c => c.id === '8').files.push(demo + 'app/posts/[id]/page.tsx');
const final = chapters.find(c => c.id === 'Final');
for (const file of fs.readdirSync(project + 'src/course').filter(s => /\.tsx?$/.test(s))) { const source = project + 'src/course/' + file; if (!final.files.includes(source)) final.files.push(source); }
for (const chapter of chapters) fs.writeFileSync(`study${chapter.id}.md`, render(chapter));
const rows = chapters.map(c => `| [study${c.id}.md](study${c.id}.md) | ${c.title} |`).join('\n');
fs.writeFileSync('README.md', `# Next.js 단일 프레임워크 학습 과정\n\n[노션 원문](${coverage.source})을 기준으로 study0~10 → studyMidpoint → study11~18 → studyFinal의 **21개 문서**와 JSX·TSX 실행 코드를 정리했다. 기존 study 파일은 같은 이름에 덮어썼다. 다른 프레임워크와의 비교·통합은 이번 과정에서 수행하지 않는다. 노션 원문 체크 7개는 해당 단계에 그대로 넣었고 범위와 충돌하는 추가 체크 3개는 [studyFinal 마지막](studyFinal.md#마지막-모음--노션에서-이번-범위에-넣지-못한-항목)에 보존했다.\n\n## 실행\n\n~~~powershell\ncd tsx_version/demo\nnpm ci\nCopy-Item .env.example .env.local\n# JWT_SECRET에 32바이트 이상 난수를 설정한다.\nnode -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"\nnpm run dev\n~~~\n\n기준 버전은 Node 24.14.0 / npm 11.9.0 / Next.js 16.4.6 / React 19.2.8이다. 새로 받은 저장소에서는 create-next-app을 다시 실행하지 않는다. 비밀값은 .env.local에서만 관리한다.\n\n| 앱 | 역할 |\n|---|---|\n| tsx_version/demo · jsx_version/demo | midpoint 기초 게시판. core API 진입점 |\n| tsx_version/project · jsx_version/project | final 문서·AI 작업실. core + 심화 entry |\n\n| 경로 | 내용 |\n|---|---|\n| /lab | Hello·props·상태·로컬 초안·공개 캐시 |\n| /board | 가입·로그인·게시글·댓글·검색·페이지네이션 |\n| /workbench | project에서 사용하는 문서·AI·작업·SSE·외부 서비스 |\n| /health | DB 연결 상태 |\n| /api-docs · /api/openapi | OpenAPI 3 읽기·JSON 다운로드 |\n\n기존 /posts(JSON 게시판)·/notes(SQLite 노트)는 이전 실습 기록으로 보존한다. 새 v1 서비스의 data/course.db와 서로 다른 데이터다. 기존 인증도 JWT_SECRET 설정을 요구하도록 보완했고 운영에서는 기본 데모 계정을 자동 생성하지 않는다.\n\n## 학습 순서\n\n| 문서 | 주제 |\n|---|---|\n${rows}\n\n모든 문서는 목표·이론·전체 실습 코드와 줄별 설명·연동·오류·직접 해보기·빈 체크리스트·다음 단계 연결을 포함한다. 체크는 학습자가 수행하며, 자동 검증 상태와 섞지 않는다.\n\n## 검증과 운영 명령\n\n앱 디렉터리에서 npm run lint, npm test, npm run build, npm run test:http를 실행한다. project에서는 npm run mcp:client, npm run worker, npm run backup도 사용한다. JS와 TS의 기능은 같고 TS project의 src/course가 원본이다. 루트에서 node scripts/sync-course.mjs, node scripts/configure-course.mjs, node scripts/sync-support.mjs로 동기화한다. 문서는 node scripts/generate-study.mjs로 실제 코드 전체와 줄별 설명을 반영하고 node scripts/verify-study.mjs로 구조·원문 체크·코드 일치를 확인한다.\n\n[검증 기록](docs/validation.md) · [노션 반영표](docs/notion-coverage.json) · [운영·배포](study16.md)\n\n## 구현 범위와 실행 조건\n\n기본 SQLite와 v1 API·보안·텍스트 문서·작업 큐·SSE·AI 통신 mock·MCP 도구는 로컬 검증 대상이다. PostgreSQL·MariaDB·MongoDB 드라이버, 메일·Stripe 테스트 결제·GitHub OAuth, 실모델 호출 코드는 설정 가능하게 준비했다. 실제 서버 DB·Docker 엔진·외부 계정·원격 배포와 복원은 해당 환경에서 따로 확인한다. AI mock은 명시적 테스트 모드이며 live 호출 성공으로 계산하지 않는다. 유료 권한 부여, PDF/OCR·벡터 RAG, 대규모 정규화 저장소는 구현했다고 주장하지 않는다.\n\n## 공식 참고\n\n- [Next.js App Router](https://nextjs.org/docs/app) · [Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy): Proxy 명칭은 Next.js 16부터 적용된다.\n- [AI SDK streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) · [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)\n- [Stripe 웹훅](https://docs.stripe.com/webhooks) · [Resend 이메일 API](https://resend.com/docs/api-reference/emails/send-email) · [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)\n- [Prisma DB 커넥터](https://www.prisma.io/docs/orm/overview/databases): labs/prisma는 Prisma 6 설정 차이 실습이며 앱 런타임은 직접 드라이버다.\n`);
console.log(`${chapters.length}개 문서·README 생성 완료`);
