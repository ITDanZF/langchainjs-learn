# LangChain Vector Store

该项目提供面向生产 RAG 场景的可插拔向量存储接口，并以 LanceDB 作为首个驱动实现。

## 核心能力

- 稳定的 `RagStore` / `RagCollection` API，不向业务暴露 LanceDB Table。
- 显式 Arrow schema 初始化，避免生产环境依赖数据推断建表。
- append 与 upsert 分离，upsert 使用 LanceDB `mergeInsert`。
- 向量、全文和混合检索，混合检索默认使用 RRF。
- 类型化 Filter AST，负责值转义和表达式深度限制。
- 可选 embedding、reranker 和租户策略插件。
- 稳定错误类型、资源复用和显式 `dispose()`。
- 向量、FTS、标量索引以及 optimize/version 管理面。

## 快速使用

```ts
const rag = createRagStore({
  driver: lanceDb({ uri: "./data/rag" }),
  tenantPolicy: new RequiredTenantPolicy(),
});

const knowledge = rag.collection(definition, { tenantId: "tenant-a" });

await knowledge.upsert(chunks);

const hits = await knowledge.retrieve({
  vector: queryVector,
  topK: 8,
  select: ["id", "text"],
  filter: filter.eq("status", "published"),
});

await rag.dispose();
```

完整可运行示例见 [main.ts](main.ts)，架构与生产约束见 [生产级设计文档](doc/LanceDB生产级可插拔模块设计.md)。

## 文本和混合检索

文本转向量由 `Embedder` 插件显式负责，避免 LanceDB 字符串查询的 auto 模式在 FTS 与向量查询之间隐式切换。

```ts
const rag = createRagStore({
  driver: lanceDb({ uri: "./data/rag" }),
  embedder,
});

await knowledge.retrieve({
  text: "退款条件是什么？",
  strategy: "hybrid",
  reranker: "rrf",
  topK: 10,
  candidates: 40,
});
```

使用 FTS 或 hybrid 前应通过管理面建立 FTS 索引：

```ts
await rag.manage(definition).createFtsIndex("text");
```

## 生产默认

- 默认不启用 `fastSearch`，因此不会主动遗漏未索引新数据。
- `accuracy: "exact"` 绕过 ANN 索引，适合评估而非大规模在线默认路径。
- 生产建表使用 `create-if-missing` 加显式 schema，或使用 `existing` 只打开迁移阶段创建的表。
- 租户集合的写入、查询、计数和删除都会校验或注入 tenant scope。
- 管理能力只能从 `rag.manage(definition)` 获取，不挂在租户 Collection 上。
- 对象存储和 Enterprise 参数通过 `lanceDb({ connectionOptions })` 传入，密钥不得写入日志。

## 验证

```powershell
npm run typecheck
npm test
npm run check
npm run dev
```

`npm test` 使用临时目录验证并发建表、租户隔离、upsert、向量检索、FTS、混合 RRF 和错误契约。

## 兼容 API

原有 `LanceDB.table<T>()` 仍保留，供现有学习代码迁移。新业务应使用 `createRagStore()`，因为它具有显式 schema、插件、租户策略、统一评分和管理面边界。
