import Database, {
  type Database as BetterSqliteDatabase,
} from "better-sqlite3";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { getAgentHome } from "../workspace/path.ts";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

export default class SqliteStore {
  private readonly db: BetterSqliteDatabase;
  private readonly checkPointer: SqliteSaver;

  constructor(dbPath = path.join(getAgentHome(), "sessions", "memory.sqlite")) {
    mkdirSync(path.dirname(dbPath), { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    this.checkPointer = new SqliteSaver(this.db);
  }

  getCheckpointer() {
    return this.checkPointer;
  }

  getCheckPointer() {
    return this.getCheckpointer();
  }

  close() {
    this.db.close();
  }
}
