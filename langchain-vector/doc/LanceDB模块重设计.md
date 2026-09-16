# LanceDB 通用模块重设计

## 1. 设计结论

当前 `LanceDB.ts` 不应继续以“数据库连接包装器”为中心扩展，应重新设计为**面向单表的向量数据 Store**。

调用方只需要一行初始化：

```ts
const documents = LanceDB.table<Document>("documents");
```

之后直接操作该表，不再重复传数据库路径和表名：

```ts
await documents.insert(rows);
const matches = await documents.search(queryVector, { limit: 5 });
```

连接创建、连接复用、表打开、表首次创建和进程退出时的资源释放全部由模块内部负责。以下能力不向业务层公开：

- `connect()`
- `close()`
- `openTable()`
- 原始 LanceDB `Connection`
- 原始 LanceDB `Table`

## 2. 当前设计的问题

当前调用方式是：

```ts
const db = new LanceDB(directory);
await db.createTable("documents", rows);
await db.add("documents", moreRows);
await db.search("documents", vector);
db.close();
```

主要问题：

1. **抽象层级错误**：业务代码需要理解连接和表对象的生命周期。
2. **重复传参**：每次操作都传 `documents`，容易写错，也不利于类型绑定。
3. **初始化复杂**：调用方要决定何时建表、何时开表。
4. **资源管理泄漏到外部**：忘记 `close()` 会成为调用方责任。
5. **类型过弱**：返回 `Record<string, unknown>`，业务层无法获得字段提示。
6. **职责混合**：同一个类同时负责连接、表管理、数据校验和业务查询。
7. **不利于扩展**：后续加入 upsert、索引、分页、全文检索时，所有方法都会继续携带表名。

## 3. 设计目标

### 3.1 必须满足

- 一行获得可用 Store。
- 默认数据库保存到当前项目的 `data/lancedb`。
- 支持通过配置或环境变量切换本地目录、对象存储或远程 LanceDB。
- 连接按 URI 自动复用，调用方不感知连接生命周期。
- Store 与表名绑定，后续操作不再传表名。
- 泛型贯穿写入与查询结果。
- 开发模式可在第一次写入时推断 schema 并自动建表。
- 生产并发模式支持显式 Arrow schema，先创建空表再追加数据。
- 多次调用和并发初始化时不会重复创建连接或表。
- 不绑定某个 embedding 模型，接受外部生成的向量。
- SDK 原始对象不从公共 API 泄漏。

### 3.2 暂不纳入核心层

- 文本切片。
- embedding 模型调用。
- RAG prompt 组装。
- 聊天模型调用。
- 业务字段的固定 schema。

这些能力属于上层 RAG 服务。向量存储模块只负责可靠持久化和检索。

## 4. 推荐公共 API

### 4.1 默认用法

```ts
interface Document {
  id: string;
  text: string;
  category: string;
  vector: number[];
}

const documents = LanceDB.table<Document>("documents");
```

`table()` 是同步工厂，只创建轻量 Store，不立即做 I/O。第一次调用异步方法时，模块才连接数据库并打开或创建表。

Store 内部应长期复用同一个 LanceDB `Table`。官方 Node.js API 明确说明 `Connection` 和 `Table` 都是长生命周期对象；`Table` 会缓存索引数据，反复打开或每次操作后关闭会丢失缓存收益。

默认 URI：

```text
<process.cwd()>/data/lancedb
```

环境变量优先级：

```text
显式 options.uri > LANCEDB_URI > 默认项目目录
```

### 4.2 自定义数据库

```ts
const documents = LanceDB.table<Document>("documents", {
  uri: "./data/custom-lancedb",
});
```

这仍然只有一行初始化，没有连接操作。

### 4.3 写入

```ts
await documents.insert([
  { id: "hotel", text: "Hotel policy", category: "travel", vector: [1, 0] },
]);
```

行为：

- 开发模式下表不存在：用首批非空数据推断 schema 并创建表。
- 配置显式 schema 时表不存在：先幂等创建空表，再用 `add()` 写入。
- 表已存在：追加数据。
- 空数组：直接返回，不访问数据库。
- 同一批向量维度不同：在进入 SDK 前抛出明确错误。
- 已有表的 schema 或向量维度不匹配：转换为模块统一错误。

不再要求业务调用方执行 `createTable()`，但生产部署必须选择显式 schema 或独占 migration，不能依赖多个进程同时推断 schema。

### 4.4 向量搜索

```ts
const matches = await documents.search(queryVector, {
  limit: 5,
  filter: "category = 'travel'",
  select: ["id", "text", "category"],
  metric: "cosine",
});
```

