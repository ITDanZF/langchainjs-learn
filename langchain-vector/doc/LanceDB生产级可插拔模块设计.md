# LanceDB 生产级可插拔 RAG 存储模块设计

## 1. 文档定位

本文将当前 `LanceDB/index.ts` 从本地学习型 Store，重新定义为可用于复杂 RAG 系统的生产级存储模块。目标不是继续堆叠 LanceDB SDK 方法，而是建立：

- 简单、稳定的业务 API。
- 可替换的向量数据库驱动。
- 可插拔的 embedding、重排、策略、观测与租户治理能力。
- 对 LanceDB OSS、对象存储和 Enterprise 差异的显式处理。
- 可测试、可演进、可降级且不会静默改变检索语义的工程边界。

本文只做分析与设计，不直接修改实现。

## 2. 新功能开发评估

- **任务分类**：现有功能增强，规模等同于新功能架构开发。
- **流程假设**：用户暂时无法交互确认，按推荐的新功能开发流程继续，仅生成分析文档，不实施代码。
- **新增能力**：生产连接、集合管理、幂等写入、向量/全文/混合检索、插件装配、租户隔离、索引维护、版本治理、可观测性和框架适配。
- **拆分判断**：必须拆分。当前单文件同时承担公共 API、SDK 适配、资源生命周期、查询构造和校验，无法独立测试或替换。
- **拆分原则**：按变化原因拆分，不为每个方法建立文件；核心生产文件控制在约 8 至 12 个，其余能力以独立插件包扩展。
- **过度集中风险**：任何新增 RAG 策略都会修改核心 Store，最终形成不可测试的 SDK 大包装器。
- **过度拆分风险**：把每个查询参数抽成服务会增加装配和调试成本。应保持一个驱动、一个集合 Store、一个检索编排器作为主路径。

## 3. 核心结论

### 3.1 推荐架构

采用四层结构：

```text
业务 / LangChain.js / Agent
            |
    稳定的 RagStore API
            |
  检索与写入策略 + 插件端口
            |
      VectorStoreDriver
            |
 LanceDB OSS / Object Store / Enterprise
```

其中：

- `RagStore` 是业务入口，不暴露 LanceDB 类型。
- `VectorStoreDriver` 是后端可替换边界，LanceDB 是首个实现。
- embedding、reranker、查询策略、租户策略、遥测使用窄接口插拔。
- 索引、优化和版本恢复属于管理面，不混入普通检索 API。

### 3.2 不推荐方案

不建议建立一个包含几十个可选字段的 `LanceDB.configure(...)`，再通过布尔开关组合所有行为。它会产生不可验证的配置状态，例如同时设置 `fastSearch`、强一致、精确搜索和模型重排，却没有明确的延迟与完整性语义。

也不建议把 LanceDB 原始 Query Builder 暴露给业务代码。这样虽然“功能完整”，但后端无法替换，租户过滤、超时、审计和错误映射也可被绕过。

## 4. 设计目标与非目标

### 4.1 目标

1. 三行内完成常见 RAG 存储与检索。
2. 业务代码不管理连接、表句柄、索引缓存和关闭顺序。
3. 支持本地路径、`s3://`、`gs://`、`az://` 和 `db://`。
4. 支持追加、幂等 upsert、删除、向量检索、FTS 和混合检索。
5. 支持外部 embedding 与 LanceDB embedding registry 两种模式。
6. 支持自定义重排器，但不把模型供应商依赖装进核心包。
7. 支持租户隔离、过滤策略、超时、重试、追踪、指标和结构化日志。
8. 支持显式 schema、索引计划、版本标签和恢复流程。
9. 通过能力声明处理 OSS、Enterprise 和 SDK 版本差异。
10. 可以用其他向量数据库驱动替换 LanceDB，而不改变业务检索接口。

### 4.2 非目标

- 核心层不负责文档加载、切片、OCR、Prompt 和 LLM 生成。
- 核心层不内置 OpenAI、Cohere 等厂商 SDK。
- 核心层不承诺跨后端完全一致的索引参数。
- 不自动决定何时删除历史版本。
- 不自动把 `insert` 变成 `upsert`。
- 不允许调用方通过任意 SQL 字符串绕过租户和权限策略。

## 5. 对外使用体验

### 5.1 最简用法

