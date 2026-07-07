import Database, {
  type Database as BetterSqliteDatabase,
} from "better-sqlite3";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { getAgentHome } from "../workspace/path.ts";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
export type ThreadInfo = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

type ThreadRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};
export default class SqliteStore {
  private readonly db: BetterSqliteDatabase;
  private readonly checkPointer: SqliteSaver;
  constructor(dbPath = path.join(getAgentHome(), "sessions", "memory.sqlite")) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    this.checkPointer = new SqliteSaver(this.db);

    this.setupSchema();
  }

  getCheckPointer() {
    return this.checkPointer;
  }

  getThread(threadId: string): ThreadInfo | null {
    const row = this.db
      .prepare("SELECT * FROM conversation_threads WHERE id = ?")
      .get(threadId) as ThreadRow | undefined;

    return row ? this.toThreadInfo(row) : null;
  }

  createThread(title: string, id = crypto.randomUUID()): ThreadInfo {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        INSERT INTO conversation_threads (id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        `,
      )
      .run(id, title, now, now);

    return {
      id,
      title,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  setupSchema() {
    this.db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS conversation_threads (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        `,
      )
      .run();
  }

  private toThreadInfo(row: ThreadRow): ThreadInfo {
    return {
      id: row.id,
      title: row.title,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  listThreads(): ThreadInfo[] {
    const rows = this.db
      .prepare(
        `
      SELECT id, title, created_at, updated_at
      FROM conversation_threads
      ORDER BY updated_at DESC
      `,
      )
      .all() as ThreadRow[];

    return rows.map((row) => this.toThreadInfo(row));
  }

  updateThreadTitle(threadId: string, title: string) {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
      UPDATE conversation_threads
      SET title = ?, updated_at = ?
      WHERE id = ?
      `,
      )
      .run(title, now, threadId);
  }

  touchThread(threadId: string) {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
      UPDATE conversation_threads
      SET updated_at = ?
      WHERE id = ?
      `,
      )
      .run(now, threadId);
  }

  deleteThread(threadId: string) {
    this.db
      .prepare("DELETE FROM conversation_threads WHERE id = ?")
      .run(threadId);
  }

  close() {
    this.db.close();
  }
}