检索设计必须遵守以下官方约束：

- 必须设置正整数 `limit`；模块默认值为 10，并设置合理上限避免误拉全表。
- 表只有一个匹配维度的向量列时 LanceDB 可自动推断；通用封装仍应固定 `vectorColumn`，多向量列时必须显式指定。
- 无向量索引时可以按查询选择 `l2/cosine/dot`。
- 已有向量索引时，查询度量必须与建索引时一致；不一致会退化为昂贵的全量扫描。因此建索引后 Store 的 metric 应视为表级固定配置，而不是任意查询参数。
- 普通搜索会同时扫描尚未进入索引的新行；`fastSearch` 会跳过这些行，可能漏掉刚写入的数据，不能作为默认行为。
- ANN 索引下 `_distance` 可能来自量化表示，不一定是原始向量的精确距离。若业务依赖精确距离，需要提供 `refineFactor` 或 `exact` 选项，后者内部绕过索引并承担更高成本。

推荐返回类型：

```ts
type SearchResult<T> = Partial<T> & {
  _distance: number;
};
```

当未传 `select` 时返回完整业务字段和 `_distance`；传入 `select` 时，类型只能保证是 `Partial<T>`，避免虚假类型承诺。

### 4.5 其他必要操作

```ts
await documents.delete("id = 'hotel'");
const count = await documents.count();
const exists = await documents.exists();
```

第二阶段再加入：

```ts
await documents.upsert(rows, { on: "id" });
await documents.update("id = 'hotel'", { category: "travel" });
await LanceDB.maintenance("documents").createVectorIndex({ metric: "cosine" });
await LanceDB.maintenance("documents").optimize();
```

核心版本不应为了“看起来完整”一次塞入所有 LanceDB SDK 方法。

## 5. 建议类型结构

```ts
type VectorRecord = Record<string, unknown> & {
  vector: readonly number[];
};

interface LanceTableOptions {
  uri?: string;
  vectorColumn?: string;
  defaultMetric?: "l2" | "cosine" | "dot";
  schema?: SchemaLike;
  readConsistencyInterval?: number;
}

interface VectorSearchOptions<T> {
  limit?: number;
  filter?: string;
  select?: Array<Extract<keyof T, string>>;
  exact?: boolean;
  refineFactor?: number;
}

interface VectorStore<T extends VectorRecord> {
  insert(rows: readonly T[]): Promise<void>;
  search(
    vector: readonly number[],
    options?: VectorSearchOptions<T>,
  ): Promise<Array<SearchResult<T>>>;
  delete(filter: string): Promise<number | void>;
  count(filter?: string): Promise<number>;
  exists(): Promise<boolean>;
  refresh(): Promise<void>;
}
```

距离度量放在 `LanceTableOptions.defaultMetric`，避免同一 Store 的查询随意切换并绕过已有索引。若确实需要用其他度量做精确评估，应通过明确的 `exact: true` API 表达成本，而不是静默退化。

公共类型表达业务能力，不直接导出 `@lancedb/lancedb` 的 `Connection`、`Table` 或 Query Builder。

## 6. 内部架构

建议在一个文件中先保持三个内部层次，验证稳定后再按需拆文件。

### 6.1 `LanceDB` 公共门面

职责只有一个：创建绑定表名和配置的 Store。

```text
LanceDB.table<T>(tableName, options?) -> LanceTableStore<T>
```

不保存业务状态，不暴露连接方法。

### 6.2 `ConnectionRegistry` 内部连接池

按“规范化 URI + 影响连接语义的配置指纹”缓存 `Promise<Connection>`：

```text
Map<connectionKey, Promise<Connection>>
```

连接键至少应区分 `readConsistencyInterval` 和 `storageOptions`。不能仅按 URI 缓存，否则强一致与最终一致 Store 可能错误共用同一连接。配置指纹不得记录或输出 API Key、SAS Token 等明文凭据。

缓存 Promise 而不是只缓存连接对象，可避免两个并发请求同时创建连接。

生命周期策略：

- 首次 I/O 时懒连接。
- 相同连接配置的多个 Store 共用连接。
- 连接失败时从缓存删除，下一次操作允许重试。
- 注册一次内部 `process.once("beforeExit", ...)`，同步关闭已缓存的 Table 和 Connection。
- 不把 `close()` 暴露为日常业务 API。

官方语义中 `close()` 是可选操作，对象被垃圾回收时也会自动关闭；主动关闭用于提前释放 HTTP 连接池和索引缓存。由于本设计的 Registry 会持有强引用，不能只依赖垃圾回收，必须由内部退出钩子兜底。`close()` 可重复调用，且 Connection 关闭后已创建的 Table 仍可独立工作，因此退出时应先关闭 Table，再关闭 Connection。