```ts
const rag = createRagStore({
  driver: lanceDb({ uri: "./data/rag" }),
});

const knowledge = rag.collection<KnowledgeChunk>("knowledge");

await knowledge.upsert(chunks, { key: "id" });
const hits = await knowledge.retrieve({ vector: queryVector, topK: 8 });
```

默认行为必须明确：

- `topK` 默认 10，并有可配置硬上限。
- 默认 prefilter。
- 默认完整检索未索引数据，不启用 `fastSearch`。
- 默认不自动生成 embedding。
- 默认不自动建索引或执行 `optimize()`。
- 默认错误以稳定模块错误返回，不泄漏密钥和 SDK 文案。

### 5.2 文本查询与 embedding 插件

```ts
const rag = createRagStore({
  driver: lanceDb({ uri: "./data/rag" }),
  embedder: openAIEmbedder({ model: "text-embedding-3-small" }),
});

const hits = await rag
  .collection<KnowledgeChunk>("knowledge")
  .retrieve({ text: "退款条件是什么？", topK: 8 });
```

文本查询必须由模块自己的 `Embedder` 端口显式处理。不要依赖 LanceDB `search("text")` 的 auto 模式，因为官方说明 TypeScript 中它会根据进程是否注册 embedding provider、表是否带 embedding metadata，在向量搜索与 FTS 之间切换。生产 API 不能让同一输入因运行时 import 不同而改变语义。

### 5.3 混合检索

```ts
const hits = await knowledge.retrieve({
  text: "合同解除 indemnity",
  strategy: "hybrid",
  topK: 10,
  candidates: 60,
  filter: filter.and(
    filter.eq("tenantId", tenantId),
    filter.eq("status", "published"),
  ),
  reranker: "rrf",
});
```

业务只声明检索意图，驱动负责把它编译为 LanceDB 的 `fullTextSearch()`、`nearestTo()`、`where()`、`rerank()` 和 `limit()`。

### 5.4 高级逃生口

生产模块需要逃生口，但只能位于受控管理 API：

```ts
await knowledge.withDriverCapability("lancedb.query-plan", async (tools) => {
  return tools.explain(lastQuery);
});
```

不得提供 `getRawTable()`。能力接口必须是只读或受权限控制的窄契约，避免业务绕过治理规则。

## 6. 稳定领域契约

### 6.1 集合定义

```ts
interface CollectionDefinition<T, TVectorKey extends keyof T> {
  name: string;
  schema: SchemaDescriptor<T>;
  vector: {
    column: TVectorKey;
    dimensions: number;
    metric: "l2" | "cosine" | "dot";
  };
  text?: {
    columns: Array<Extract<keyof T, string>>;
  };
  primaryKey?: Extract<keyof T, string>;
  tenantKey?: Extract<keyof T, string>;
  initialization: "existing" | "create-if-missing" | "migration-only";
}
```

生产环境默认使用显式 schema。数据推断建表只保留在开发辅助 API，不进入默认生产路径。

### 6.2 检索请求

```ts
type RetrieveRequest<T> = {
  text?: string;
  vector?: readonly number[];
  strategy?: "vector" | "fts" | "hybrid";
  topK?: number;
  candidates?: number;
  filter?: FilterExpression<T>;
  select?: Array<Extract<keyof T, string>>;
  consistency?: "configured" | "latest";
  accuracy?: "balanced" | "exact" | "indexed-only";
  timeoutMs?: number;
};
```

必须验证互斥与依赖关系：

- `vector` 策略必须有 vector，或有 text 和 embedder。
- `fts` 策略必须有 text，且集合必须声明 FTS 能力。
- `hybrid` 必须同时获得文本和向量。
- `exact` 映射 `bypassVectorIndex()`，禁止与 `indexed-only` 同时使用。
- `indexed-only` 映射 `fastSearch()`，返回结果可能遗漏新写入数据，必须显式选择。
- `select` 由驱动补入评分、主键和重排所需字段，不能依赖 SDK 自动投影。

### 6.3 统一结果

```ts
interface RetrievalHit<T> {
  document: Partial<T>;
  score: {
    kind: "distance" | "fts" | "relevance";
    value: number;
    distance?: number;
    fts?: number;
  };
  identity: {
    primaryKey?: string | number;
    rowId?: string;
  };
  diagnostics?: {
    strategy: "vector" | "fts" | "hybrid";
    indexedOnly: boolean;
    reranker?: string;
  };
}
```

