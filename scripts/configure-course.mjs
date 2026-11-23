import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
for (const flavor of ['tsx', 'jsx']) for (const app of ['demo', 'project']) {
  const base = path.join(root, `${flavor}_version`, app), source = app === 'project' ? 'src/' : '', ext = flavor === 'tsx' ? 'ts' : 'js';
  const packageFile = path.join(base, 'package.json'), pkg = JSON.parse(fs.readFileSync(packageFile));
  const canonical = JSON.parse(fs.readFileSync(path.join(root, 'tsx_version/project/package.json')));
  pkg.type = 'module'; pkg.engines = { node: '>=24.14.0' }; pkg.dependencies = canonical.dependencies;
  pkg.devDependencies = { ...pkg.devDependencies, ...(flavor === 'tsx' ? { '@types/node': '^24' } : {}), '@types/pg': canonical.devDependencies['@types/pg'], '@types/ws': canonical.devDependencies['@types/ws'], tsx: canonical.devDependencies.tsx, 'eslint-config-next': canonical.devDependencies['eslint-config-next'] };
  pkg.scripts = { ...pkg.scripts, test: 'node --import tsx --test tests/*.test.ts', 'test:http': 'node scripts/http-smoke.mjs', worker: `node --env-file-if-exists=.env.local --import tsx ${source}course/worker.${ext} --once`, 'mcp:server': `node --import tsx ${source}course/mcp-server.${ext} --stdio`, 'mcp:client': `node --import tsx ${source}course/mcp-client.${ext}`, backup: 'node --env-file-if-exists=.env.local scripts/backup.mjs' };
  write(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);
  const route = `import { ${app === 'project' ? 'route as handle' : 'handle'} } from '@/course/${app === 'project' ? 'entry' : 'api'}';\nexport const runtime = 'nodejs';\nexport const dynamic = 'force-dynamic';\n// Next의 두 번째 인자(context)를 내부 extension 콜백으로 넘기지 않는다.\nfunction dispatch(request${flavor === 'tsx' ? ': Request' : ''}) { return handle(request); }\nexport { dispatch as GET, dispatch as POST, dispatch as PATCH, dispatch as DELETE, dispatch as OPTIONS, dispatch as PUT };\n`;
  const routes = ['api/[...path]', 'api/posts', 'api/posts/[id]', 'api/auth/register', 'api/auth/login', 'api/auth/logout', 'api/auth/me', 'api/hello', 'health'];
  for (const routePath of routes) write(path.join(base, source, 'app', routePath, `route.${ext}`), route);
  for (const [name, component] of [['board', 'Board'], ['workbench', 'Workbench']]) write(path.join(base, source, 'app', name, `page.${flavor === 'tsx' ? 'tsx' : 'js'}`), `import { ${component} } from '@/course/${name}';\nexport default function Page() { return <${component}${name === 'board' && app === 'project' ? ' advanced' : ''} />; }\n`);
  if (app === 'demo') write(path.join(base, 'app/workbench', `page.${flavor === 'tsx' ? 'tsx' : 'js'}`), `import { redirect } from 'next/navigation';\nexport default function Page() { redirect('/board'); }\n`);
  write(path.join(base, source, 'app/private-lab', `page.${flavor === 'tsx' ? 'tsx' : 'js'}`), `import { ServerPage } from '@/course/server-page';\nexport default ServerPage;\n`);
  write(path.join(base, source, `proxy.${ext}`), `import { NextResponse${flavor === 'tsx' ? ', type NextRequest' : ''} } from 'next/server';\nexport function proxy(request${flavor === 'tsx' ? ': NextRequest' : ''}) {\n  if (request.cookies.get('course_session')?.value) return NextResponse.next();\n  return NextResponse.redirect(new URL('/board', request.url));\n}\nexport const config = { matcher: ['/private-lab/:path*'${app === 'project' ? ", '/workbench/:path*'" : ''}] };\n`);
  if (app === 'project' && fs.existsSync(path.join(base, `proxy.${ext}`))) fs.unlinkSync(path.join(base, `proxy.${ext}`)); // src/app과 같은 수준으로 이전
  const pageExtension = flavor === 'tsx' ? 'tsx' : 'js';
  const home = app === 'project' ? '(marketing)/page' : 'page';
  write(path.join(base, source, 'app', `${home}.${pageExtension}`), `import Link from 'next/link';\nexport default function Home() { return <section className="course"><h1>Next.js 학습 서비스</h1><p>기본 개념을 익히고 로그인 게시판을 만든 뒤 문서·AI 기능으로 확장합니다.</p><Link href="/lab">기초 실습</Link><Link href="/board">게시판·로그인</Link>${app === 'project' ? '<Link href="/workbench">문서·AI 작업실</Link>' : ''}</section>; }\n`);
  const header = app === 'project' ? 'src/components/header' : 'app/ui/site-header';
  write(path.join(base, `${header}.${pageExtension}`), `import Link from 'next/link';\nexport function SiteHeader() { return <header className="border-b p-4"><nav aria-label="주 메뉴" className="flex gap-4"><Link href="/">Next.js 학습</Link><Link href="/lab">기초</Link><Link href="/board">게시판·로그인</Link>${app === 'project' ? '<Link href="/workbench">문서·AI</Link>' : ''}<Link href="/api-docs">API 문서</Link></nav></header>; }\n`);
  for (const alias of ['login', 'register']) {
    const folder = app === 'project' ? `(marketing)/${alias}` : alias;
    write(path.join(base, source, 'app', folder, `page.${pageExtension}`), `import { redirect } from 'next/navigation';\nexport default function Page() { redirect('/board'); }\n`);
  }
  write(path.join(base, source, 'app/api-docs', `page.${flavor === 'tsx' ? 'tsx' : 'js'}`), `import { openapi } from '@/course/openapi';\nexport default function ApiDocs() { return <section><h1>OpenAPI 3 · 게시판 v1</h1><p><a href="/api/openapi" download="openapi.json">OpenAPI JSON 다운로드</a> · <a href="/board">게시판</a></p><p>Swagger Editor에 JSON을 가져오면 요청 스키마를 확인할 수 있습니다.</p><pre style={{ overflowX: 'auto' }}>{JSON.stringify(openapi, null, 2)}</pre></section>; }\n`);
  write(path.join(base, source, 'app/lab', `page.${flavor === 'tsx' ? 'tsx' : 'js'}`), app === 'project' ? `import { Counter } from '@/course/counter';\nimport { Draft } from '@/course/draft';\nimport { readGlossary } from '@/course/cache';\nexport default async function Lab() { const glossary = await readGlossary(); return <section className="course"><h1>Hello, Next.js!</h1><p>{glossary.routing}</p><p>공개 캐시 시각: {glossary.generatedAt}</p><Counter label="클릭" initial={3} /><Draft /><a href="/board">게시판으로</a></section>; }\n` : `import { Counter } from '@/course/counter';\nimport { Draft } from '@/course/draft';\nexport default function Lab() { const topic = 'Next.js'; return <section className="course"><h1>Hello, {topic}!</h1><p>app 폴더와 page 파일이 URL을 만듭니다.</p><Counter label="클릭" initial={3} /><Draft /><a href="/board">게시판으로</a></section>; }\n`);
  const env = '# 이 파일을 .env.local로 복사하고 JWT_SECRET을 직접 생성하세요.\nJWT_SECRET=\nAPP_ORIGIN=http://localhost:3000\nCORS_ORIGIN=http://localhost:3000\nDB_DRIVER=sqlite\nCOURSE_DB_PATH=data/course.db\nDATABASE_URL=\nAI_MODE=live\nAI_GATEWAY_API_KEY=\nAI_MODEL=openai/gpt-5.4\nRESEND_API_KEY=\nMAIL_FROM=\nSTRIPE_SECRET_KEY=\nSTRIPE_PRICE_ID=\nSTRIPE_WEBHOOK_SECRET=\nGITHUB_CLIENT_ID=\nGITHUB_CLIENT_SECRET=\n';
  write(path.join(base, '.env.example'), env);
  const cssFile = path.join(base, source, 'app/globals.css');
  let css = fs.readFileSync(cssFile, 'utf8');
  if (!css.includes('/* course */')) css += '\n/* course */\n.course { display: grid; gap: 1rem; }\n.course form, .course label { display: grid; gap: .5rem; }\n.course input, .course textarea { border: 1px solid #777; padding: .5rem; border-radius: .3rem; }\n.course button { border: 1px solid #777; padding: .4rem .8rem; border-radius: .3rem; }\n.course button:disabled { opacity: .5; }\n.course :focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }\n';
  write(cssFile, css);
  // 빌드가 외부 폰트 다운로드에 의존하지 않게 시스템 글꼴을 사용한다.
  const layoutFile = path.join(base, source, 'app', `layout.${flavor === 'tsx' ? 'tsx' : 'js'}`);
  let layout = fs.readFileSync(layoutFile, 'utf8').replace(/import \{ Noto_Sans_KR \} from "next\/font\/google";\r?\n/, '').replace(/const notoSansKr = Noto_Sans_KR\([\s\S]*?\);\r?\n/, '').replace('className={`${notoSansKr.variable} h-full antialiased`}', 'className="h-full antialiased"');
  write(layoutFile, layout);
  const config = 'const nextConfig = { output: "standalone", serverExternalPackages: ["pg", "mysql2", "mongodb"], async headers() { return [{ source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "same-origin" }, { key: "X-Frame-Options", value: "DENY" }] }]; } };\nexport default nextConfig;\n';
  write(path.join(base, flavor === 'tsx' ? 'next.config.ts' : 'next.config.mjs'), config);
  write(path.join(base, 'README.md'), `# Next.js ${app} · ${flavor.toUpperCase()}\n\n루트 [README](../../README.md)와 학습 문서를 먼저 읽으세요.\n\n~~~powershell\nnpm ci\nCopy-Item .env.example .env.local\n# JWT_SECRET에 32자 이상의 무작위 값 설정\nnpm run dev\n~~~\n\n/lab: 기본 문법·props·초안, /board: 공통 v1 게시판·회원·댓글, /workbench: 문서·AI·작업 알림, /api-docs: OpenAPI. 기존 /posts 또는 /notes 화면은 이전 실습 기록이며 새 과정의 데이터와 분리됩니다.\n\nnpm test / npm run test:http / npm run build / npm run worker / npm run mcp:client 명령은 루트 문서에 설명되어 있습니다.\n`);
}
console.log('4개 앱의 경로·설정 동기화 완료');
