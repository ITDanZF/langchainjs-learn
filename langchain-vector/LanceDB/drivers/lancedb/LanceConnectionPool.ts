import { createHash } from "node:crypto";
import * as lancedb from "@lancedb/lancedb";
import type {
  Connection,
  ConnectionOptions,
  SchemaLike,
  Table,
} from "@lancedb/lancedb";
import { RagStoreError } from "../../core/errors.ts";

export interface LanceDbConfig {
  uri: string;
  connectionOptions?: Partial<ConnectionOptions>;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/(key|secret|token|password|credential)/i.test(key))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function configFingerprint(config: LanceDbConfig): string {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(config.connectionOptions ?? {})))
    .digest("hex");
}

export class LanceConnectionPool {
  private readonly connections = new Map<string, Promise<Connection>>();
  private readonly tables = new Map<string, Promise<Table>>();

  constructor(private readonly config: LanceDbConfig) {}

  private connectionKey(): string {
    return `${this.config.uri}\u0000${configFingerprint(this.config)}`;
  }

  private tableKey(name: string): string {
    return `${this.connectionKey()}\u0000${name}`;
  }

  async connection(): Promise<Connection> {
    const key = this.connectionKey();
    const cached = this.connections.get(key);
    if (cached) {
      const connection = await cached;
      if (connection.isOpen()) return connection;
      this.connections.delete(key);
    }

    const connecting = lancedb
      .connect(this.config.uri, this.config.connectionOptions)
      .catch((cause) => {
        this.connections.delete(key);
        throw new RagStoreError(
          "CONNECTION_FAILED",
          "Failed to connect to LanceDB",
          { backend: "lancedb", operation: "connect", retryable: true },
          { cause },
        );
      });
    this.connections.set(key, connecting);
    return connecting;
  }

  async open(name: string): Promise<Table> {
    const key = this.tableKey(name);
    const cached = this.tables.get(key);
    if (cached) {
      const table = await cached;
      if (table.isOpen()) return table;
      this.tables.delete(key);
    }

    const opening = this.connection().then((connection) =>
      connection.openTable(name),
    );
    return this.cacheTable(key, opening);
  }

  async createIfMissing(name: string, schema: SchemaLike): Promise<Table> {
    const key = this.tableKey(name);
    const cached = this.tables.get(key);
    if (cached) return cached;

    const creating = this.connection().then((connection) =>
      connection.createEmptyTable(name, schema, { existOk: true }),
    );
    return this.cacheTable(key, creating);
  }

  private async cacheTable(
    key: string,
    promise: Promise<Table>,
  ): Promise<Table> {
    this.tables.set(key, promise);
    try {
      return await promise;
    } catch (error) {
      this.tables.delete(key);
      throw error;
    }
  }

  async exists(name: string): Promise<boolean> {
    try {
      await this.open(name);
      return true;
    } catch (error) {
      if (isMissingTableError(error)) return false;
      throw error;
    }
  }

  async dispose(): Promise<void> {
    const tables = [...this.tables.values()];
    const connections = [...this.connections.values()];
    this.tables.clear();
    this.connections.clear();
    await Promise.allSettled(
      tables.map(async (promise) => (await promise).close()),
    );
    await Promise.allSettled(
      connections.map(async (promise) => (await promise).close()),
    );
  }
}

export function isMissingTableError(error: unknown): boolean {
  if (error instanceof RagStoreError)
    return error.code === "COLLECTION_NOT_FOUND";
  const message = error instanceof Error ? error.message : String(error);
  return /table.*(not found|does not exist)|not found.*table/i.test(message);
}
