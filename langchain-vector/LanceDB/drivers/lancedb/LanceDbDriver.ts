import { isAbsolute, resolve } from "node:path";
import * as lancedb from "@lancedb/lancedb";
import type {
  ConnectionOptions,
  Query,
  QueryExecutionOptions,
  Table,
  VectorQuery,
} from "@lancedb/lancedb";
import type {
  CollectionDefinition,
  CollectionManagement,
  DriverCapabilities,
  DriverCollection,
  IndexDescription,
  ResolvedRetrieveRequest,
  RetrievalHit,
  VectorStoreDriver,
  WriteResult,
} from "../../core/contracts.ts";
import { invalidArgument, RagStoreError } from "../../core/errors.ts";
import { compileFilter, type FilterExpression } from "../../filters/index.ts";
import {
  LanceConnectionPool,
  type LanceDbConfig,
} from "./LanceConnectionPool.ts";
import { runLanceOperation } from "./LanceErrorMapper.ts";

export interface LanceDbDriverOptions {
  uri: string;
  connectionOptions?: Partial<ConnectionOptions>;
}

const capabilities: DriverCapabilities = {
  vectorSearch: true,
  fullTextSearch: true,
  hybridSearch: true,
  nativeRrf: true,
  customReranker: true,
  multiVector: "experimental",
  versioning: true,
  queryPlan: true,
  managedIndexes: false,
};

function normalizeUri(uri: string): string {
  if (!uri.trim()) invalidArgument("LanceDB URI must not be empty");
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(uri)) return uri;
  return isAbsolute(uri) ? resolve(uri) : resolve(process.cwd(), uri);
}

function validateConnectionOptions(options?: Partial<ConnectionOptions>): void {
  const interval = options?.readConsistencyInterval;
  if (interval !== undefined && (!Number.isFinite(interval) || interval < 0)) {
    invalidArgument(
      "readConsistencyInterval must be a finite non-negative number",
    );
  }
}

function rows<T extends object>(
  values: readonly T[],
): Record<string, unknown>[] {
  return values.map((value) => ({ ...value }) as Record<string, unknown>);
}

function validateDefinition<T extends object>(
  definition: CollectionDefinition<T>,
): void {
  if (!definition.name.trim())
    invalidArgument("Collection name must not be empty");
  if (!definition.vector.column.trim())
    invalidArgument("Vector column must not be empty", definition.name);
  if (
    !Number.isInteger(definition.vector.dimensions) ||
    definition.vector.dimensions < 1
  ) {
    invalidArgument(
      "Vector dimensions must be a positive integer",
      definition.name,
    );
  }
  if (
    (definition.initialization ?? "existing") === "create-if-missing" &&
    !definition.schema
  ) {
    invalidArgument(
      "create-if-missing requires an explicit Arrow schema",
      definition.name,
    );
  }
}

function validateVector(
  vector: readonly number[],
  dimensions: number,
  collection: string,
): void {
  if (
    vector.length !== dimensions ||
    !vector.every((value) => Number.isFinite(value))
  ) {
    throw new RagStoreError(
      "VECTOR_DIMENSION_MISMATCH",
      `Vector must contain ${dimensions} finite numbers`,
      { collection },
    );
  }
}

function numeric(
  row: Record<string, unknown>,
  key: string,
): number | undefined {
  return typeof row[key] === "number" ? row[key] : undefined;
}

class LanceCollection<T extends object> implements DriverCollection<T> {
  readonly definition: CollectionDefinition<T>;

  constructor(
    definition: CollectionDefinition<T>,
    private readonly pool: LanceConnectionPool,
  ) {
    validateDefinition(definition);
    this.definition = definition;
  }

  private async table(): Promise<Table> {
    const mode = this.definition.initialization ?? "existing";
    if (mode === "create-if-missing") {
      return runLanceOperation("initialize", this.definition.name, () =>
        this.pool.createIfMissing(
          this.definition.name,
          this.definition.schema!,
        ),
      );
    }
    return runLanceOperation("open", this.definition.name, () =>
      this.pool.open(this.definition.name),
    );
  }

  private validateRows(values: readonly T[]): void {
    for (const value of values) {
      const vector = (value as Record<string, unknown>)[
        this.definition.vector.column
      ];
      if (!Array.isArray(vector)) {
        invalidArgument(
          `Column '${this.definition.vector.column}' must be a numeric vector`,
          this.definition.name,
        );
      }
      validateVector(
        vector,
        this.definition.vector.dimensions,
        this.definition.name,
      );
    }
  }

  async append(values: readonly T[]): Promise<WriteResult> {
    if (values.length === 0) return { version: await this.currentVersion() };
    this.validateRows(values);
    const table = await this.table();
    const result = await runLanceOperation("append", this.definition.name, () =>
      table.add(rows(values)),
    );
    return { version: result.version, insertedRows: values.length };
  }

