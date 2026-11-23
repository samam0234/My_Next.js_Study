# study11 — DB 확장 — PostgreSQL·MariaDB·MongoDB

[전체 과정](README.md) · [노션 원문](https://app.notion.com/p/3d6d7dec5e2e81afb534c64042625cc6)

## ① 목표 한 줄

Repository 계약을 유지하면서 DB 드라이버를 교체하고 ORM 설정 차이를 익힌다.

## ② 📖 이론

DB_DRIVER는 sqlite/postgres/mariadb/mongodb 중 하나다. SQL 서버는 SELECT FOR UPDATE로 한 상태 행을 잠근다. MongoDB는 revision 조건으로 갱신에 성공한 경우만 채택하고 충돌하면 다시 읽는다. 이 콜백은 재실행될 수 있어 메일·결제 같은 외부 부작용을 넣지 않는다.

연결 문자열만 바꾼다고 기존 데이터가 이동하지는 않는다. 원본을 export하고 빈 대상 DB에 import한 뒤 사용자·글·댓글 건수와 id·시간을 대조해야 한다. 비밀번호 해시가 들어 있는 스냅샷은 비밀 자료로 취급한다.

Prisma 스키마 실습은 ORM의 provider·native type·id 차이를 보기 위한 별도 실습이다. 실제 앱은 직접 드라이버를 사용한다. Prisma 6 기준 PostgreSQL은 postgresql와 Text, MariaDB는 mysql과 LongText, MongoDB는 mongodb와 _id 매핑을 쓴다. MongoDB는 SQL migration 대신 db push와 인덱스·데이터 이관 계획이 필요하며 트랜잭션을 쓰면 replica set 조건도 확인한다.

같은 서류를 다른 창고로 옮기되 접수 양식은 유지하는 비유다. 현재 전체 상태 한 행 방식은 교체 원리를 보이기 위한 제약이며 운영 규모가 커지면 엔터티별 테이블·컬렉션, 외래키·인덱스·DB 페이지네이션으로 바꾼다.

## ③ 🛠️ 실기 — 전체 코드와 줄별 설명

기준: Next.js 16.4.6 App Router, Node 24.14.0. 예시는 TSX이며 JSX 버전은 같은 경로에서 타입과 확장자만 다르다. 앱은 누적 완성본이므로 현재 단계의 파일과 아래 구현 순서를 중심으로 읽는다. 기존 코드를 복제해 중첩 프로젝트를 생성하지 않는다.

1. Docker Desktop의 Linux 엔진을 실행한다. 이 작업 환경에서는 엔진이 꺼져 있어 컨테이너 DB 실접속은 확인하지 못했다.
2. PowerShell에 DB_PASSWORD를 설정하고 원하는 profile의 DB를 up -d로 실행한다.
3. 별도 앱 환경에서 DB_DRIVER와 DATABASE_URL을 맞추고 /health, 가입·글 CRUD를 호출한다.
4. 원본 서버를 멈추고 snapshot export → 대상 URL 설정 → 빈 대상에 import한다. 건수·id·로그인을 대조한다.
5. labs/prisma의 네 스키마를 읽고 Prisma 6 validate 명령으로 provider·id·native type 차이를 확인한다. 이 ORM 실습이 런타임 repository를 자동 교체하지는 않는다.

~~~powershell
cd tsx_version/project
$env:DB_PASSWORD="local-study-change-me"
docker compose --profile postgres up -d postgres
# PostgreSQL
$env:DB_DRIVER="postgres"
$env:DATABASE_URL="postgresql://study:local-study-change-me@localhost:55432/next_study"
# MariaDB는 mysql://study:비밀번호@localhost:53306/next_study
# MongoDB는 mongodb://study:비밀번호@localhost:57017/next_study?authSource=admin
npm run dev
# 데이터 이동은 서버를 멈춘 후 별도 명령으로
# node --env-file-if-exists=.env.local --import tsx scripts/migrate-state.ts export backups/state.json
# 대상 환경으로 바꾼 후 import backups/state.json
# 루트 labs/prisma 기준 ORM 검증 예시
# npx prisma@6.19.0 validate --schema ../../labs/prisma/postgres.prisma
~~~



### tsx_version/project/src/course/repository.ts

[실행 파일](tsx_version/project/src/course/repository.ts)

read는 현재 상태를 읽고 change는 원자적인 읽기·수정·쓰기를 제공한다. 드라이버별 잠금 또는 revision 비교가 동시 갱신의 유실을 막는다.

<!-- source:tsx_version/project/src/course/repository.ts sha256:5f798d75c2a955510b017c6dd9c81097e76d3efa86ebe1f43c7cb9bac7af5b1f -->
~~~ts
import { getSqliteRepository } from "./sqlite-repository";
import { emptyState, type State } from "./domain";

// 학습용 직렬화 저장소. 한 레코드를 잠가 갱신 유실을 막는다. 대규모 서비스는 정규화·인덱스가 필요하다.
export type Repository = {
  read(): Promise<State>;
  change<T>(fn: (state: State) => T): Promise<T>;
};
let repository: Promise<Repository> | undefined;
export function getRepository() {
  return (repository ??= connect());
}
async function connect(): Promise<Repository> {
  const driver = process.env.DB_DRIVER ?? "sqlite";
  if (driver === "sqlite") return getSqliteRepository();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL이 필요합니다.");
  if (driver === "postgres") {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
    await pool.query(
      "CREATE TABLE IF NOT EXISTS course_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL)",
    );
    await pool.query(
      "INSERT INTO course_state VALUES (1, $1) ON CONFLICT DO NOTHING",
      [JSON.stringify(emptyState())],
    );
    return {
      read: async () =>
        JSON.parse(
          (await pool.query("SELECT data FROM course_state WHERE id=1")).rows[0]
            .data,
        ),
      change: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const state = JSON.parse(
            (
              await client.query(
                "SELECT data FROM course_state WHERE id=1 FOR UPDATE",
              )
            ).rows[0].data,
          );
          const result = fn(state);
          await client.query("UPDATE course_state SET data=$1 WHERE id=1", [
            JSON.stringify(state),
          ]);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
    };
  }
  if (driver === "mariadb") {
    const mysql = await import("mysql2/promise");
    const pool = mysql.createPool(process.env.DATABASE_URL);
    await pool.query(
      "CREATE TABLE IF NOT EXISTS course_state (id INTEGER PRIMARY KEY, data LONGTEXT NOT NULL)",
    );
    await pool.execute("INSERT IGNORE INTO course_state VALUES (1, ?)", [
      JSON.stringify(emptyState()),
    ]);
    return {
      read: async () => {
        const [rows] = await pool.query<import("mysql2").RowDataPacket[]>(
          "SELECT data FROM course_state WHERE id=1",
        );
        return JSON.parse(rows[0].data);
      },
      change: async (fn) => {
        const client = await pool.getConnection();
        try {
          await client.beginTransaction();
          const [rows] = await client.query<import("mysql2").RowDataPacket[]>(
            "SELECT data FROM course_state WHERE id=1 FOR UPDATE",
          );
          const state = JSON.parse(rows[0].data);
          const result = fn(state);
          await client.execute("UPDATE course_state SET data=? WHERE id=1", [
            JSON.stringify(state),
          ]);
          await client.commit();
          return result;
        } catch (error) {
          await client.rollback();
          throw error;
        } finally {
          client.release();
        }
      },
    };
  }
  if (driver === "mongodb") {
    const { MongoClient } = await import("mongodb");
    const client = await new MongoClient(process.env.DATABASE_URL).connect();
    const collection = client
      .db()
      .collection<{ _id: string; revision: number; data: State }>(
        "course_state",
      );
    await collection.updateOne(
      { _id: "main" },
      { $setOnInsert: { revision: 0, data: emptyState() } },
      { upsert: true },
    );
    return {
      read: async () => (await collection.findOne({ _id: "main" }))!.data,
      change: async (fn) => {
        for (let retry = 0; retry < 20; retry++) {
          const row = (await collection.findOne({ _id: "main" }))!;
          const result = fn(row.data); // 재시도될 수 있으므로 외부 통신·메일 발송을 여기서 하지 않는다.
          const saved = await collection.updateOne(
            { _id: "main", revision: row.revision },
            { $set: { data: row.data }, $inc: { revision: 1 } },
          );
          if (saved.modifiedCount) return result;
        }
        throw new Error("DB 갱신 충돌: 잠시 후 재시도하세요.");
      },
    };
  }
  throw new Error(`지원하지 않는 DB_DRIVER: ${driver}`);
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: { getSqliteRepository } from "./sqlite-repository"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: { emptyState, type State } from "./domain"; |
| 4 | 주석: 학습용 직렬화 저장소. 한 레코드를 잠가 갱신 유실을 막는다. 대규모 서비스는 정규화·인덱스가 필요하다. |
| 5 | 다른 모듈이 공유할 데이터 구조를 선언한다: export type Repository = { |
| 6 | 현재 구문에서 다음 값·인자·표현식을 연결한다: read(): Promise<State>; |
| 7 | 현재 구문에서 다음 값·인자·표현식을 연결한다: change<T>(fn: (state: State) => T): Promise<T>; |
| 8 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 9 | 이름 있는 값·설정·함수 또는 상태를 준비한다: let repository: Promise<Repository> \| undefined; |
| 10 | getRepository의 입력·반환 경계를 정의한다. |
| 11 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return (repository ??= connect()); |
| 12 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 13 | connect의 입력·반환 경계를 정의한다. 비동기 I/O는 await로 완료를 기다린다. |
| 14 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const driver = process.env.DB_DRIVER ?? "sqlite"; |
| 15 | 입력·상태 조건에 따라 처리 경로를 고른다: if (driver === "sqlite") return getSqliteRepository(); |
| 16 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL이 필요합니다."); |
| 17 | 입력·상태 조건에 따라 처리 경로를 고른다: if (driver === "postgres") { |
| 18 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const { Pool } = await import("pg"); |
| 19 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const pool = new Pool({ |
| 20 | 객체·스키마·속성의 값을 지정한다: connectionString: process.env.DATABASE_URL, |
| 21 | 객체·스키마·속성의 값을 지정한다: max: 5, |
| 22 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 23 | DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: await pool.query( |
| 24 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "CREATE TABLE IF NOT EXISTS course_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL)", |
| 25 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 26 | DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: await pool.query( |
| 27 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "INSERT INTO course_state VALUES (1, $1) ON CONFLICT DO NOTHING", |
| 28 | 현재 구문에서 다음 값·인자·표현식을 연결한다: [JSON.stringify(emptyState())], |
| 29 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 30 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return { |
| 31 | 객체·스키마·속성의 값을 지정한다: read: async () => |
| 32 | 현재 구문에서 다음 값·인자·표현식을 연결한다: JSON.parse( |
| 33 | DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: (await pool.query("SELECT data FROM course_state WHERE id=1")).rows[0] |
| 34 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .data, |
| 35 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 36 | 객체·스키마·속성의 값을 지정한다: change: async (fn) => { |
| 37 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const client = await pool.connect(); |
| 38 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 39 | DB 트랜잭션을 시작한다. SQLite는 쓰기 잠금을, 서버 SQL은 행 잠금을 사용한다. |
| 40 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const state = JSON.parse( |
| 41 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 42 | DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: await client.query( |
| 43 | 동시 작성자가 같은 상태를 덮어쓰지 않도록 행 잠금을 획득한다. |
| 44 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 45 | 현재 구문에서 다음 값·인자·표현식을 연결한다: ).rows[0].data, |
| 46 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 47 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const result = fn(state); |
| 48 | DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: await client.query("UPDATE course_state SET data=$1 WHERE id=1", [ |
| 49 | 현재 구문에서 다음 값·인자·표현식을 연결한다: JSON.stringify(state), |
| 50 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 51 | 검증을 마친 데이터 변경을 트랜잭션으로 확정한다. |
| 52 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return result; |
| 53 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 54 | 실패한 트랜잭션의 데이터 변경을 되돌린다. |
| 55 | 현재 구문에서 다음 값·인자·표현식을 연결한다: throw error; |
| 56 | 성공·실패에 관계없이 잠금·연결·mock을 정리한다. |
| 57 | 현재 구문에서 다음 값·인자·표현식을 연결한다: client.release(); |
| 58 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 59 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 60 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 61 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 62 | 입력·상태 조건에 따라 처리 경로를 고른다: if (driver === "mariadb") { |
| 63 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const mysql = await import("mysql2/promise"); |
| 64 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const pool = mysql.createPool(process.env.DATABASE_URL); |
| 65 | DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: await pool.query( |
| 66 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "CREATE TABLE IF NOT EXISTS course_state (id INTEGER PRIMARY KEY, data LONGTEXT NOT NULL)", |
| 67 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 68 | DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: await pool.execute("INSERT IGNORE INTO course_state VALUES (1, ?)", [ |
| 69 | 현재 구문에서 다음 값·인자·표현식을 연결한다: JSON.stringify(emptyState()), |
| 70 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 71 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return { |
| 72 | 객체·스키마·속성의 값을 지정한다: read: async () => { |
| 73 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const [rows] = await pool.query<import("mysql2").RowDataPacket[]>( |
| 74 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "SELECT data FROM course_state WHERE id=1", |
| 75 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 76 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return JSON.parse(rows[0].data); |
| 77 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 78 | 객체·스키마·속성의 값을 지정한다: change: async (fn) => { |
| 79 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const client = await pool.getConnection(); |
| 80 | 실패 가능한 처리를 시작하고 아래 catch/finally와 연결한다. |
| 81 | DB 트랜잭션을 시작한다. SQLite는 쓰기 잠금을, 서버 SQL은 행 잠금을 사용한다. |
| 82 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const [rows] = await client.query<import("mysql2").RowDataPacket[]>( |
| 83 | 동시 작성자가 같은 상태를 덮어쓰지 않도록 행 잠금을 획득한다. |
| 84 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 85 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const state = JSON.parse(rows[0].data); |
| 86 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const result = fn(state); |
| 87 | DB 명령을 준비하거나 실행한다. 값은 자리표시자에 별도로 바인딩한다: await client.execute("UPDATE course_state SET data=? WHERE id=1", [ |
| 88 | 현재 구문에서 다음 값·인자·표현식을 연결한다: JSON.stringify(state), |
| 89 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 90 | 검증을 마친 데이터 변경을 트랜잭션으로 확정한다. |
| 91 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return result; |
| 92 | 예외를 받아 사용자 오류와 내부 오류를 구분하거나 연결을 종료한다. |
| 93 | 실패한 트랜잭션의 데이터 변경을 되돌린다. |
| 94 | 현재 구문에서 다음 값·인자·표현식을 연결한다: throw error; |
| 95 | 성공·실패에 관계없이 잠금·연결·mock을 정리한다. |
| 96 | 현재 구문에서 다음 값·인자·표현식을 연결한다: client.release(); |
| 97 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 98 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 99 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 100 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 101 | 입력·상태 조건에 따라 처리 경로를 고른다: if (driver === "mongodb") { |
| 102 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const { MongoClient } = await import("mongodb"); |
| 103 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const client = await new MongoClient(process.env.DATABASE_URL).connect(); |
| 104 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const collection = client |
| 105 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .db() |
| 106 | 현재 구문에서 다음 값·인자·표현식을 연결한다: .collection<{ _id: string; revision: number; data: State }>( |
| 107 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "course_state", |
| 108 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 109 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await collection.updateOne( |
| 110 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { _id: "main" }, |
| 111 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { $setOnInsert: { revision: 0, data: emptyState() } }, |
| 112 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { upsert: true }, |
| 113 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 114 | 현재 함수의 처리 결과를 호출자 또는 화면에 반환한다: return { |
| 115 | 객체·스키마·속성의 값을 지정한다: read: async () => (await collection.findOne({ _id: "main" }))!.data, |
| 116 | 객체·스키마·속성의 값을 지정한다: change: async (fn) => { |
| 117 | 배열·반복 요청·스트림을 순서대로 처리하며 종료 조건을 확인한다. |
| 118 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const row = (await collection.findOne({ _id: "main" }))!; |
| 119 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const result = fn(row.data); // 재시도될 수 있으므로 외부 통신·메일 발송을 여기서 하지 않는다. |
| 120 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const saved = await collection.updateOne( |
| 121 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { _id: "main", revision: row.revision }, |
| 122 | 현재 구문에서 다음 값·인자·표현식을 연결한다: { $set: { data: row.data }, $inc: { revision: 1 } }, |
| 123 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 124 | 입력·상태 조건에 따라 처리 경로를 고른다: if (saved.modifiedCount) return result; |
| 125 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 126 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: throw new Error("DB 갱신 충돌: 잠시 후 재시도하세요."); |
| 127 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 128 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 129 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 130 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: throw new Error(ˋ지원하지 않는 DB_DRIVER: ${driver}ˋ); |
| 131 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### tsx_version/project/scripts/migrate-state.ts

[실행 파일](tsx_version/project/scripts/migrate-state.ts)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/scripts/migrate-state.ts sha256:99b2df4bd92b98ea7ecfc3df28357765d70b46332092f2daee768c822272c697 -->
~~~ts
import fs from "node:fs/promises";
import path from "node:path";
import { getRepository } from "../src/course/repository";
import { emptyState, type State } from "../src/course/domain";
const [operation, file] = process.argv.slice(2);
if (!["export", "import"].includes(operation) || !file)
  throw new Error(
    "사용법: npx tsx scripts/migrate-state.ts export|import backups/state.json",
  );
const repo = await getRepository();
if (operation === "export") {
  await fs.mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await fs.writeFile(file, JSON.stringify(await repo.read()), { mode: 0o600 });
  console.log("내보내기 완료. 비밀번호 해시를 포함하므로 Git에 올리지 마세요.");
} else {
  const state = JSON.parse(await fs.readFile(file, "utf8")) as State;
  if (
    !Number.isSafeInteger(state.seq) ||
    Object.keys(emptyState()).some(
      (key) => key !== "seq" && !Array.isArray(state[key as keyof State]),
    )
  )
    throw new Error("스냅샷 형식이 올바르지 않습니다.");
  await repo.change((current) => {
    if (current.users.length || current.posts.length)
      throw new Error("대상 DB가 비어 있어야 합니다.");
    Object.assign(current, state);
  });
  console.log("가져오기 완료. /health와 원본 건수를 대조하세요.");
}
process.exit(0); // CLI에서 DB 풀을 소유하므로 결과 기록 뒤 연결을 종료한다.
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 외부 모듈 또는 공용 함수·타입을 가져온다: fs from "node:fs/promises"; |
| 2 | 외부 모듈 또는 공용 함수·타입을 가져온다: path from "node:path"; |
| 3 | 외부 모듈 또는 공용 함수·타입을 가져온다: { getRepository } from "../src/course/repository"; |
| 4 | 외부 모듈 또는 공용 함수·타입을 가져온다: { emptyState, type State } from "../src/course/domain"; |
| 5 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const [operation, file] = process.argv.slice(2); |
| 6 | 입력·상태 조건에 따라 처리 경로를 고른다: if (!["export", "import"].includes(operation) \|\| !file) |
| 7 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: throw new Error( |
| 8 | 현재 구문에서 다음 값·인자·표현식을 연결한다: "사용법: npx tsx scripts/migrate-state.ts export\|import backups/state.json", |
| 9 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 10 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const repo = await getRepository(); |
| 11 | 입력·상태 조건에 따라 처리 경로를 고른다: if (operation === "export") { |
| 12 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await fs.mkdir(path.dirname(path.resolve(file)), { recursive: true }); |
| 13 | 현재 구문에서 다음 값·인자·표현식을 연결한다: await fs.writeFile(file, JSON.stringify(await repo.read()), { mode: 0o600 }); |
| 14 | 현재 구문에서 다음 값·인자·표현식을 연결한다: console.log("내보내기 완료. 비밀번호 해시를 포함하므로 Git에 올리지 마세요."); |
| 15 | 현재 구문에서 다음 값·인자·표현식을 연결한다: } else { |
| 16 | 이름 있는 값·설정·함수 또는 상태를 준비한다: const state = JSON.parse(await fs.readFile(file, "utf8")) as State; |
| 17 | 입력·상태 조건에 따라 처리 경로를 고른다: if ( |
| 18 | 현재 구문에서 다음 값·인자·표현식을 연결한다: !Number.isSafeInteger(state.seq) \|\| |
| 19 | 현재 구문에서 다음 값·인자·표현식을 연결한다: Object.keys(emptyState()).some( |
| 20 | 현재 구문에서 다음 값·인자·표현식을 연결한다: (key) => key !== "seq" && !Array.isArray(state[key as keyof State]), |
| 21 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 22 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 23 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: throw new Error("스냅샷 형식이 올바르지 않습니다."); |
| 24 | Repository의 원자적 갱신 경계 안에서 상태를 변경한다. 콜백 안에 외부 부작용을 넣지 않는다. |
| 25 | 입력·상태 조건에 따라 처리 경로를 고른다: if (current.users.length \|\| current.posts.length) |
| 26 | 현재 조건을 정상 처리할 수 없어 예외를 발생시킨다. 상위 오류 처리 또는 CLI가 실패를 기록한다: throw new Error("대상 DB가 비어 있어야 합니다."); |
| 27 | 현재 구문에서 다음 값·인자·표현식을 연결한다: Object.assign(current, state); |
| 28 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 29 | 현재 구문에서 다음 값·인자·표현식을 연결한다: console.log("가져오기 완료. /health와 원본 건수를 대조하세요."); |
| 30 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 31 | 현재 구문에서 다음 값·인자·표현식을 연결한다: process.exit(0); // CLI에서 DB 풀을 소유하므로 결과 기록 뒤 연결을 종료한다. |

### tsx_version/project/compose.yaml

[실행 파일](tsx_version/project/compose.yaml)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:tsx_version/project/compose.yaml sha256:acc3776446d29d4593601b335cfffcc73071040c759aa93e56cee63c5a66a9b2 -->
~~~yaml
services:
  app:
    profiles: [app]
    build: .
    ports: ["127.0.0.1:3000:3000"]
    env_file: .env.local
    volumes: [course-data:/app/data]
    restart: unless-stopped
    healthcheck:
      test: [CMD, node, -e, "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 5
  worker:
    profiles: [tasks]
    build:
      context: .
      target: worker
    env_file: .env.local
    volumes: [course-data:/app/data]
  postgres:
    profiles: [postgres]
    image: postgres:17
    environment:
      POSTGRES_USER: study
      POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요}
      POSTGRES_DB: next_study
    ports: ["127.0.0.1:55432:5432"]
    volumes: [postgres-data:/var/lib/postgresql/data]
    healthcheck:
      test: [CMD-SHELL, "pg_isready -U study -d next_study"]
      interval: 5s
      retries: 20
  mariadb:
    profiles: [mariadb]
    image: mariadb:11
    environment:
      MARIADB_USER: study
      MARIADB_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요}
      MARIADB_ROOT_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요}
      MARIADB_DATABASE: next_study
    ports: ["127.0.0.1:53306:3306"]
    volumes: [maria-data:/var/lib/mysql]
    healthcheck:
      test: [CMD, healthcheck.sh, --connect, --innodb_initialized]
      interval: 5s
      retries: 20
  mongodb:
    profiles: [mongodb]
    image: mongo:8
    environment:
      MONGO_INITDB_ROOT_USERNAME: study
      MONGO_INITDB_ROOT_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요}
    ports: ["127.0.0.1:57017:27017"]
    volumes: [mongo-data:/data/db]
volumes:
  course-data:
  postgres-data:
  maria-data:
  mongo-data:
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 객체·스키마·속성의 값을 지정한다: services: |
| 2 | 객체·스키마·속성의 값을 지정한다: app: |
| 3 | 객체·스키마·속성의 값을 지정한다: profiles: [app] |
| 4 | 객체·스키마·속성의 값을 지정한다: build: . |
| 5 | 객체·스키마·속성의 값을 지정한다: ports: ["127.0.0.1:3000:3000"] |
| 6 | 객체·스키마·속성의 값을 지정한다: env_file: .env.local |
| 7 | 객체·스키마·속성의 값을 지정한다: volumes: [course-data:/app/data] |
| 8 | 객체·스키마·속성의 값을 지정한다: restart: unless-stopped |
| 9 | 객체·스키마·속성의 값을 지정한다: healthcheck: |
| 10 | HTTP 요청을 실행한다. 호출 위치와 메서드·헤더·본문·timeout을 함께 확인한다: test: [CMD, node, -e, "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"] |
| 11 | 객체·스키마·속성의 값을 지정한다: interval: 15s |
| 12 | 객체·스키마·속성의 값을 지정한다: timeout: 5s |
| 13 | 객체·스키마·속성의 값을 지정한다: retries: 5 |
| 14 | 객체·스키마·속성의 값을 지정한다: worker: |
| 15 | 객체·스키마·속성의 값을 지정한다: profiles: [tasks] |
| 16 | 객체·스키마·속성의 값을 지정한다: build: |
| 17 | 객체·스키마·속성의 값을 지정한다: context: . |
| 18 | 객체·스키마·속성의 값을 지정한다: target: worker |
| 19 | 객체·스키마·속성의 값을 지정한다: env_file: .env.local |
| 20 | 객체·스키마·속성의 값을 지정한다: volumes: [course-data:/app/data] |
| 21 | 객체·스키마·속성의 값을 지정한다: postgres: |
| 22 | 객체·스키마·속성의 값을 지정한다: profiles: [postgres] |
| 23 | 객체·스키마·속성의 값을 지정한다: image: postgres:17 |
| 24 | 객체·스키마·속성의 값을 지정한다: environment: |
| 25 | 객체·스키마·속성의 값을 지정한다: POSTGRES_USER: study |
| 26 | 객체·스키마·속성의 값을 지정한다: POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요} |
| 27 | 객체·스키마·속성의 값을 지정한다: POSTGRES_DB: next_study |
| 28 | 객체·스키마·속성의 값을 지정한다: ports: ["127.0.0.1:55432:5432"] |
| 29 | 객체·스키마·속성의 값을 지정한다: volumes: [postgres-data:/var/lib/postgresql/data] |
| 30 | 객체·스키마·속성의 값을 지정한다: healthcheck: |
| 31 | 객체·스키마·속성의 값을 지정한다: test: [CMD-SHELL, "pg_isready -U study -d next_study"] |
| 32 | 객체·스키마·속성의 값을 지정한다: interval: 5s |
| 33 | 객체·스키마·속성의 값을 지정한다: retries: 20 |
| 34 | 객체·스키마·속성의 값을 지정한다: mariadb: |
| 35 | 객체·스키마·속성의 값을 지정한다: profiles: [mariadb] |
| 36 | 객체·스키마·속성의 값을 지정한다: image: mariadb:11 |
| 37 | 객체·스키마·속성의 값을 지정한다: environment: |
| 38 | 객체·스키마·속성의 값을 지정한다: MARIADB_USER: study |
| 39 | 객체·스키마·속성의 값을 지정한다: MARIADB_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요} |
| 40 | 객체·스키마·속성의 값을 지정한다: MARIADB_ROOT_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요} |
| 41 | 객체·스키마·속성의 값을 지정한다: MARIADB_DATABASE: next_study |
| 42 | 객체·스키마·속성의 값을 지정한다: ports: ["127.0.0.1:53306:3306"] |
| 43 | 객체·스키마·속성의 값을 지정한다: volumes: [maria-data:/var/lib/mysql] |
| 44 | 객체·스키마·속성의 값을 지정한다: healthcheck: |
| 45 | 객체·스키마·속성의 값을 지정한다: test: [CMD, healthcheck.sh, --connect, --innodb_initialized] |
| 46 | 객체·스키마·속성의 값을 지정한다: interval: 5s |
| 47 | 객체·스키마·속성의 값을 지정한다: retries: 20 |
| 48 | 객체·스키마·속성의 값을 지정한다: mongodb: |
| 49 | 객체·스키마·속성의 값을 지정한다: profiles: [mongodb] |
| 50 | 객체·스키마·속성의 값을 지정한다: image: mongo:8 |
| 51 | 객체·스키마·속성의 값을 지정한다: environment: |
| 52 | 객체·스키마·속성의 값을 지정한다: MONGO_INITDB_ROOT_USERNAME: study |
| 53 | 객체·스키마·속성의 값을 지정한다: MONGO_INITDB_ROOT_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD를 설정하세요} |
| 54 | 객체·스키마·속성의 값을 지정한다: ports: ["127.0.0.1:57017:27017"] |
| 55 | 객체·스키마·속성의 값을 지정한다: volumes: [mongo-data:/data/db] |
| 56 | 객체·스키마·속성의 값을 지정한다: volumes: |
| 57 | 객체·스키마·속성의 값을 지정한다: course-data: |
| 58 | 객체·스키마·속성의 값을 지정한다: postgres-data: |
| 59 | 객체·스키마·속성의 값을 지정한다: maria-data: |
| 60 | 객체·스키마·속성의 값을 지정한다: mongo-data: |

### labs/prisma/sqlite.prisma

[실행 파일](labs/prisma/sqlite.prisma)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:labs/prisma/sqlite.prisma sha256:b8dfc4c767244f16cb10c59ae4d96d2dec2716dff1803db7cfb1a03a085ce33a -->
~~~prisma
// Prisma 6 학습용 모델. 실제 앱은 repository.ts의 드라이버를 사용한다.
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
model CourseState {
  id       Int    @id
  data     String
  revision Int    @default(0)
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | 주석: Prisma 6 학습용 모델. 실제 앱은 repository.ts의 드라이버를 사용한다. |
| 2 | ORM의 provider·연결·필드·id 규칙을 설정한다: generator client { |
| 3 | ORM의 provider·연결·필드·id 규칙을 설정한다: provider = "prisma-client-js" |
| 4 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 5 | ORM의 provider·연결·필드·id 규칙을 설정한다: datasource db { |
| 6 | ORM의 provider·연결·필드·id 규칙을 설정한다: provider = "sqlite" |
| 7 | ORM의 provider·연결·필드·id 규칙을 설정한다: url      = env("DATABASE_URL") |
| 8 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 9 | ORM의 provider·연결·필드·id 규칙을 설정한다: model CourseState { |
| 10 | ORM의 provider·연결·필드·id 규칙을 설정한다: id       Int    @id |
| 11 | ORM의 provider·연결·필드·id 규칙을 설정한다: data     String |
| 12 | ORM의 provider·연결·필드·id 규칙을 설정한다: revision Int    @default(0) |
| 13 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### labs/prisma/postgres.prisma

[실행 파일](labs/prisma/postgres.prisma)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:labs/prisma/postgres.prisma sha256:aa716b264b7da52339bb148d2966e914904877cb72600ac91bc0254c59cfcaf3 -->
~~~prisma
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
model CourseState {
  id       Int    @id
  data     String @db.Text
  revision Int    @default(0)
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | ORM의 provider·연결·필드·id 규칙을 설정한다: generator client { |
| 2 | ORM의 provider·연결·필드·id 규칙을 설정한다: provider = "prisma-client-js" |
| 3 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 4 | ORM의 provider·연결·필드·id 규칙을 설정한다: datasource db { |
| 5 | ORM의 provider·연결·필드·id 규칙을 설정한다: provider = "postgresql" |
| 6 | ORM의 provider·연결·필드·id 규칙을 설정한다: url      = env("DATABASE_URL") |
| 7 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 8 | ORM의 provider·연결·필드·id 규칙을 설정한다: model CourseState { |
| 9 | ORM의 provider·연결·필드·id 규칙을 설정한다: id       Int    @id |
| 10 | ORM의 provider·연결·필드·id 규칙을 설정한다: data     String @db.Text |
| 11 | ORM의 provider·연결·필드·id 규칙을 설정한다: revision Int    @default(0) |
| 12 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### labs/prisma/mariadb.prisma

[실행 파일](labs/prisma/mariadb.prisma)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:labs/prisma/mariadb.prisma sha256:6565ac4954c73b6e602ca5c247776e4832d7793c8f836fc5373c13860f1bb118 -->
~~~prisma
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
model CourseState {
  id       Int    @id
  data     String @db.LongText
  revision Int    @default(0)
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | ORM의 provider·연결·필드·id 규칙을 설정한다: generator client { |
| 2 | ORM의 provider·연결·필드·id 규칙을 설정한다: provider = "prisma-client-js" |
| 3 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 4 | ORM의 provider·연결·필드·id 규칙을 설정한다: datasource db { |
| 5 | ORM의 provider·연결·필드·id 규칙을 설정한다: provider = "mysql" |
| 6 | ORM의 provider·연결·필드·id 규칙을 설정한다: url      = env("DATABASE_URL") |
| 7 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 8 | ORM의 provider·연결·필드·id 규칙을 설정한다: model CourseState { |
| 9 | ORM의 provider·연결·필드·id 규칙을 설정한다: id       Int    @id |
| 10 | ORM의 provider·연결·필드·id 규칙을 설정한다: data     String @db.LongText |
| 11 | ORM의 provider·연결·필드·id 규칙을 설정한다: revision Int    @default(0) |
| 12 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

### labs/prisma/mongodb.prisma

[실행 파일](labs/prisma/mongodb.prisma)

아래는 실제 저장된 파일 전체다. 공용 모듈의 import는 링크한 파일과 package-lock.json의 설치 결과를 사용한다.

<!-- source:labs/prisma/mongodb.prisma sha256:6e0bc20ad75aef9cdeb7c5f7b0840a893b117e1cc2e9f9f7b9f21d44e4fcca4b -->
~~~prisma
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}
model CourseState {
  id       String @id @map("_id")
  data     String
  revision Int    @default(0)
}
~~~

줄 번호는 위 코드 블록의 첫 줄부터 센다. 빈 줄은 설명 표에서 제외한다.

| 줄 | 설명 |
|---|---|
| 1 | ORM의 provider·연결·필드·id 규칙을 설정한다: generator client { |
| 2 | ORM의 provider·연결·필드·id 규칙을 설정한다: provider = "prisma-client-js" |
| 3 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 4 | ORM의 provider·연결·필드·id 규칙을 설정한다: datasource db { |
| 5 | ORM의 provider·연결·필드·id 규칙을 설정한다: provider = "mongodb" |
| 6 | ORM의 provider·연결·필드·id 규칙을 설정한다: url      = env("DATABASE_URL") |
| 7 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |
| 8 | ORM의 provider·연결·필드·id 규칙을 설정한다: model CourseState { |
| 9 | ORM의 provider·연결·필드·id 규칙을 설정한다: id       String @id @map("_id") |
| 10 | ORM의 provider·연결·필드·id 규칙을 설정한다: data     String |
| 11 | ORM의 provider·연결·필드·id 규칙을 설정한다: revision Int    @default(0) |
| 12 | 열었던 블록·객체·배열·호출 또는 JSX 표현식을 닫는다. |

## ④ 🔗 연동 포인트

화면·v1 응답은 유지하고 Repository 연결만 바꾼다. 같은 DB_DRIVER/DATABASE_URL을 웹·워커·백업에 공급해야 한다. Docker 네트워크 내부에서는 localhost 대신 postgres/mariadb/mongodb 서비스명을 쓴다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
|---|---|---|
| ECONNREFUSED | DB 엔진·포트·컨테이너 미실행 | Docker 엔진과 profile·health 확인 |
| URL 변경 후 데이터 없음 | 데이터 자동 이관을 기대 | export/import와 건수 대조 |
| Mongo 갱신 충돌 | 다른 작성자가 revision 선점 | 순수 콜백 재시도, 대규모는 문서 분할 |

## ⑥ 직접 해보기

1. SQLite 데이터를 PostgreSQL로 이동하고 id·시간·비밀번호 로그인을 확인한다.
2. MariaDB와 MongoDB에서 같은 v1 API 호출을 실행한다.
3. 동시 글 작성 뒤 갱신 유실이 없는지 확인하고 한 행 잠금의 한계를 적는다.

## ⑦ ☐ 체크리스트

- [ ] MariaDB·PostgreSQL·MongoDB 연결 설정과 ORM 차이를 설명한다.
- [ ] DB 교체 전 백업과 빈 대상 import 절차를 준비했다.
- [ ] 실접속 결과는 엔진 실행 후 별도로 기록한다.

문서 제공과 학습자의 직접 수행은 다르므로 연습 체크는 비워 둔다. 실제 검증 증거는 [검증 기록](docs/validation.md)에서 확인한다.

## ⑧ 다음 단계 연결

[study12](study12.md)에서 Radix UI·Zustand·React Hook Form을 Next.js 클라이언트 경계 안에서 사용한다.

공식 기준: [Next.js 문서](https://nextjs.org/docs/app), [설치 버전의 가이드](tsx_version/project/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md). 상세 외부 API 출처는 [README](README.md)의 참고 링크를 따른다.
