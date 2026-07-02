# 07d. 记忆 API 地图与选择指南

> 本章不写实现，专门整理 LangChain.js / LangGraph 记忆相关 API 的用途、边界和选择顺序。

## 1. API 总览

| API | 来自 | 解决的问题 |
| --- | --- | --- |
| `HumanMessage` / `AIMessage` / `SystemMessage` / `ToolMessage` | `@langchain/core/messages` | 表示模型上下文 |
| `MessagesPlaceholder` | `@langchain/core/prompts` | 在 prompt 中插入历史消息 |
| `createAgent` | `langchain` | 创建官方 agent |
| `MemorySaver` | `@langchain/langgraph` | 内存版短期记忆 checkpointer |
| `checkpointer` | LangGraph 概念 | 保存 thread state |
| `thread_id` | runnable config | 区分不同会话线程 |
| `PostgresSaver` | `@langchain/langgraph-checkpoint-postgres` | 生产级短期记忆持久化 |
| `InMemoryStore` / `MemoryStore` | `@langchain/langgraph` | 内存版长期记忆 store |
| `PostgresStore` | `@langchain/langgraph-checkpoint-postgres/store` | 生产级长期记忆 store |
| `ToolRuntime` | `langchain` | 工具内部访问 state / context / store |
| `createMiddleware` | `langchain` | 在模型调用前后管理 state |
| `trimMessages` | `langchain` | 裁剪消息历史 |
| `RemoveMessage` | `@langchain/core/messages` | 删除 state 中的消息 |
| `REMOVE_ALL_MESSAGES` | `@langchain/langgraph` | 清空 messages state 的特殊 id |
| `summarizationMiddleware` | `langchain` | 自动摘要长对话 |

## 2. 学习时不要混淆的四组概念

### 2.1 `messages` 不是 `memory`

`messages` 是模型输入格式。`memory` 是保存、恢复、筛选这些上下文的机制。

```text
messages 是数据
memory 是管理这些数据的系统
```

当前项目第一版可以只管理：

```ts
BaseMessage[]
```

但官方 agent 中，短期记忆保存的是更完整的 state。

### 2.2 `thread_id` 不是 `userId`

`thread_id` 表示一条会话线程。

`userId` 表示用户身份。

一个用户可以有多个 thread：

```text
user-1 / thread-default
user-1 / thread-debug
user-1 / thread-docs
```

因此：

```text
短期记忆隔离：thread_id
长期记忆归属：userId / orgId / projectId 等 namespace
```

### 2.3 `checkpointer` 不是 `store`

| 概念 | 保存什么 | 典型 key |
| --- | --- | --- |
| `checkpointer` | 单个 thread 的 agent state | `thread_id` |
| `store` | 跨 thread 的 JSON 记忆 | `namespace + key` |

简单判断：

```text
刚才说了什么？ -> checkpointer
以后也要记住什么？ -> store
```

### 2.4 `context` 不是长期记忆

调用 agent 时可以传：

```ts
await agent.invoke(
  { messages: [{ role: "user", content: "你好" }] },
  { context: { userId: "user-123" } },
);
```

这里的 `context` 是本次调用携带的运行时上下文，不等于长期记忆。它通常用来告诉工具和 middleware：

```text
当前用户是谁
当前组织是谁
当前 workspace 是哪个
本轮请求有哪些权限
```

真正持久保存的长期记忆在 `store` 里。

## 3. `MemorySaver` 该什么时候用

适合：

- 学习 LangGraph 短期记忆。
- 本地 demo。
- 单进程 CLI 验证。
- 理解 `thread_id`。

不适合：

- 生产环境。
- 需要重启恢复的服务。
- 多进程或多副本部署。
- 需要审计、备份、迁移的数据。

判断标准：

```text
如果进程重启后记忆丢失也没关系，可以用 MemorySaver。
如果丢失不可接受，就不要用 MemorySaver 作为最终方案。
```

## 4. `PostgresSaver` 和 `PostgresStore` 怎么选