  async upsert(
    values: readonly T[],
    key: Extract<keyof T, string> | string,
    timeoutMs?: number,
  ): Promise<WriteResult> {
    if (!String(key).trim()) invalidArgument("Upsert key must not be empty");
    if (values.length === 0) return { version: await this.currentVersion() };
    this.validateRows(values);
    if (
      timeoutMs !== undefined &&
      (!Number.isFinite(timeoutMs) || timeoutMs < 1)
    )
      invalidArgument("timeoutMs must be a positive finite number");
    const table = await this.table();
    const result = await runLanceOperation("upsert", this.definition.name, () =>
      table
        .mergeInsert(String(key))
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute(rows(values), timeoutMs === undefined ? {} : { timeoutMs }),
    );
    return {
      version: result.version,
      insertedRows: result.numInsertedRows,
      updatedRows: result.numUpdatedRows,
      deletedRows: result.numDeletedRows,
    };
  }

  async retrieve(
    request: ResolvedRetrieveRequest<T>,
  ): Promise<RetrievalHit<T>[]> {
    if (request.consistency === "latest") await this.refresh();
    const table = await this.table();
    const query = await this.buildQuery(table, request);
    const selected = new Set<string>(request.select?.map(String) ?? []);
    if (this.definition.primaryKey)
      selected.add(String(this.definition.primaryKey));
    if (request.strategy === "vector") selected.add("_distance");
    if (request.strategy === "fts") selected.add("_score");
    if (selected.size > 0 && request.strategy !== "hybrid")
      query.select([...selected]);
    query.limit(request.candidates);

    const execution: Partial<QueryExecutionOptions> = {};
    if (request.timeoutMs !== undefined)
      execution.timeoutMs = request.timeoutMs;
    const raw = (await runLanceOperation("retrieve", this.definition.name, () =>
      query.toArray(execution),
    )) as Record<string, unknown>[];

    return raw.map((row) => this.mapHit(row, request));
  }

  private async buildQuery(
    table: Table,
    request: ResolvedRetrieveRequest<T>,
  ): Promise<Query | VectorQuery> {
    let query: Query | VectorQuery;
    let vectorQuery: VectorQuery | undefined;
    if (request.strategy === "fts") {
      if (!request.text) invalidArgument("FTS retrieval requires text");
      const columns = this.definition.text?.columns.map(String);
      query = table
        .query()
        .fullTextSearch(request.text, columns === undefined ? {} : { columns });
    } else {
      if (!request.vector)
        invalidArgument(`${request.strategy} retrieval requires a vector`);
      validateVector(
        request.vector,
        this.definition.vector.dimensions,
        this.definition.name,
      );
      vectorQuery = table
        .query()
        .nearestTo([...request.vector])
        .column(this.definition.vector.column)
        .distanceType(this.definition.vector.metric);
      query = vectorQuery;
      if (request.strategy === "hybrid") {
        if (!request.text) invalidArgument("Hybrid retrieval requires text");
        const columns = this.definition.text?.columns.map(String);
        query.fullTextSearch(
          request.text,
          columns === undefined ? {} : { columns },
        );
        query.rerank(await lancedb.rerankers.RRFReranker.create());
      }
    }

    if (request.filter) query.where(compileFilter(request.filter));
    if (request.filterMode === "post" && vectorQuery) vectorQuery.postfilter();
    if (request.accuracy === "exact" && vectorQuery)
      vectorQuery.bypassVectorIndex();
    if (request.accuracy === "indexed-only") query.fastSearch();
    if (request.refineFactor !== undefined && vectorQuery)
      vectorQuery.refineFactor(request.refineFactor);
    if (request.distanceRange && vectorQuery)
      vectorQuery.distanceRange(
        request.distanceRange.lower,
        request.distanceRange.upper,
      );
    return query;
  }

  private mapHit(
    row: Record<string, unknown>,
    request: ResolvedRetrieveRequest<T>,
  ): RetrievalHit<T> {
    const distance = numeric(row, "_distance");
    const fts = numeric(row, "_score");
    const relevance = numeric(row, "_relevance_score");
    const document = request.select
      ? Object.fromEntries(
          request.select
            .map(String)
            .filter((key) => key in row)
            .map((key) => [key, row[key]]),
        )
      : { ...row };
    delete document._distance;
    delete document._score;
    delete document._relevance_score;
    delete document._rowid;
    const kind =
      relevance !== undefined
        ? "relevance"
        : fts !== undefined
          ? "fts"
          : "distance";
    const value = relevance ?? fts ?? distance;
    if (value === undefined) {
      throw new RagStoreError(
        "OPERATION_FAILED",
        "LanceDB result did not contain an expected score column",
        { collection: this.definition.name, operation: "map-result" },
      );
    }
    const score = { kind, value } as RetrievalHit<T>["score"];
    if (distance !== undefined) score.distance = distance;
    if (fts !== undefined) score.fts = fts;
    const identity: RetrievalHit<T>["identity"] = {};
    if (this.definition.primaryKey)
      identity.primaryKey = row[String(this.definition.primaryKey)];
    if (row._rowid !== undefined) identity.rowId = String(row._rowid);
    const diagnostics: RetrievalHit<T>["diagnostics"] = {
      strategy: request.strategy,
      indexedOnly: request.accuracy === "indexed-only",
    };
    if (request.strategy === "hybrid")
      diagnostics.reranker = request.reranker ?? "rrf";
    return {
      document: document as Partial<T>,
      score,
      identity,
      diagnostics,
    };
  }

