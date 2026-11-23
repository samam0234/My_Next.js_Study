import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
const id = crypto.randomUUID(), source = `data/storage-${id}.db`, target = `data/import-${id}.db`, snapshot = `backups/state-${id}.json`;
mkdirSync('data', { recursive: true }); mkdirSync('backups', { recursive: true });
const state = { seq: 1, users: [{ id: 1, email: 'backup@example.com', nickname: '백업 검증', passwordHash: 'test-only' }], posts: [], comments: [], files: [], jobs: [], revoked: [], webhookIds: [] };
const database = new DatabaseSync(source);
database.exec('CREATE TABLE course_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL)');
database.prepare('INSERT INTO course_state VALUES (1, ?)').run(JSON.stringify(state)); database.close();
function run(args, dbPath) {
  const result = spawnSync(process.execPath, args, { env: { ...process.env, DB_DRIVER: 'sqlite', COURSE_DB_PATH: dbPath }, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr); return result.stdout;
}
const backupOutput = run(['scripts/backup.mjs'], source), backupPath = backupOutput.split('백업 완료: ')[1].trim();
function read(file) { const db = new DatabaseSync(file); try { return JSON.parse(db.prepare('SELECT data FROM course_state WHERE id=1').get().data); } finally { db.close(); } }
assert.deepEqual(read(backupPath), state);
const migration = existsSync('scripts/migrate-state.ts') ? 'scripts/migrate-state.ts' : 'scripts/migrate-state.js';
run(['--import', 'tsx', migration, 'export', snapshot], source);
run(['--import', 'tsx', migration, 'import', snapshot], target);
assert.deepEqual(read(target), state);
console.log('PASS: SQLite 온라인 백업 내용 일치 · 스냅샷 export/import 후 데이터 일치');