不要把 `_distance`、`_score`、`_relevance_score` 直接作为跨驱动公共契约。三者方向和含义不同，应由 LanceDB 驱动映射为带 `kind` 的统一评分对象，避免业务把距离误当成相关度。

## 7. 插件体系

### 7.1 插件不是万能中间件

只开放具有稳定语义的端口，避免任意 `before/after` 钩子修改请求。推荐插件类型：

```ts
interface Embedder {
  readonly id: string;
  readonly dimensions: number;
  embedDocuments(texts: readonly string[]): Promise<readonly number[][]>;
  embedQuery(text: string): Promise<readonly number[]>;
}

interface Reranker<T> {
  readonly id: string;
  rerank(input: RerankRequest<T>): Promise<readonly RankedCandidate<T>[]>;
}

interface RetrievalPolicy<T> {
  plan(request: RetrieveRequest<T>, capabilities: DriverCapabilities): RetrievalPlan<T>;
}

interface TenantPolicy<T> {
  scope(context: RequestContext, collection: CollectionDefinition<T, keyof T>): FilterExpression<T>;
}

interface TelemetryPlugin {
  startOperation(input: OperationTelemetry): OperationSpan;
}
```

### 7.2 驱动能力声明

```ts
interface DriverCapabilities {
  vectorSearch: boolean;
  fullTextSearch: boolean;
  hybridSearch: boolean;
  nativeRrf: boolean;
  customReranker: boolean;
  multiVector: "unsupported" | "experimental" | "stable";
  versioning: boolean;
  branches: boolean;
  queryPlan: boolean;
  managedIndexes: boolean;
}
```

模块初始化时完成能力协商。请求依赖未支持能力时抛出 `CAPABILITY_NOT_SUPPORTED`，不得静默降级为另一种检索。

### 7.3 推荐插件组合

- `@rag-store/embedder-openai`：OpenAI embedding。
- `@rag-store/embedder-langchain`：适配任意 LangChain.js `EmbeddingsInterface`。
- `@rag-store/reranker-rrf`：本地 RRF，作为低成本默认选项。
- `@rag-store/reranker-http`：调用独立重排服务。
- `@rag-store/telemetry-otel`：业务操作 tracing 和 metrics。
- `@rag-store/policy-multitenant`：强制 tenant 过滤。
- `@rag-store/adapter-langchain`：实现 LangChain.js VectorStore/Retriever 接口。

核心包不得依赖这些可选供应商包。

## 8. 内部模块边界

```text
src/LanceDB/
├── index.ts                     # 稳定公共导出
├── createRagStore.ts            # 组装入口
├── core/
│   ├── RagStore.ts              # collection 生命周期
│   ├── RagCollection.ts         # 业务 CRUD/retrieve 门面
│   ├── RetrievalPlanner.ts      # 请求校验与检索计划
│   ├── contracts.ts             # 公共领域类型
│   └── errors.ts                # 稳定错误模型
├── drivers/
│   └── lancedb/
│       ├── LanceDbDriver.ts     # VectorStoreDriver 实现
│       ├── LanceConnectionPool.ts
│       ├── LanceCollection.ts   # SDK Table 适配
│       ├── LanceQueryCompiler.ts
│       ├── LanceErrorMapper.ts
│       └── LanceCapabilities.ts
├── filters/
│   ├── expressions.ts           # 类型化 Filter AST
│   └── lanceSqlCompiler.ts      # 安全转义与 SQL 编译
└── management/
    ├── IndexManager.ts
    ├── MaintenanceManager.ts
    └── VersionManager.ts
```

第一轮实现不必一次创建全部文件。建议先建立 `core`、`drivers/lancedb`、`filters` 三个边界；管理面在稳定 CRUD 与检索后加入。

## 9. LanceDB 驱动设计

### 9.1 连接配置

```ts
type LanceDbConnectionConfig = {
  uri: string;
  readConsistencyInterval?: number;
  storageOptions?: Record<string, string>;
  enterprise?: {
    apiKey?: SecretValue;
    region?: string;
    hostOverride?: string;
  };
  lifecycle?: "application" | "external";
};
```

规则：

