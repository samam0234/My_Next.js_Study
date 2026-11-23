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