测试若确实需要释放资源，应通过仅从测试入口导出的 `LanceDBTesting.reset()` 关闭 Table、关闭 Connection 并清空缓存，不加入默认公共导出。不要在 `exit` 事件中执行异步清理；当前 SDK 的 `close()` 是同步方法，适合退出钩子。

### 6.3 `LanceTableStore<T>` 单表实现

每个实例固定：

- 数据库 URI。
- 表名。
- 向量列名。
- 默认距离度量。

内部保存 `Promise<Table> | undefined`，首次操作时打开表并长期复用。表不存在且操作是 `insert` 时按初始化策略创建；表不存在且操作是 `search/delete/count` 时抛出 `TABLE_NOT_FOUND`。

如果 Table Promise 失败，必须从缓存移除以允许重试。若缓存对象的 `isOpen()` 为 false，则重新打开，不能继续返回已关闭句柄。

## 7. 并发与建表策略

最容易出错的场景是两个请求同时向一个不存在的表执行第一次写入。需要区分单进程并发与跨进程并发。

### 7.1 单进程开发模式

1. 以 `uri + tableName` 为键缓存初始化 Promise。
2. 第一个调用检查表是否存在并创建。
3. 后续调用等待同一个 Promise。
4. 初始化失败后删除 Promise，允许重试。
5. 首批数据用于推断 schema 和创建表；其余并发调用在初始化完成后使用 `add()`。

此模式适合当前学习项目和单进程服务，但不应宣称可解决跨进程首次建表竞争。

### 7.2 生产并发模式

官方文档明确指出：`createTable(..., { existOk: true })` 遇到已有表时会返回现有表，**但传入的数据会被忽略，不会追加**。因此不能把带首批业务数据的 `existOk` 当作跨进程安全的 insert，否则竞争失败方的数据可能静默丢失。

生产模式要求调用方在 Store 配置中提供显式 Arrow schema：

1. 使用 schema 幂等创建空表。
2. 所有业务批次统一通过 `table.add()` 写入。
3. 不使用 `mode: "overwrite"`；该模式会永久删除原表，只允许测试 fixture 或明确重建流程使用。
4. 若无法提供 schema，则表初始化必须成为部署阶段的独占 migration，不允许多个进程同时用首批数据推断建表。

不能只使用“先列举表，再创建表”，因为检查和创建之间存在竞争窗口。也不应每次用全量 `listTables()` 判断单表存在性；实现时优先使用版本 SDK 提供的精确表存在 API，缺失时再捕获结构化的 open/create 错误。

### 7.3 大批量写入

官方建议大数据集采用“显式 schema 创建空表，再 `add()`”的方式，因为 `add()` 能利用大写入的自动并行，而把全部数据传给 `createTable()` 不具备同样的自动并行能力。TypeScript 的大批量输入还应支持 Arrow Table 或 RecordBatch 迭代器，避免一次性把全部对象放入内存。

## 8. 资源管理策略

“无需手动关闭”不等于“不关闭”。正确做法是将关闭责任收回模块：

- 长生命周期进程：Connection 与 Table 都复用到进程结束，避免重连和重建索引缓存。
- CLI/脚本：Node.js 退出钩子统一关闭连接。
- 测试：内部 reset 钩子先关闭 Table，再关闭 Connection，最后清空缓存。
- 不在每个 `insert/search` 后关闭，否则会损失连接和索引缓存带来的性能。

如果未来用于 Serverless，应增加可选模式：

```ts
LanceDB.configure({ lifecycle: "persistent" | "request" });
```

当前 Node.js 学习项目默认使用 `persistent`。

### 8.1 多写入方的读取一致性

官方一致性文档规定 `readConsistencyInterval` 有三种语义：

- 未设置：默认不自动检查其他写入方的新版本。
- `0`：每次读取检查最新版本，最强新鲜度，代价是更高延迟和对象存储请求成本。
- 大于 `0`：超过指定秒数后刷新，属于有界最终一致。

因此默认 Store 只能保证同一 Table 句柄“读己之写”，不能承诺立即看到其他进程的写入。设计应把一致性作为 Store/连接配置，而不是查询参数：

```ts
const documents = LanceDB.table<Document>("documents", {
  readConsistencyInterval: 0,
});
```

还可提供 `refresh()` 业务方法，内部调用 `checkoutLatest()`，用于默认一致性模式下显式获取其他写入方的最新提交。它不暴露原始 Table。

### 8.2 Serverless 与短生命周期任务

