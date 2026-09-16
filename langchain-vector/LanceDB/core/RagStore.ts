import type {
  CollectionDefinition,
  CollectionManagement,
  DriverCollection,
  Embedder,
  RequestContext,
  ResolvedRetrieveRequest,
  Reranker,
  RetrieveRequest,
  RetrievalHit,
  TenantPolicy,
  VectorStoreDriver,
  WriteResult,
} from "./contracts.ts";
import { invalidArgument, RagStoreError } from "./errors.ts";
import { filter, type FilterExpression } from "../filters/index.ts";

export interface RagStoreOptions {
  driver: VectorStoreDriver;
  embedder?: Embedder;
  rerankers?: readonly Reranker<object>[];
  tenantPolicy?: TenantPolicy;
  maxTopK?: number;
  maxCandidates?: number;
}

export class RagCollection<T extends object> {
  constructor(
    private readonly collection: DriverCollection<T>,
    private readonly options: RagStoreOptions,
    private readonly context: RequestContext,
  ) {}

  get definition(): CollectionDefinition<T> {
    return this.collection.definition;
  }

  async append(rows: readonly T[]): Promise<WriteResult> {
    this.assertTenantRows(rows);
    return this.collection.append(rows);
  }

  async upsert(
    rows: readonly T[],
    options: {
      key?: Extract<keyof T, string> | string;
      timeoutMs?: number;
    } = {},
  ): Promise<WriteResult> {
    const key = options.key ?? this.definition.primaryKey;
    if (!key) invalidArgument("Upsert requires a key or collection primaryKey");
    this.assertTenantRows(rows);
    return this.collection.upsert(rows, key, options.timeoutMs);
  }

  async retrieve(request: RetrieveRequest<T>): Promise<RetrievalHit<T>[]> {
    const resolved = await this.resolveRequest(request);
    let hits = await this.collection.retrieve(resolved);
    if (resolved.reranker && resolved.reranker !== "rrf") {
      const reranker = this.findReranker(resolved.reranker);
      hits = [
        ...(await reranker.rerank({
          query: resolved.text ?? "",
          candidates: hits,
          limit: resolved.topK,
        })),
      ];
    }
    return hits.slice(0, resolved.topK);
  }

  async delete(expression: FilterExpression<T>): Promise<WriteResult> {
    return this.collection.delete(this.withTenantScope(expression)!);
  }

  async count(expression?: FilterExpression<T>): Promise<number> {
    const scoped = this.withTenantScope(expression);
    return this.collection.count(scoped);
  }

  exists(): Promise<boolean> {
    return this.collection.exists();
  }

  refresh(): Promise<void> {
    return this.collection.refresh();
  }

  private async resolveRequest(
    request: RetrieveRequest<T>,
  ): Promise<ResolvedRetrieveRequest<T>> {
    const strategy = request.strategy ?? (request.text ? "vector" : "vector");
    this.assertCapability(strategy);
    const maxTopK = this.options.maxTopK ?? 100;
    const maxCandidates = this.options.maxCandidates ?? 1_000;
    const topK = request.topK ?? 10;
    const candidates =
      request.candidates ??
      Math.max(topK, strategy === "hybrid" ? topK * 4 : topK);

    if (!Number.isInteger(topK) || topK < 1 || topK > maxTopK)
      invalidArgument(`topK must be an integer between 1 and ${maxTopK}`);
    if (
      !Number.isInteger(candidates) ||
      candidates < topK ||
      candidates > maxCandidates
    ) {
      invalidArgument(
        `candidates must be an integer between topK and ${maxCandidates}`,
      );
    }
    if (
      request.timeoutMs !== undefined &&
      (!Number.isFinite(request.timeoutMs) || request.timeoutMs < 1)
    ) {
      invalidArgument("timeoutMs must be a positive finite number");
    }
    if (
      request.refineFactor !== undefined &&
      (!Number.isFinite(request.refineFactor) || request.refineFactor < 1)
    ) {
      invalidArgument("refineFactor must be a finite number of at least 1");
    }
    if (request.filterMode === "post" && !request.filter && !this.tenantScope())
      invalidArgument("postfilter requires a filter expression");
    if (request.accuracy === "exact" && request.filterMode === "post")
      invalidArgument("exact search cannot be combined with postfilter");

    let vector = request.vector;
    if ((strategy === "vector" || strategy === "hybrid") && !vector) {
      if (!request.text)
        invalidArgument(`${strategy} retrieval requires text or vector`);
      if (!this.options.embedder)
        throw new RagStoreError(
          "CAPABILITY_NOT_SUPPORTED",
          "Text-to-vector retrieval requires an Embedder plugin",
          { collection: this.definition.name },
        );
      vector = await this.options.embedder.embedQuery(request.text);
    }
    if ((strategy === "fts" || strategy === "hybrid") && !request.text)
      invalidArgument(`${strategy} retrieval requires text`);

    const selected = new Set(request.select ?? []);
    if (request.reranker && request.reranker !== "rrf") {
      const sourceColumn = this.definition.text?.sourceColumn;
      if (!sourceColumn)
        invalidArgument("External reranking requires text.sourceColumn");
      selected.add(sourceColumn as Extract<keyof T, string>);
      this.findReranker(request.reranker);
    }

    const resolved: ResolvedRetrieveRequest<T> = {
      ...request,
      strategy,
      topK,
      candidates,
      accuracy: request.accuracy ?? "balanced",
      filterMode: request.filterMode ?? "pre",
    };
    const scopedFilter = this.withTenantScope(request.filter);
    if (scopedFilter !== undefined) resolved.filter = scopedFilter;
    if (selected.size > 0) resolved.select = [...selected];
    if (vector !== undefined) resolved.vector = vector;
    return resolved;
  }

