import type { SchemaLike } from "@lancedb/lancedb";
import type { FilterExpression } from "../filters/index.ts";

export type DistanceMetric = "l2" | "cosine" | "dot";
export type RetrievalStrategy = "vector" | "fts" | "hybrid";
export type SearchAccuracy = "balanced" | "exact" | "indexed-only";
export type InitializationMode = "existing" | "create-if-missing";

export interface Embedder {
  readonly id: string;
  readonly dimensions: number;
  embedDocuments(texts: readonly string[]): Promise<readonly number[][]>;
  embedQuery(text: string): Promise<readonly number[]>;
}

export interface CollectionDefinition<T extends object> {
  name: string;
  schema?: SchemaLike;
  initialization?: InitializationMode;
  vector: {
    column: Extract<keyof T, string> | string;
    dimensions: number;
    metric: DistanceMetric;
  };
  text?: {
    columns: Array<Extract<keyof T, string> | string>;
    sourceColumn?: Extract<keyof T, string> | string;
  };
  primaryKey?: Extract<keyof T, string> | string;
  tenantKey?: Extract<keyof T, string> | string;
}

export interface RetrieveRequest<T extends object> {
  text?: string;
  vector?: readonly number[];
  strategy?: RetrievalStrategy;
  topK?: number;
  candidates?: number;
  filter?: FilterExpression<T>;
  select?: Array<Extract<keyof T, string>>;
  consistency?: "configured" | "latest";
  accuracy?: SearchAccuracy;
  filterMode?: "pre" | "post";
  refineFactor?: number;
  distanceRange?: { lower?: number; upper?: number };
  timeoutMs?: number;
  reranker?: string;
}

export interface RetrievalScore {
  kind: "distance" | "fts" | "relevance";
  value: number;
  distance?: number;
  fts?: number;
}

export interface RetrievalHit<T extends object> {
  document: Partial<T>;
  score: RetrievalScore;
  identity: {
    primaryKey?: unknown;
    rowId?: string;
  };
  diagnostics: {
    strategy: RetrievalStrategy;
    indexedOnly: boolean;
    reranker?: string;
  };
}

export interface RerankRequest<T extends object> {
  query: string;
  candidates: readonly RetrievalHit<T>[];
  limit: number;
}

export interface Reranker<T extends object> {
  readonly id: string;
  rerank(request: RerankRequest<T>): Promise<readonly RetrievalHit<T>[]>;
}

export interface RequestContext {
  tenantId?: string;
  traceId?: string;
  attributes?: Readonly<Record<string, string>>;
}

export interface TenantPolicy {
  scope<T extends object>(
    context: RequestContext,
    definition: CollectionDefinition<T>,
  ): FilterExpression<T> | undefined;
}

export interface WriteResult {
  version: number;
  insertedRows?: number;
  updatedRows?: number;
  deletedRows?: number;
}

export interface DriverCapabilities {
  vectorSearch: boolean;
  fullTextSearch: boolean;
  hybridSearch: boolean;
  nativeRrf: boolean;
  customReranker: boolean;
  multiVector: "unsupported" | "experimental" | "stable";
  versioning: boolean;
  queryPlan: boolean;
  managedIndexes: boolean;
}

export interface IndexDescription {
  name: string;
  columns: string[];
  type: string;
  indexedRows?: number;
  unindexedRows?: number;
}

export interface CollectionManagement {
  createVectorIndex(options?: {
    replace?: boolean;
    numPartitions?: number;
    numSubVectors?: number;
  }): Promise<void>;
  createFtsIndex(
    column: string,
    options?: { replace?: boolean },
  ): Promise<void>;
  createScalarIndex(
    column: string,
    options?: { replace?: boolean },
  ): Promise<void>;
  listIndexes(): Promise<IndexDescription[]>;
  optimize(options?: { cleanupOlderThan?: Date }): Promise<unknown>;
  version(): Promise<number>;
  listVersions(): Promise<Array<{ version: number; timestamp: Date }>>;
}

export interface DriverCollection<T extends object> {
  readonly definition: CollectionDefinition<T>;
  append(rows: readonly T[]): Promise<WriteResult>;
  upsert(
    rows: readonly T[],
    key: Extract<keyof T, string> | string,
    timeoutMs?: number,
  ): Promise<WriteResult>;
  retrieve(request: ResolvedRetrieveRequest<T>): Promise<RetrievalHit<T>[]>;
  delete(filter: FilterExpression<T>): Promise<WriteResult>;
  count(filter?: FilterExpression<T>): Promise<number>;
  exists(): Promise<boolean>;
  refresh(): Promise<void>;
  manage(): CollectionManagement;
}

export interface ResolvedRetrieveRequest<
  T extends object,
> extends RetrieveRequest<T> {
  strategy: RetrievalStrategy;
  topK: number;
  candidates: number;
  accuracy: SearchAccuracy;
  filterMode: "pre" | "post";
  vector?: readonly number[];
}

export interface VectorStoreDriver {
  readonly id: string;
  readonly capabilities: DriverCapabilities;
  collection<T extends object>(
    definition: CollectionDefinition<T>,
  ): DriverCollection<T>;
  dispose(): Promise<void>;
}