不建议实现“每个请求后自动关闭”：官方建议 Connection 和 Table 长期复用，且 Table 会缓存索引数据。Serverless 容器实例内仍应把 Registry 保持在模块级，让热实例复用连接；实例回收时由运行时和内部退出钩子释放资源。

所谓 `request` 生命周期只适用于明确要求隔离的批任务，不作为默认模式。若实现该模式，也应由模块提供 `withTable(...)` 之类的作用域 API 并在内部 `finally` 释放，不能重新要求业务代码手动调用 `close()`。

### 8.3 不接管宿主进程控制

库可以注册幂等的 `beforeExit`/`exit` 清理，但不应注册会改变应用退出行为的 `SIGINT`、`SIGTERM` 或 `uncaughtException` 处理器。服务框架已有自己的优雅停机策略，基础库不应吞掉信号或异常。所有写操作都必须被调用方 `await`；退出钩子不能挽救尚未等待完成的异步写入。

## 9. 索引与数据维护策略

索引和清理不应混入每次 CRUD，而应作为明确的管理能力或运维任务。

### 9.1 向量索引

- 小数据集优先精确扫描，不要自动建 ANN 索引。
- OSS 中索引由应用显式创建和维护；Enterprise 会自动管理。
- 建索引时保存向量列、索引类型和距离度量，并在搜索时校验配置一致性。
- OSS 在索引建立后追加的新行不会自动进入已有索引；普通搜索仍会通过较慢的 fallback 找到它们。
- 批量写入后调用 `optimize()` 将新数据纳入索引；是否自动执行应由阈值或后台任务决定，不能每次 insert 都执行。
- 更新行会把对应记录移出已有索引。大量 update 后应重建或优化索引。
- `fastSearch` 只适用于明确接受“可能遗漏未索引新数据”的低延迟场景。

### 9.2 删除与空间回收

官方说明行删除是软删除：查询和索引会排除这些行，但底层文件不会立即释放空间。OSS 需要定期运行 `optimize()` 做 compaction 和旧版本清理；默认清理策略涉及历史版本保留，不应在通用 CRUD 中激进执行。

因此建议将管理 API 单独分组：

```ts
const maintenance = LanceDB.maintenance("documents");
await maintenance.createVectorIndex({ metric: "cosine" });
await maintenance.optimize();
```

默认 Store 不暴露 `maintenance`，由独立管理入口提供，避免普通业务误触重索引或历史数据清理。

### 9.3 Upsert 与唯一性

普通 `add()` 不保证主键唯一。LanceDB 的 primary key metadata 也不是普通写入的唯一约束。需要幂等写入时必须使用 `mergeInsert`，并明确指定匹配列：

```ts
await documents.upsert(rows, { on: "id" });
```

大表的 `mergeInsert` 会按匹配列做 join，应为该列建立 scalar index。模块不能把 insert 偷换成 upsert，也不能假设存在 `id` 字段。

### 9.4 存储后端

官方支持本地路径、`s3://`、`gs://`、`az://` 和 `db://`。配置设计应保留 `connectionOptions/storageOptions`，但凭据优先从环境变量或工作负载身份读取：

- 不把 API Key、账户密钥、SAS Token 放入日志、错误消息或连接缓存键。
- OSS 对象存储需要正确的读、写、删除和列举权限。
- Enterprise 的 `db://` 连接由集群持有存储凭据，不应复用 OSS 的 `storageOptions` 方式。
- 新表格式、稳定 row id 等选项只在建表时生效，修改连接配置不会重写已有表。

## 10. 错误模型

公共模块应提供稳定错误类型，避免业务代码依赖 SDK 文案：

```ts
type LanceStoreErrorCode =
  | "INVALID_ARGUMENT"
  | "TABLE_NOT_FOUND"
  | "SCHEMA_MISMATCH"
  | "VECTOR_DIMENSION_MISMATCH"
  | "CONNECTION_FAILED"
  | "OPERATION_FAILED";
```

错误对象至少包含：

- `code`
- `message`
- `cause`
- `uri`（远程 URI 需要脱敏）
- `tableName`
- `operation`

过滤表达式仍是 SQL 字符串，应明确这是可信后端代码接口，不应直接拼接用户输入。

## 11. 配置设计

推荐只提供两种配置入口。

### 全局默认配置

```ts
LanceDB.configure({
  uri: "./data/lancedb",
  defaultMetric: "cosine",
});
```

适合应用启动阶段调用一次。

默认不设置 `readConsistencyInterval`，保持官方默认的新鲜度和性能语义。仅在确实需要每次读取都检查其他写入方更新时显式设置为 `0`。

