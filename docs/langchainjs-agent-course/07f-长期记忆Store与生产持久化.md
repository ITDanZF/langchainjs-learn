# 07f. 长期记忆 Store 与生产持久化

> 本章聚焦长期记忆：跨 thread、跨 session 仍然应该被记住的信息，应该如何用 LangGraph store 表达。

## 1. 长期记忆解决什么问题

短期记忆回答：

```text
当前 thread 里刚才发生了什么？
```

长期记忆回答：

```text
换一个 thread 之后，agent 仍然应该知道什么？
```

适合长期保存的信息：

- 用户长期偏好。
- 用户资料。
- 项目稳定事实。
- 组织规则。
- 可复用工作约定。

不适合长期保存的信息：

- 每一句闲聊。
- 临时情绪。
- 一次性任务细节。
- 敏感信息。
- 未经用户允许保存的隐私内容。

## 2. 官方核心 API：store

长期记忆由 `store` 承载。

开发环境：

```ts
import { createAgent } from "langchain";
import { InMemoryStore } from "@langchain/langgraph";

const store = new InMemoryStore();

const agent = createAgent({
  model: "openai:gpt-5-mini",
  tools: [],
  store,
});
```

生产环境：

```ts
import { createAgent } from "langchain";
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";

const store = PostgresStore.fromConnString(process.env.POSTGRES_URI!);
await store.setup();

const agent = createAgent({
  model: "openai:gpt-5-mini",
  tools: [],
  store,
});
```

## 3. namespace + key

长期记忆是 JSON 文档，用 `namespace + key` 组织。

```ts
const namespace = ["user-123", "preferences"];
const key = "language";

await store.put(namespace, key, {
  value: "用户偏好中文回答",
});
```

读取：

```ts
const item = await store.get(namespace, key);
console.log(item?.value);
```

搜索：

```ts
const items = await store.search(namespace, {
  query: "用户语言偏好",
  limit: 3,
});
```

可以把 `namespace` 理解为目录：

```text
["user-123", "preferences"]
["user-123", "facts"]
["project-agent-tui", "rules"]
["org-acme", "policies"]
```

## 4. namespace 设计建议

不要把所有长期记忆都放进一个 namespace。

推荐按归属和类型拆：

| namespace | 保存内容 |
| --- | --- |
| `["users", userId, "profile"]` | 用户资料 |
| `["users", userId, "preferences"]` | 用户偏好 |
| `["projects", projectId, "facts"]` | 项目事实 |
| `["projects", projectId, "rules"]` | 项目约定 |
| `["orgs", orgId, "policies"]` | 组织规则 |

当前 `mini-agent-langchain` 可以先用：

```text
["workspace", workspaceId, "memories"]
["workspace", workspaceId, "rules"]
["user", userId, "preferences"]
```

## 5. 工具读取长期记忆

长期记忆通常通过工具读写。

```ts
import { createAgent, tool, type ToolRuntime } from "langchain";
import { InMemoryStore } from "@langchain/langgraph";
import * as z from "zod";

const store = new InMemoryStore();

const contextSchema = z.object({
  userId: z.string(),
});

await store.put(["users"], "user_123", {
  name: "John Smith",
  language: "Chinese",
});

const getUserInfo = tool(
  async (_, runtime: ToolRuntime<unknown, z.infer<typeof contextSchema>>) => {
    const userId = runtime.context.userId;
    const item = await runtime.store.get(["users"], userId);
    return item?.value ? JSON.stringify(item.value) : "Unknown user";
  },
  {
    name: "get_user_info",
    description: "读取用户长期资料",
    schema: z.object({}),
  },
);

const agent = createAgent({
  model: "openai:gpt-5-mini",
  tools: [getUserInfo],
  contextSchema,
  store,
});
```

调用时传入 `context`：

```ts
await agent.invoke(
  { messages: [{ role: "user", content: "我偏好什么语言？" }] },
  { context: { userId: "user_123" } },
);
```

## 6. 工具写入长期记忆

写入长期记忆要更谨慎。建议只让特定工具执行写入，并且工具描述明确。

```ts
const saveUserPreference = tool(
  async (
    input: { key: string; value: string },
    runtime: ToolRuntime<unknown, z.infer<typeof contextSchema>>,
  ) => {
    const userId = runtime.context.userId;
    await runtime.store.put(["users", userId, "preferences"], input.key, {
      value: input.value,
      updatedAt: new Date().toISOString(),
    });
    return "已保存偏好。";
  },
  {
    name: "save_user_preference",
    description: "保存用户明确表达的长期偏好",
    schema: z.object({
      key: z.string(),
      value: z.string(),
    }),
  },
);
```

推荐策略：

- 只保存用户明确表达的稳定偏好。
- 避免自动保存敏感信息。
- 支持查看和删除。
- 记录来源和更新时间。

## 7. 语义搜索

store 支持语义搜索。需要配置 embedding：

```ts
import { OpenAIEmbeddings } from "@langchain/openai";
import { InMemoryStore } from "@langchain/langgraph";

const store = new InMemoryStore({
  index: {
    embeddings: new OpenAIEmbeddings({ model: "text-embedding-3-small" }),
    dims: 1536,
    fields: ["value", "$"],
  },
});
```

搜索：

```ts
const memories = await store.search(["users", userId, "preferences"], {
  query: "用户喜欢怎样的回答风格？",
  limit: 3,
});
```

第一版不建议马上做语义搜索。可以先用 `get` / `put` / 普通 `search` 把数据边界跑通。

## 8. 长期记忆和 RAG 的区别

| 能力 | 保存什么 | 典型来源 |
| --- | --- | --- |
| 长期记忆 | 用户、项目、组织的稳定事实和偏好 | 对话中提炼 |
| RAG | 外部知识库文档 | 文件、网页、数据库、FAQ |

例子：

```text
用户说“以后回答我都用中文” -> 长期记忆
项目 README 里的启动命令 -> RAG 或项目事实
公司制度 PDF -> RAG
用户常用 TypeScript -> 长期记忆
```

不要把 RAG 文档全塞进长期记忆。长期记忆应该小而准。

## 9. 生产持久化

开发阶段：

```ts
const store = new InMemoryStore();
```

生产阶段：

```ts
const store = PostgresStore.fromConnString(DB_URI);
await store.setup();
```

其他生产 store 还可以考虑：

- `MongoDBStore`
- `RedisStore`

选择标准：

| 场景 | 推荐 |
| --- | --- |
| 本地学习 | `InMemoryStore` |
| 小型 CLI 本地落盘 | 自定义 JSON / SQLite，或后续 SQLite store |
| 服务端生产 | `PostgresStore` |
| 已有 MongoDB 技术栈 | `MongoDBStore` |
| 高速缓存型记忆 | `RedisStore` |

## 10. 当前项目的实现建议

`mini-agent-langchain` 第一阶段不要直接做长期记忆。建议顺序：

```text
1. 短期 messages 跑通
2. threadId 隔离跑通
3. session JSONL 落盘跑通
4. 再设计 LongTermMemoryStore
5. 先保存 workspace 级项目规则
6. 再保存 user 级偏好
7. 最后考虑 semantic search
```

第一版长期记忆可以只做手动命令：

```text
/memory remember <key> <value>
/memory recall <key>
/memory forget <key>
/memory list
```

自动写入长期记忆要等安全边界明确后再做。

## 11. 官方资料

- Long-term memory: https://docs.langchain.com/oss/javascript/langchain/long-term-memory
- Stores: https://docs.langchain.com/oss/javascript/langgraph/stores
- Short-term memory: https://docs.langchain.com/oss/javascript/langchain/short-term-memory
