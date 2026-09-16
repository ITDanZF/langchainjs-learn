import { isAbsolute, resolve } from "node:path";
import * as lancedb from "@lancedb/lancedb";
import type {
  Connection,
  ConnectionOptions,
  SchemaLike,
  Table,
} from "@lancedb/lancedb";

export { createRagStore, RagCollection, RagStore } from "./core/RagStore.ts";
export { RagStoreError } from "./core/errors.ts";
export { RequiredTenantPolicy } from "./core/tenant.ts";
export type {
  CollectionDefinition,
  CollectionManagement,
  DriverCapabilities,
  Embedder,
  RequestContext,
  Reranker,
  RetrieveRequest,
  RetrievalHit,
  RetrievalScore,
  TenantPolicy,
  VectorStoreDriver,
  WriteResult,
} from "./core/contracts.ts";
export { compileFilter, filter } from "./filters/index.ts";
export type { FilterExpression } from "./filters/index.ts";
export { LanceDbDriver, lanceDb } from "./drivers/lancedb/LanceDbDriver.ts";
export type { LanceDbDriverOptions } from "./drivers/lancedb/LanceDbDriver.ts";

export type DistanceMetric = "l2" | "cosine" | "dot";
export type VectorRecord = object;
export type SearchResult<T> = Partial<T> & { _distance: number };

export interface LanceDBConfig {
  uri?: string;
  defaultMetric?: DistanceMetric;
  readConsistencyInterval?: number;
}

export interface LanceTableOptions extends LanceDBConfig {
  vectorColumn?: string;
  schema?: SchemaLike;
}

export interface VectorSearchOptions<T> {
  limit?: number;
  filter?: string;
  select?: Array<Extract<keyof T, string> | "_distance">;
  exact?: boolean;
  refineFactor?: number;
}

interface ResolvedOptions {
  uri: string;
  vectorColumn: string;
  defaultMetric: DistanceMetric;
  readConsistencyInterval?: number | undefined;
  schema?: SchemaLike | undefined;
}

class ConnectionRegistry {
  private static readonly connections = new Map<string, Promise<Connection>>();
  private static readonly tables = new Map<string, Promise<Table>>();
  private static cleanupRegistered = false;

  static getConnection(options: ResolvedOptions): Promise<Connection> {
    this.registerCleanup();
    const key = this.connectionKey(options);
    const cached = this.connections.get(key);
    if (cached) return cached;

    const connectionOptions: Partial<ConnectionOptions> = {};
    if (options.readConsistencyInterval !== undefined) {
      connectionOptions.readConsistencyInterval =
        options.readConsistencyInterval;
    }
    const connecting = lancedb
      .connect(options.uri, connectionOptions)
      .catch((error) => {
        this.connections.delete(key);
        throw error;
      });
    this.connections.set(key, connecting);
    return connecting;
  }

  static async getExistingTable(
    options: ResolvedOptions,
    tableName: string,
  ): Promise<Table> {
    const key = this.tableKey(options, tableName);
    const cached = this.tables.get(key);
    if (cached) {
      const table = await cached;
      if (table.isOpen()) return table;
      this.tables.delete(key);
    }

    const connection = await this.getConnection(options);
    const names = await connection.tableNames();
    if (!names.includes(tableName)) {
      throw new LanceStoreError(
        "TABLE_NOT_FOUND",
        `Table '${tableName}' does not exist`,
        tableName,
      );
    }
    return this.cacheTable(key, connection.openTable(tableName));
  }

  static async getTableForInsert(
    options: ResolvedOptions,
    tableName: string,
    rows: Record<string, unknown>[],
  ): Promise<{ table: Table; rowsAlreadyInserted: boolean }> {
    const key = this.tableKey(options, tableName);
    const cached = this.tables.get(key);
    if (cached) return { table: await cached, rowsAlreadyInserted: false };

    const initializing = this.initializeTable(options, tableName, rows);
    this.tables.set(
      key,
      initializing.then((result) => result.table),
    );
    try {
      return await initializing;
    } catch (error) {
      this.tables.delete(key);
      throw error;
    }
  }

  private static async initializeTable(
    options: ResolvedOptions,
    tableName: string,
    rows: Record<string, unknown>[],
  ): Promise<{ table: Table; rowsAlreadyInserted: boolean }> {
    const connection = await this.getConnection(options);
    const names = await connection.tableNames();
    if (names.includes(tableName)) {
      return {
        table: await connection.openTable(tableName),
        rowsAlreadyInserted: false,
      };
    }
    if (options.schema) {
      const table = await connection.createEmptyTable(
        tableName,
        options.schema,
        { existOk: true },
      );
      return { table, rowsAlreadyInserted: false };
    }
    const table = await connection.createTable(tableName, rows);
    return { table, rowsAlreadyInserted: true };
  }

  private static async cacheTable(
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

  private static connectionKey(options: ResolvedOptions): string {
    return `${options.uri}\u0000${options.readConsistencyInterval ?? "default"}`;
  }

  private static tableKey(options: ResolvedOptions, tableName: string): string {
    return `${this.connectionKey(options)}\u0000${tableName}`;
  }

  private static registerCleanup(): void {
    if (this.cleanupRegistered) return;
    this.cleanupRegistered = true;
    process.once("beforeExit", () => {
      for (const table of this.tables.values()) {
        void table.then((value) => value.close()).catch(() => undefined);
      }
      for (const connection of this.connections.values()) {
        void connection.then((value) => value.close()).catch(() => undefined);
      }
      this.tables.clear();
      this.connections.clear();
    });
  }
}

export class LanceStoreError extends Error {
  constructor(
    public readonly code:
      | "INVALID_ARGUMENT"
      | "TABLE_NOT_FOUND"
      | "OPERATION_FAILED",
    message: string,
    public readonly tableName?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LanceStoreError";
  }
}

export class LanceTableStore<T extends VectorRecord> {
  constructor(
    private readonly tableName: string,
    private readonly options: ResolvedOptions,
  ) {}