这两个名字很像，但用途不同。

| API | 用途 |
| --- | --- |
| `PostgresSaver` | 保存短期 thread state |
| `PostgresStore` | 保存长期 JSON 记忆 |

短期记忆：

```ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(DB_URI);
await checkpointer.setup();
```

长期记忆：

```ts
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";

const store = PostgresStore.fromConnString(DB_URI);
await store.setup();
```

它们可以同时使用：

```ts
const agent = createAgent({
  model,
  tools,
  checkpointer,
  store,
});
```

## 5. 什么时候需要 `MessagesPlaceholder`

如果你还没有使用 `createAgent`，而是手写：

```text
ChatPromptTemplate -> ChatOpenAI
```

那历史消息需要自己插入 prompt：

```ts
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是一个 CLI Agent。"],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);
```

调用时：

```ts
await chain.invoke({
  input: "我刚才说我叫什么？",
  history: memory.getRecentMessages(20),
});
```

注意：当前输入不要同时放进 `history` 和 `{input}`。

## 6. 什么时候需要 `ToolRuntime`

当工具需要知道当前用户、读取长期记忆、或写入 agent state 时，就需要 `ToolRuntime`。

例如：

```ts
const getUserInfo = tool(
  async (_, runtime) => {
    const userId = runtime.context.userId;
    const item = await runtime.store.get(["users"], userId);
    return JSON.stringify(item?.value ?? {});
  },
  {
    name: "get_user_info",
    description: "读取用户资料",
    schema: z.object({}),
  },
);
```

工具的入参 schema 是模型可见的；`runtime` 是隐藏参数，模型不会直接看到。

## 7. 什么时候需要 middleware

出现这些需求时，用 middleware：

- 模型调用前裁剪历史。
- 模型调用前动态生成 system prompt。
- 模型调用后检查回复内容。
- 将早期消息摘要化。
- 扩展 agent state。

常见 hook：

| hook | 时机 |
| --- | --- |
| `beforeModel` | 调模型前 |
| `afterModel` | 调模型后 |

示例：

```ts
const middleware = createMiddleware({
  name: "BeforeModelExample",
  beforeModel: async (state) => {
    return {
      messages: state.messages,
    };
  },
});
```

## 8. 选择路线

### 路线 A：当前项目手写路线

适合现在的 `mini-agent-langchain`：

```text
Memory class
  -> MessagesPlaceholder
  -> getRecentMessages(20)
  -> session JSONL
  -> 后续迁移到 createAgent
```

优点：每一步都能观察底层机制。

### 路线 B：官方 agent 路线

适合新项目或准备直接用 LangChain agent：

```text
createAgent
  -> MemorySaver
  -> thread_id
  -> middleware
  -> PostgresSaver
```

优点：更贴近官方生产路径。

### 路线 C：长期记忆路线

短期记忆稳定后再开始：

```text
InMemoryStore
  -> namespace 设计
  -> tool 读写 store
  -> semantic search
  -> PostgresStore
```

优点：把用户偏好、项目事实和会话历史分开。

## 9. 对当前项目的建议

当前 `package.json` 已经包含：

```json
{
  "langchain": "^1.5.0",
  "@langchain/langgraph": "^1.4.4",
  "@langchain/core": "^1.2.0"
}
```

所以可以按现代 API 学习，但实现顺序仍建议保守：

```text
先手写短期 messages
再学 MemorySaver
再学 PostgresSaver
最后学 store 和长期记忆
```

这样不会把“聊天历史”“线程状态”“长期偏好”“知识库检索”混成一团。

## 10. 官方资料

- Short-term memory: https://docs.langchain.com/oss/javascript/langchain/short-term-memory
- Long-term memory: https://docs.langchain.com/oss/javascript/langchain/long-term-memory
- Checkpointers: https://docs.langchain.com/oss/javascript/langgraph/checkpointers
- Stores: https://docs.langchain.com/oss/javascript/langgraph/stores
