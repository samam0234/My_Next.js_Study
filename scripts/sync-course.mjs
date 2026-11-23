// TS 원본의 타입만 제거해 JSX 버전과 demo/project의 학습 기능을 맞춘다.
import fs from 'node:fs';
import path from 'node:path';
import ts from '../tsx_version/project/node_modules/typescript/lib/typescript.js';
const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'tsx_version/project/src/course');
for (const target of ['tsx_version/demo/course', 'jsx_version/demo/course', 'jsx_version/project/src/course']) {
  for (const file of fs.readdirSync(source, { recursive: true }).filter(f => /\.tsx?$/.test(f))) {
    let input = fs.readFileSync(path.join(source, file), 'utf8');
    if (target.includes('/demo/') && file === 'repository.ts') input = `import type { State } from './domain';\nexport type Repository = { read(): Promise<State>; change<T>(fn: (state: State) => T): Promise<T> };\nexport { getSqliteRepository as getRepository } from './sqlite-repository';\n`;
    const js = target.startsWith('jsx');
    const output = js ? ts.transpileModule(input, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve } }).outputText.replace('mcp-server.ts', 'mcp-server.js') : input;
    const destination = path.join(root, target, js ? file.replace(/\.tsx?$/, '.js') : file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, output);
  }
}
console.log('course TS/JS · demo/project 동기화 완료');