  async insert(rows: readonly T[]): Promise<void> {
    if (rows.length === 0) return;
    this.validateRows(rows);
    const mutableRows = rows.map(
      (row) => ({ ...row }) as Record<string, unknown>,
    );
    const { table, rowsAlreadyInserted } =
      await ConnectionRegistry.getTableForInsert(
        this.options,
        this.tableName,
        mutableRows,
      );
    if (!rowsAlreadyInserted) await table.add(mutableRows);
  }

  async search(
    vector: readonly number[],
    options: VectorSearchOptions<T> = {},
  ): Promise<Array<SearchResult<T>>> {
    this.validateVector(vector);
    const limit = options.limit ?? 10;
    if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) {
      throw new LanceStoreError(
        "INVALID_ARGUMENT",
        "Search limit must be between 1 and 10000",
        this.tableName,
      );
    }
    if (options.refineFactor !== undefined && options.refineFactor < 1) {
      throw new LanceStoreError(
        "INVALID_ARGUMENT",
        "refineFactor must be at least 1",
        this.tableName,
      );
    }

    const table = await ConnectionRegistry.getExistingTable(
      this.options,
      this.tableName,
    );
    let query = table
      .query()
      .nearestTo([...vector])
      .column(this.options.vectorColumn)
      .distanceType(this.options.defaultMetric);
    if (options.filter) query = query.where(options.filter);
    if (options.select) {
      query = query.select([...new Set([...options.select, "_distance"])]);
    }
    if (options.exact) query = query.bypassVectorIndex();
    if (options.refineFactor !== undefined)
      query = query.refineFactor(options.refineFactor);
    return query.limit(limit).toArray() as Promise<Array<SearchResult<T>>>;
  }

  async delete(filter: string): Promise<void> {
    if (!filter.trim()) {
      throw new LanceStoreError(
        "INVALID_ARGUMENT",
        "Delete filter must not be empty",
        this.tableName,
      );
    }
    const table = await ConnectionRegistry.getExistingTable(
      this.options,
      this.tableName,
    );
    await table.delete(filter);
  }

  async count(filter?: string): Promise<number> {
    const table = await ConnectionRegistry.getExistingTable(
      this.options,
      this.tableName,
    );
    return table.countRows(filter);
  }

  async exists(): Promise<boolean> {
    try {
      await ConnectionRegistry.getExistingTable(this.options, this.tableName);
      return true;
    } catch (error) {
      if (error instanceof LanceStoreError && error.code === "TABLE_NOT_FOUND")
        return false;
      throw error;
    }
  }

  async refresh(): Promise<void> {
    const table = await ConnectionRegistry.getExistingTable(
      this.options,
      this.tableName,
    );
    await table.checkoutLatest();
  }

  private validateRows(rows: readonly T[]): void {
    let dimension: number | undefined;
    for (const row of rows) {
      const vector = (row as Record<string, unknown>)[
        this.options.vectorColumn
      ];
      if (!Array.isArray(vector)) {
        throw new LanceStoreError(
          "INVALID_ARGUMENT",
          `Column '${this.options.vectorColumn}' must be a numeric vector`,
          this.tableName,
        );
      }
      this.validateVector(vector);
      dimension ??= vector.length;
      if (vector.length !== dimension) {
        throw new LanceStoreError(
          "INVALID_ARGUMENT",
          "All vectors must have the same dimension",
          this.tableName,
        );
      }
    }
  }

  private validateVector(vector: readonly unknown[]): void {
    if (
      vector.length === 0 ||
      !vector.every(
        (value) => typeof value === "number" && Number.isFinite(value),
      )
    ) {
      throw new LanceStoreError(
        "INVALID_ARGUMENT",
        "Vector must contain finite numbers",
        this.tableName,
      );
    }
  }
}

export default class LanceDB {
  private static config: Required<
    Pick<LanceDBConfig, "uri" | "defaultMetric">
  > &
    Pick<LanceDBConfig, "readConsistencyInterval"> = {
    uri: resolve(process.cwd(), "data", "lancedb"),
    defaultMetric: "l2",
  };

  static configure(config: LanceDBConfig): void {
    this.config = {
      ...this.config,
      ...config,
      uri: config.uri ? this.normalizeUri(config.uri) : this.config.uri,
    };
  }

  static table<T extends VectorRecord>(
    tableName: string,
    options: LanceTableOptions = {},
  ): LanceTableStore<T> {
    if (!tableName.trim()) {
      throw new LanceStoreError(
        "INVALID_ARGUMENT",
        "Table name must not be empty",
      );
    }
    const uri = this.normalizeUri(
      options.uri ?? process.env.LANCEDB_URI ?? this.config.uri,
    );
    return new LanceTableStore<T>(tableName, {
      uri,
      vectorColumn: options.vectorColumn ?? "vector",
      defaultMetric: options.defaultMetric ?? this.config.defaultMetric,
      readConsistencyInterval:
        options.readConsistencyInterval ?? this.config.readConsistencyInterval,
      schema: options.schema,
    });
  }

  private static normalizeUri(uri: string): string {
    if (!uri.trim())
      throw new LanceStoreError(
        "INVALID_ARGUMENT",
        "Database URI must not be empty",
      );
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(uri)) return uri;
    return isAbsolute(uri) ? resolve(uri) : resolve(process.cwd(), uri);
  }
}
