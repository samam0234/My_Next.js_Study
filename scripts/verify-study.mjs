import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const names = [...Array.from({ length: 19 }, (_, i) => `study${i}.md`), 'studyMidpoint.md', 'studyFinal.md'];
const required = ['① 목표 한 줄', '② 📖 이론', '③ 🛠️ 실기', '④ 🔗 연동 포인트', '⑤ 오류 노트', '⑥ 직접 해보기', '⑦ ☐ 체크리스트', '⑧ 다음 단계 연결'];
let sourceCount = 0;
for (const name of names) {
  const text = fs.readFileSync(name, 'utf8');
  assert.ok(!/^#{1,6} .*\?\?/m.test(text) && !text.includes('\uFFFD'), `${name}: 인코딩 문제`);
  for (const heading of required) assert.ok(text.includes(`## ${heading}`), `${name}: ${heading}`);
  const practice = text.split('## ⑥ 직접 해보기')[1].split('## ⑦')[0].match(/^\d+\. /gm) ?? [];
  assert.ok(practice.length >= 2 && practice.length <= 3, `${name}: 연습 2~3개`);
  assert.ok(text.includes('- [ ] '), `${name}: 빈 체크리스트`);
  for (const match of text.matchAll(/<!-- source:(.+?) sha256:([a-f0-9]+) -->\n~~~[^\n]*\n([\s\S]*?)\n~~~/g)) {
    const source = fs.readFileSync(match[1], 'utf8').replaceAll('\r\n', '\n').trimEnd();
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'), match[2], `${name}: 원본 변경 ${match[1]}`);
    assert.equal(source, match[3], `${name}: 전체 코드 불일치 ${match[1]}`); sourceCount++;
  }
  // Markdown의 외부 링크·앵커는 제외하고 로컬 파일 링크를 확인한다.
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) { const target = match[1]; if (!/^(https?:|#)/.test(target)) assert.ok(fs.existsSync(target.split('#')[0]), `${name}: 링크 ${target}`); }
}
const coverage = JSON.parse(fs.readFileSync('docs/notion-coverage.json'));
for (const item of coverage.checklist) assert.ok(fs.readFileSync(`study${item.study}.md`, 'utf8').includes(`- [ ] ${item.text}`), `원문 체크 누락: ${item.text}`);
for (const item of coverage.excluded) assert.ok(fs.readFileSync('studyFinal.md', 'utf8').includes(`- [ ] ${item}`), `제외 항목 누락: ${item}`);
console.log(`PASS: ${names.length}문서 · 공통 8구성 · 연습 2~3개 · 전체 코드 ${sourceCount}개 일치 · 노션 체크 7개/제외 3개`);