- 密钥优先来自环境变量、工作负载身份或 Secret Provider。
- 缓存指纹包含 URI、一致性、region、host、storage 配置的非敏感摘要。
- 不把 API Key、SAS Token、账户密钥写入日志、异常或缓存 key。
- Connection 和 Table 长期复用，符合官方缓存建议。
- 提供显式 `dispose()`；自动退出钩子由应用适配层选择注册。
- 连接失败的 Promise 必须从缓存删除，允许恢复后重试。

### 9.2 建表与迁移

生产环境只允许：

1. `existing`：应用只打开由 migration 创建的表。
2. `create-if-missing`：显式 Arrow schema + `createEmptyTable(..., { existOk: true })`。
3. `migration-only`：运行迁移命令时允许 schema/index 变更，服务进程禁止变更。

不得使用“带首批业务数据的 `existOk`”实现 upsert。官方明确说明表已存在时数据会被忽略。

### 9.3 写入语义

- `append()` 映射 `table.add()`，不保证主键唯一。
- `upsert()` 映射 `mergeInsert(key).whenMatchedUpdateAll().whenNotMatchedInsertAll()`。
- `insertIfAbsent()` 只启用 `whenNotMatchedInsertAll()`。
- `updateWhere()` 和 `deleteWhere()` 返回 SDK 提供的版本与影响行数。
- 大批量写入支持 Arrow Table/RecordBatch；不要强制复制为对象数组。
- 对 merge key 和常用过滤字段建议建立 scalar index。
- 每次写入产生新版本和 fragment，禁止逐行调用 `add()`。

### 9.4 查询编译

`LanceQueryCompiler` 根据 `RetrievalPlan` 生成查询：

- vector：`query().nearestTo(vector).column(...).distanceType(...)`。
- FTS：`query().fullTextSearch(text, columns)`。
- hybrid：同一 builder 组合 `fullTextSearch()` 与 `nearestTo()`，再调用 RRF 或自定义重排器。
- 默认 prefilter；只有显式策略允许 `.postfilter()`。
- `exact` 使用 `.bypassVectorIndex()`。
- `indexed-only` 使用 `.fastSearch()`。
- 所有路径必须显式 `.limit()` 和 `.select()`。
- 超时传入查询执行选项，不依赖无限等待。

### 9.5 FTS 与中文内容

官方默认 tokenizer 以空白和标点切词，中文无空格文本不能假设有良好召回。生产设计必须把 tokenizer 作为索引迁移配置：

- 多语言内容优先评估 ICU tokenizer。
- 中文专用分词需核对当前 Node SDK 是否支持对应模型和部署文件。
- phrase 查询要求 position 信息且会增加索引体积与构建时间。
- 不把 FTS 索引配置放在每次查询中。
- 建索引后的新增行通过普通 fallback 仍可检索，但延迟会上升；需按计划 `optimize()`。

## 10. 复杂 RAG 场景支持

### 10.1 多租户知识库

- 每个集合声明 `tenantKey`。
- `TenantPolicy` 在检索、计数、更新、删除前强制加入过滤条件。
- 业务传入的 filter 与租户 filter 只允许 `AND` 合并。
- tenant 字段必须建立 scalar index。
- 高隔离等级场景使用独立表、namespace 或独立数据库，不只依赖行级过滤。

### 10.2 父子文档检索

chunk 表保留 `documentId`、`chunkId`、`parentId` 和 `contentHash`。第一阶段检索 chunk，第二阶段按 `parentId` 批量获取父文档或相邻窗口。该逻辑属于 `RetrievalPolicy`，不写入 LanceDB 驱动。

### 10.3 混合检索与重排

候选生成与最终 topK 分离：

```text
Vector topN + FTS topN -> 去重/融合 -> 可选模型重排 -> topK
```

TypeScript SDK 当前稳定提供内置 RRF 和通用 Reranker 接口；官方模型重排器主要是 Python 能力。因此 Node 生产模块应：

- 默认使用 RRF。
- 通过自定义 `Reranker` 插件调用外部模型服务。
- 在重排前自动投影重排所需文本字段。
- 为模型重排设置独立超时、并发、候选上限和失败策略。
- 失败策略由请求声明为 `fail` 或 `fallback-to-fusion`，不得隐式吞错。

### 10.4 多向量和晚交互

官方多向量检索使用 MaxSim 且只支持 cosine；文档中的完整示例当前以 Python 为主。Node 模块不应立即把它承诺为稳定公共功能：