  async delete(expression: FilterExpression<T>): Promise<WriteResult> {
    const table = await this.table();
    const result = await runLanceOperation("delete", this.definition.name, () =>
      table.delete(compileFilter(expression)),
    );
    return { version: result.version };
  }

  async count(expression?: FilterExpression<T>): Promise<number> {
    const table = await this.table();
    return runLanceOperation("count", this.definition.name, () =>
      table.countRows(expression ? compileFilter(expression) : undefined),
    );
  }

  exists(): Promise<boolean> {
    return this.pool.exists(this.definition.name);
  }

  async refresh(): Promise<void> {
    const table = await this.table();
    await runLanceOperation("refresh", this.definition.name, () =>
      table.checkoutLatest(),
    );
  }

  manage(): CollectionManagement {
    return new LanceManagement(this.definition, this.pool);
  }

  private async currentVersion(): Promise<number> {
    if (!(await this.exists())) return 0;
    return (await this.table()).version();
  }
}

class LanceManagement<T extends object> implements CollectionManagement {
  constructor(
    private readonly definition: CollectionDefinition<T>,
    private readonly pool: LanceConnectionPool,
  ) {}

  private table(): Promise<Table> {
    return runLanceOperation("manage", this.definition.name, () =>
      this.pool.open(this.definition.name),
    );
  }

  async createVectorIndex(
    options: {
      replace?: boolean;
      numPartitions?: number;
      numSubVectors?: number;
    } = {},
  ): Promise<void> {
    const table = await this.table();
    const indexConfig: Parameters<typeof lancedb.Index.ivfPq>[0] = {
      distanceType: this.definition.vector.metric,
    };
    if (options.numPartitions !== undefined)
      indexConfig.numPartitions = options.numPartitions;
    if (options.numSubVectors !== undefined)
      indexConfig.numSubVectors = options.numSubVectors;
    await runLanceOperation("create-vector-index", this.definition.name, () =>
      table.createIndex(this.definition.vector.column, {
        ...(options.replace === undefined ? {} : { replace: options.replace }),
        config: lancedb.Index.ivfPq(indexConfig),
      }),
    );
  }

  async createFtsIndex(
    column: string,
    options: { replace?: boolean } = {},
  ): Promise<void> {
    const table = await this.table();
    await runLanceOperation("create-fts-index", this.definition.name, () =>
      table.createIndex(column, {
        ...(options.replace === undefined ? {} : { replace: options.replace }),
        config: lancedb.Index.fts({ baseTokenizer: "icu" }),
      }),
    );
  }

  async createScalarIndex(
    column: string,
    options: { replace?: boolean } = {},
  ): Promise<void> {
    const table = await this.table();
    await runLanceOperation("create-scalar-index", this.definition.name, () =>
      table.createIndex(column, {
        ...(options.replace === undefined ? {} : { replace: options.replace }),
        config: lancedb.Index.btree(),
      }),
    );
  }

  async listIndexes(): Promise<IndexDescription[]> {
    const table = await this.table();
    const indexes = await runLanceOperation(
      "list-indexes",
      this.definition.name,
      () => table.listIndices(),
    );
    return indexes.map((index) => {
      const description: IndexDescription = {
        name: index.name,
        columns: index.columns,
        type: index.indexType,
      };
      if (index.numIndexedRows !== undefined)
        description.indexedRows = index.numIndexedRows;
      if (index.numUnindexedRows !== undefined)
        description.unindexedRows = index.numUnindexedRows;
      return description;
    });
  }

  async optimize(options: { cleanupOlderThan?: Date } = {}): Promise<unknown> {
    const table = await this.table();
    return runLanceOperation("optimize", this.definition.name, () =>
      table.optimize(
        options.cleanupOlderThan
          ? { cleanupOlderThan: options.cleanupOlderThan }
          : undefined,
      ),
    );
  }

  async version(): Promise<number> {
    return (await this.table()).version();
  }

  async listVersions(): Promise<Array<{ version: number; timestamp: Date }>> {
    const versions = await (await this.table()).listVersions();
    return versions.map(({ version, timestamp }) => ({ version, timestamp }));
  }
}

export class LanceDbDriver implements VectorStoreDriver {
  readonly id = "lancedb";
  readonly capabilities = capabilities;
  private readonly pool: LanceConnectionPool;

  constructor(options: LanceDbDriverOptions) {
    validateConnectionOptions(options.connectionOptions);
    const config: LanceDbConfig = { uri: normalizeUri(options.uri) };
    if (options.connectionOptions !== undefined)
      config.connectionOptions = options.connectionOptions;
    this.pool = new LanceConnectionPool(config);
  }

  collection<T extends object>(
    definition: CollectionDefinition<T>,
  ): DriverCollection<T> {
    return new LanceCollection(definition, this.pool);
  }

  dispose(): Promise<void> {
    return this.pool.dispose();
  }
}

export function lanceDb(options: LanceDbDriverOptions): LanceDbDriver {
  return new LanceDbDriver(options);
}