  private assertCapability(strategy: "vector" | "fts" | "hybrid"): void {
    const capabilities = this.options.driver.capabilities;
    const supported =
      strategy === "vector"
        ? capabilities.vectorSearch
        : strategy === "fts"
          ? capabilities.fullTextSearch
          : capabilities.hybridSearch;
    if (!supported) {
      throw new RagStoreError(
        "CAPABILITY_NOT_SUPPORTED",
        `Driver '${this.options.driver.id}' does not support ${strategy} retrieval`,
        { collection: this.definition.name },
      );
    }
    if ((strategy === "fts" || strategy === "hybrid") && !this.definition.text)
      invalidArgument(`${strategy} retrieval requires collection text columns`);
  }

  private findReranker(id: string): Reranker<T> {
    const reranker = this.options.rerankers?.find((item) => item.id === id);
    if (!reranker) {
      throw new RagStoreError(
        "CAPABILITY_NOT_SUPPORTED",
        `Reranker '${id}' is not registered`,
        { collection: this.definition.name },
      );
    }
    return reranker as Reranker<T>;
  }

  private tenantScope(): FilterExpression<T> | undefined {
    return this.options.tenantPolicy?.scope(this.context, this.definition);
  }

  private assertTenantRows(rows: readonly T[]): void {
    if (!this.definition.tenantKey) return;
    if (!this.context.tenantId) {
      throw new RagStoreError(
        "INVALID_ARGUMENT",
        `Collection '${this.definition.name}' requires tenant context`,
        { collection: this.definition.name },
      );
    }
    const tenantKey = String(this.definition.tenantKey);
    for (const row of rows) {
      if (
        (row as Record<string, unknown>)[tenantKey] !== this.context.tenantId
      ) {
        throw new RagStoreError(
          "INVALID_ARGUMENT",
          `Row '${tenantKey}' must match the active tenant`,
          { collection: this.definition.name },
        );
      }
    }
  }

  private withTenantScope(
    expression?: FilterExpression<T>,
  ): FilterExpression<T> | undefined {
    const tenant = this.tenantScope();
    if (tenant && expression) return filter.and(tenant, expression);
    return tenant ?? expression;
  }
}

export class RagStore {
  constructor(private readonly options: RagStoreOptions) {
    if (!options.driver) invalidArgument("RagStore requires a driver");
  }

  collection<T extends object>(
    definition: CollectionDefinition<T>,
    context: RequestContext = {},
  ): RagCollection<T> {
    return new RagCollection(
      this.options.driver.collection(definition),
      this.options,
      context,
    );
  }

  get capabilities() {
    return this.options.driver.capabilities;
  }

  manage<T extends object>(
    definition: CollectionDefinition<T>,
  ): CollectionManagement {
    return this.options.driver.collection(definition).manage();
  }

  dispose(): Promise<void> {
    return this.options.driver.dispose();
  }
}

export function createRagStore(options: RagStoreOptions): RagStore {
  return new RagStore(options);
}