- 驱动启动时做 capability probe。
- 未验证前标记为 `experimental`。
- 表 schema 固定内层维度，查询矩阵必须匹配。
- 在暴露生产流量前建立索引，多向量暴力扫描成本远高于单向量。
- 提供独立 `MultiVectorRetriever` 插件，不污染常规单向量接口。

### 10.5 多 embedding 视图

同一表可有 title、body、image 等多个向量列。官方指出 TypeScript 自动文本 embedding 默认使用表 metadata 中第一个函数，因此模块必须显式选择 embedding profile 和向量列，不使用隐式 auto 行为。

## 11. Filter 安全模型

当前直接接收 SQL 字符串不适合多租户公共模块。应使用类型化表达式：

```ts
filter.and(
  filter.eq("tenantId", tenantId),
  filter.in("category", ["policy", "contract"]),
  filter.gte("updatedAt", since),
);
```

编译器职责：

- 校验字段是否在 schema 中。
- 按 Arrow 类型序列化字符串、数字、布尔、日期和时间戳。
- 正确转义标识符和字符串值。
- 限制表达式深度、IN 元素数量和正则复杂度。
- 禁止业务注入 SQL 函数，除非管理员注册白名单。
- 将租户策略置于不可删除的根节点。

可提供 `unsafeSqlFilter()`，但只放在受权限控制的管理包，并显式标记危险。

## 12. 可靠性与错误模型

```ts
type RagStoreErrorCode =
  | "INVALID_ARGUMENT"
  | "CAPABILITY_NOT_SUPPORTED"
  | "COLLECTION_NOT_FOUND"
  | "SCHEMA_MISMATCH"
  | "VECTOR_DIMENSION_MISMATCH"
  | "INDEX_NOT_READY"
  | "CONSISTENCY_ERROR"
  | "AUTHENTICATION_FAILED"
  | "CONNECTION_FAILED"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "OPERATION_FAILED";
```

每个错误包含 `operation`、`collection`、`retryable`、脱敏 backend、`cause` 和 trace id。

重试规则：

- 只重试明确的瞬时连接、限流和对象存储错误。
- 写操作只有在 SDK/后端具备幂等保障或调用方提供 idempotency key 时才自动重试。
- schema、维度、权限和 capability 错误不得重试。
- 使用带抖动的指数退避，并受总 deadline 限制。
- circuit breaker 和 bulkhead 作为部署层可选插件，不硬编码在核心查询中。

## 13. 一致性与版本治理

- 未配置 `readConsistencyInterval` 时，不自动看到其他写入方更新。
- `0` 表示每次读取检查最新版本，代价是延迟和对象存储请求成本。
- 大于 0 表示有界最终一致。
- `consistency: "latest"` 映射一次显式 `checkoutLatest()`，不应成为每次查询默认值。
- 写后同句柄读应保持 read-your-writes。
- 评估集、发布基线和合规快照使用 version tag，而不是仅保存数字版本。
- restore、tag 删除和历史 cleanup 只在管理面开放，并写审计日志。
- `optimize()` 可能清理历史版本；tag 指向的版本按官方语义不被清理。

## 14. 索引与维护面

管理 API 与在线数据 API 分离：

```ts
const admin = rag.manage("knowledge");

await admin.ensureIndexes(indexPlan);
await admin.inspectIndexes();
await admin.optimize({ cleanupOlderThan: retentionDate });
await admin.explain(sampleQuery);
```

规则：

- 向量索引度量与集合定义保持一致。
- 常用 filter 和 merge key 建 scalar index。
- 文本列显式建 FTS index。
- OSS 定期 `optimize()`，其同时执行 compaction、cleanup 和增量索引更新。
- 监控 `numUnindexedRows`，不要只按固定时间盲目维护。
- 普通查询覆盖未索引行；`fastSearch` 只在允许陈旧结果时使用。
- Enterprise 自动管理部分索引与维护工作，驱动能力应反映这一差异。
- `explainPlan()` 用于确认是否走索引；`analyzePlan()` 会真实执行查询，只用于受控诊断。

## 15. 可观测性

模块需要两层观测：

### 15.1 LanceDB 原生指标

官方 TypeScript SDK 支持 `instrumentLanceDbMetrics()`，可导出对象存储请求量、延迟、字节数、可重试错误和 in-flight 请求。它是进程级 recorder，应在应用启动、打开表之前初始化一次。

### 15.2 业务操作指标