### 单表覆盖

```ts
const documents = LanceDB.table<Document>("documents", {
  uri: "s3://bucket/vector-data",
  vectorColumn: "embedding",
});
```

禁止在每个 CRUD 方法中重复传 URI、表名或向量列名。

## 12. `main.ts` 应简化成什么样

`main.ts` 不再演示连接和清理，只验证业务 API：

```ts
import LanceDB from "./LanceDB.ts";

const documents = LanceDB.table<Document>("documents");

await documents.insert(rows);
const matches = await documents.search([0.95, 0.05], { limit: 2 });
console.log(matches);
```

若只想完成一次检索，也可以直接一行调用：

```ts
const matches = await LanceDB.table<Document>("documents").search(vector);
```

这才是“一行代码可使用”的边界：业务层仍需表达它要操作哪张表，但不需要管理数据库基础设施。

## 13. 不推荐的替代方案

### 每个方法都创建并关闭连接

表面简单，实际会增加延迟，破坏连接和索引缓存，不适合频繁查询。

### 全局固定唯一表

虽然调用更短，但无法支持多个业务集合，也会让配置和测试互相污染。

### 继续返回原始 `Table`

调用方会绕过校验、错误映射和连接管理，封装很快失效。

### 在构造函数中异步连接

JavaScript 构造函数不能安全地 `await`。把未完成连接藏在构造函数状态中，错误时机也不清晰。同步工厂加首次操作懒连接更合适。

### 核心模块内置某个 embedding 服务

会把存储层绑定到模型厂商、鉴权和网络策略。正确做法是让上层传入向量，后续可另建 `EmbeddedVectorStore` 适配层。

## 14. 实施顺序

1. 删除当前公开的 `constructor(uri)`、`connect()`、`close()`、`openTable()` 和所有要求传表名的方法。
2. 建立 `LanceDB.table<T>()` 与 `LanceTableStore<T>`。
3. 实现 URI 默认值、规范化和连接 Promise 缓存。
4. 实现懒开表、Table 长期缓存及单进程初始化锁。
5. 实现开发模式推断建表与生产模式显式 schema 空表初始化。
6. 实现 `insert/search/delete/count/exists/refresh`。
7. 添加统一错误类型和参数校验。
8. 将 `main.ts` 缩减为业务层调用示例。
9. 增加并发首写、不同 URI 隔离、跨句柄一致性、维度错误、表不存在、过滤搜索测试。
10. 验证 Node.js 进程可以自然退出，项目内数据库可重复打开。

## 15. 验收标准

- 初始化 Store 只需一行。
- 业务代码不存在 `connect/openTable/close`。
- 同一操作不重复传表名。
- 开发模式第一次 `insert` 自动建表；生产模式用显式 schema 安全初始化。
- 多个 Store 共用同 URI 连接，但不同 URI 相互隔离。
- 单进程并发第一次写入不会随机失败、覆盖或丢失数据。
- 文档和 API 不承诺无协调的跨进程推断建表安全性。
- 搜索结果有业务泛型提示和 `_distance`。
- 多写入方的一致性行为可配置且经过测试。
- 有索引时搜索度量不会与索引配置静默冲突。
- 测试进程正常退出，不依赖调用方手动关闭。
- `main.ts` 不超过一个简短业务示例所需的复杂度。

## 16. 官方资料依据

本设计按 2026-09-16 查阅的 LanceDB 官方文档与当前安装的 `@lancedb/lancedb` 类型定义整理：

- [Quickstart](https://docs.lancedb.com/quickstart)：本地、对象存储和 Enterprise URI 形式。
- [Ingesting Data](https://docs.lancedb.com/tables/create)：`existOk`、`overwrite`、显式 schema、空表和大批量 `add()` 建议。
- [Consistency](https://docs.lancedb.com/tables/consistency)：`readConsistencyInterval` 与 `checkoutLatest()` 语义。
- [Updating and Modifying Table Data](https://docs.lancedb.com/tables/update)：update、merge insert、软删除和 optimize。
- [Vector Search](https://docs.lancedb.com/search/vector-search)：距离度量、向量列、精确与 ANN 查询、未索引数据。
- [Vector Indexes](https://docs.lancedb.com/indexing/vector-index)：索引类型、距离约束、异步索引与追加后的维护。
- [Cloud Storage Configuration](https://docs.lancedb.com/storage/configuration)：对象存储配置、凭据与新表选项。
- 当前 SDK 类型定义：`Connection` 与 `Table` 都被标注为应长期复用；`Table` 会缓存索引数据；两者关闭均为可选且 `close()` 可重复调用。
