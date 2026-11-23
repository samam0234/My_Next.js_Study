import fs from 'node:fs';
import path from 'node:path';
import ts from '../tsx_version/project/node_modules/typescript/lib/typescript.js';
const source = 'tsx_version/project';
for (const target of ['tsx_version/demo', 'jsx_version/demo', 'jsx_version/project']) {
  const app = target.endsWith('/project') ? 'src/' : '', js = target.startsWith('jsx');
  for (const file of ['tests/course.test.ts', 'scripts/http-smoke.mjs', 'scripts/backup.mjs', 'scripts/measure.mjs', 'scripts/migrate-state.ts', 'scripts/ws-server.ts', 'scripts/storage-check.mjs', 'Dockerfile', '.dockerignore', 'compose.yaml']) {
    let content = fs.readFileSync(path.join(source, file), 'utf8');
    content = content.replaceAll('../src/course/', `../${app}course/`);
    const destination = path.join(target, js && file.startsWith('scripts/') ? file.replace(/\.ts$/, '.js') : file);
    if (js && file.endsWith('.ts') && file.startsWith('scripts/')) content = ts.transpileModule(content, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, content);
  }
}
console.log('검증·운영 스크립트 동기화 완료');