核心模块额外记录：

- `rag_store_operation_duration`：按 operation、strategy、backend。
- `rag_store_requests_total`：成功、失败、超时和降级。
- `rag_store_candidates`：召回候选数和最终 topK。
- `rag_store_rerank_duration`：重排延迟与供应商。
- `rag_store_embedding_duration`：embedding 延迟与批量大小。
- `rag_store_unindexed_rows`：定期采样索引覆盖。

禁止将 query text、原始文档、向量和 filter value 默认写入日志或 span。只记录长度、维度、字段名、哈希或经过授权的采样内容。

## 16. 配置与密钥

优先级固定为：

```text
调用时显式配置 > 应用配置对象 > 环境变量/Secret Provider > 安全默认值
```

- 配置在 `createRagStore()` 时冻结，不提供进程级可变静态 `configure()`。
- secret 用包装类型或 provider 延迟解析，不进入序列化配置。
- LanceDB embedding registry 的 `$var:` 可用于 SDK schema metadata，但核心模块仍应由 Secret Provider 注入。
- 配置加载后执行一次完整校验，启动即失败，不把无效配置拖到首个线上请求。

## 17. LangChain.js 集成边界

LanceDB 官方 LangChain 页面目前主要描述 Python 集成，不能直接据此承诺 Node API。推荐单独实现 `@rag-store/adapter-langchain`：

- 把 LangChain.js Document 映射为集合 schema。
- 把 LangChain Embeddings 适配为本模块 `Embedder`。
- 把 `similaritySearch`、带分数检索和 Retriever 调用映射为 `retrieve()`。
- 保留本模块的租户、过滤、超时和观测策略。
- 不让 LangChain 适配器成为核心存储实现。

这样 Agent、LangGraph 或自定义 RAG 服务可以共享同一个底层集合，而不绑定某个编排框架。

## 18. 测试策略

### 18.1 单元测试

- 配置校验与密钥脱敏。
- Filter AST 编译和注入攻击样例。
- RetrievalPlanner 的合法/非法组合。
- score 映射和 `_distance` 强制投影。
- 错误映射、重试分类与 capability negotiation。

### 18.2 本地集成测试

- 显式 schema 并发建表与并发首写。
- append/upsert/insert-if-absent 语义。
- vector、FTS、hybrid 和 RRF 结果字段。
- prefilter/postfilter 差异。
- exact 与 indexed-only 行为。
- checkoutLatest、版本 tag 和 restore。
- dispose 后重连、缓存隔离和失败 Promise 清除。
- optimize 前后的索引覆盖与查询完整性。

### 18.3 契约测试

所有 `VectorStoreDriver` 实现运行同一套契约测试，确保：

- 不支持能力时明确失败。
- score 类型方向一致。
- tenant scope 永远生效。
- topK、timeout、select 和错误结构一致。

### 18.4 生产验证

- 本地文件、目标对象存储和 Enterprise 分别运行 smoke test。
- 测量 p50/p95/p99、召回率、过滤后结果数和索引覆盖。
- 对 embedding/reranker 故障执行降级演练。
- 用固定版本 tag 的评估集做离线 recall@k、MRR、nDCG 和答案引用正确性评估。

## 19. 实施路线

### 阶段 0：修复当前契约

1. 强制投影 `_distance`。
2. 加入正式 `tsconfig`、测试和 typecheck。
3. 修复 Apache Arrow 与 Node 类型版本冲突。
4. 加入稳定错误映射和 `dispose()`。

### 阶段 1：稳定核心

1. 引入 `RagStore`、`RagCollection` 和 `VectorStoreDriver`。
2. 实现显式 schema、append、upsert、delete、count。
3. 实现类型化 filter 与租户策略。
4. 实现 vector retrieve 和统一 score。
5. 保留旧 `LanceDB.table()` 兼容适配器并标记弃用周期。

### 阶段 2：复杂检索

1. 增加 Embedder 插件。
2. 增加 FTS、hybrid、RRF 和自定义 reranker。
3. 增加候选预算、超时和显式降级策略。
4. 增加 LangChain.js adapter。

### 阶段 3：生产治理

1. 索引管理、`optimize()`、版本与 tag 管理。
2. OpenTelemetry、结构化日志和 query plan 诊断。
3. 对象存储与 Enterprise 认证。
4. 压测、召回评估、故障演练和运行手册。

### 阶段 4：实验能力

1. 多向量晚交互。
2. 多 embedding profile。
3. 分支化回填和索引实验。
4. 第二个向量数据库驱动，用于验证抽象是否真实可替换。

在第二个驱动出现前，不要为了“未来可能替换”抽象 LanceDB 每一个索引参数；公共端口只包含跨后端稳定语义，后端特有能力通过 capability extension 暴露。

## 20. 生产验收标准

- 常用 RAG 调用不出现 LanceDB SDK 类型。
- 无插件时可用外部向量完成本地检索。
- 替换 embedder、reranker 或 driver 不修改业务调用代码。
- 不支持的能力明确报错，不静默改成 FTS、暴力扫描或另一种度量。
- 所有在线查询有明确 topK、deadline 和投影列。
- 所有租户操作都经过不可绕过的 scope。
- append 与 upsert 语义分离并有并发测试。
- 连接、表和索引缓存可复用、可释放、可测试。
- 对象存储和 Enterprise 密钥不会出现在日志、错误或缓存键。
- FTS、向量与混合检索的 score 语义可区分。
- OSS 有索引覆盖、compaction 和 cleanup 运维策略。
- 可通过版本 tag 重现一套评估数据。
- typecheck、单元测试、集成测试、契约测试和 smoke test 均有固定命令。

## 21. 需要在实施前确定的业务决策

以下决策无法由官方 SDK 文档代替，实施前必须明确：

1. 首个生产后端是本地/对象存储 OSS，还是 LanceDB Enterprise。
2. 租户隔离采用行级、表级、namespace 还是数据库级。
3. 写入默认是 append 还是按业务键 upsert。
4. embedding 在业务服务、独立服务还是 LanceDB client schema 中执行。
5. 中文 FTS 的分词与召回验收数据集。
6. 模型重排失败时是失败请求还是回退到 RRF。
7. 可接受的查询 p95、召回率和最大成本。
8. 历史版本保留和数据删除合规策略。

这些应成为配置与部署决策，而不是由 Store 隐式猜测。

## 22. 官方资料依据

核对日期：2026-09-16；当前项目依赖：`@lancedb/lancedb@0.38.0`。

- [Ingesting Data](https://docs.lancedb.com/tables/create.md)：建表、`existOk`、显式 schema、批量 add。
- [Updating Data](https://docs.lancedb.com/tables/update.md)：update、merge insert、软删除和写入结果。
- [Vector Search](https://docs.lancedb.com/search/vector-search.md)：距离、索引旁路、refine、fast search。
- [Full-Text Search](https://docs.lancedb.com/search/full-text-search.md)：FTS 索引、tokenizer、过滤和增量更新。
- [Hybrid Search](https://docs.lancedb.com/search/hybrid-search.md)：向量与 FTS 组合、RRF、过滤和 query controls。
- [Metadata Filtering](https://docs.lancedb.com/search/filtering.md)：SQL 谓词、pre/postfilter 和 scalar index。
- [Reranking](https://docs.lancedb.com/reranking/index.md)：TypeScript RRF 与自定义 reranker 能力边界。
- [Managing Embeddings](https://docs.lancedb.com/embedding/index.md)：registry、多 embedding、变量与自定义函数。
- [Multivector Search](https://docs.lancedb.com/search/multivector-search.md)：MaxSim、cosine 限制和索引要求。
- [Vector Indexes](https://docs.lancedb.com/indexing/vector-index.md)：索引类型、度量与覆盖状态。
- [Reindexing](https://docs.lancedb.com/indexing/reindexing.md)：`optimize()`、未索引数据和磁盘回收。
- [Consistency](https://docs.lancedb.com/tables/consistency.md)：读取一致性与 `checkoutLatest()`。
- [Versioning](https://docs.lancedb.com/tables/versioning.md)：版本、tag、restore 和 cleanup 关系。
- [Query Optimization](https://docs.lancedb.com/search/optimize-queries.md)：`explainPlan()` 与 `analyzePlan()`。
- [Storage Configuration](https://docs.lancedb.com/storage/configuration.md)：对象存储和安全配置。
- [OpenTelemetry Monitoring](https://docs.lancedb.com/storage/monitoring.md)：Node 原生对象存储指标。
- [Tables and Namespaces](https://docs.lancedb.com/tables-and-namespaces.md)：本地与远程表边界。
