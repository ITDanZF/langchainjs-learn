# 07c. LangChain.js 完整记忆体系：messages、checkpointer、store

> 本章基于 LangChain.js / LangGraph 2026-07-02 官方文档整理，目标是回答一个核心问题：LangChain.js 里“记忆”到底由哪些层组成，应该先学哪些 API。

## 1. 先给结论

LangChain.js 的完整记忆不是一个 `Memory` 类，而是一套分层机制：

```text
messages
  模型真正能看到的上下文

short-term memory
  单个 thread 内的 agent state
  由 checkpointer 保存

long-term memory
  跨 thread / 跨 session 的稳定信息
  由 store 保存

memory management
  裁剪、删除、摘要、动态 prompt、工具读写
  由 middleware / tools / runtime 完成
```

如果只学：

```ts
const checkpointer = new MemorySaver();
```

只能理解“短期记忆的内存版保存器”。它很重要，但不是完整记忆体系。

## 2. 第一层：messages

`messages` 是模型上下文的基本单位。

常见角色：

| 角色 | LangChain 类 | 说明 |
| --- | --- | --- |
| `system` | `SystemMessage` | 系统指令、角色设定、约束 |
| `user` / `human` | `HumanMessage` | 用户输入 |
| `assistant` / `ai` | `AIMessage` | 模型回复，也可能包含 tool calls |
| `tool` | `ToolMessage` | 工具执行结果 |

典型调用：

```ts
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const messages = [
  new SystemMessage("你是一个 CLI 编程助手。"),
  new HumanMessage("我叫张三"),
];

const result = await model.invoke(messages);
```

如果你手写记忆，第一件事就是管理这些 messages。

## 3. 第二层：短期记忆 short-term memory

短期记忆解决的问题是：

```text
同一个会话线程里，agent 如何知道刚才发生了什么？
```

官方推荐 API：

```ts
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const agent = createAgent({
  model: "openai:gpt-5-mini",
  tools: [],
  checkpointer,
});

const config = {
  configurable: {
    thread_id: "default",
  },
};

await agent.invoke(
  { messages: [{ role: "user", content: "我叫张三" }] },
  config,
);

const result = await agent.invoke(
  { messages: [{ role: "user", content: "我刚才说我叫什么？" }] },
  config,
);
```

这里有三个重点：

| 概念 | 作用 |
| --- | --- |
| `checkpointer` | 保存 agent / graph 的 thread state |
| `thread_id` | 指明这次调用属于哪条会话线程 |
| `messages` | state 中最常见、最重要的一部分 |

`MemorySaver` 是内存实现。进程重启后丢失，适合学习、本地 demo、单进程验证。

## 4. 第三层：生产级短期记忆

生产环境不要依赖 `MemorySaver`，因为它不落盘。

常见替代：

```ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(process.env.POSTGRES_URI!);
await checkpointer.setup();
```

官方 checkpointer 生态还包括：

| 实现 | 适合场景 |
| --- | --- |
| `MemorySaver` | 学习、测试、单进程 demo |
| `SqliteSaver` | 本地工作流、小型桌面或 CLI 应用 |
| `PostgresSaver` | 生产服务、可恢复 agent state |
| `MongoDBSaver` | MongoDB 技术栈 |
| `RedisSaver` | Redis 技术栈、低延迟场景 |

迁移时，核心语义不变：仍然是用 `thread_id` 读取和保存 thread state。

## 5. 第四层：长期记忆 long-term memory

长期记忆解决的问题是：

```text
换了新 thread、新 session 后，agent 仍然应该知道什么？
```

例如：

```text
用户偏好中文回答
用户常用 TypeScript
当前项目默认启动命令是 npm run dev
用户不希望自动提交 git commit
```

官方推荐 API 是 `store`：

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

长期记忆以 JSON 文档保存，按 `namespace + key` 组织：

```ts
const namespace = ["user-123", "memories"];
const key = "preference-language";

await store.put(namespace, key, {
  preference: "用户偏好中文回答",
});

const item = await store.get(namespace, key);
```

`namespace` 可以理解为目录，`key` 可以理解为文件名。

## 6. 第五层：工具读写记忆

当 agent 有工具后，工具可以通过 runtime 访问短期 state、长期 store 和本轮 context。

读长期记忆：

```ts
import { createAgent, tool, type ToolRuntime } from "langchain";
import { InMemoryStore } from "@langchain/langgraph";
import * as z from "zod";

const store = new InMemoryStore();

const contextSchema = z.object({
  userId: z.string(),
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

写长期记忆：

```ts
const saveUserInfo = tool(
  async (
    userInfo: { name: string },
    runtime: ToolRuntime<unknown, z.infer<typeof contextSchema>>,
  ) => {
    const userId = runtime.context.userId;
    await runtime.store.put(["users"], userId, userInfo);
    return "已保存用户资料。";
  },
  {
    name: "save_user_info",
    description: "保存用户长期资料",
    schema: z.object({ name: z.string() }),
  },
);
```

注意：长期记忆写入应该有明确策略。不要把每一句聊天都保存成长期记忆。

## 7. 第六层：记忆管理 middleware

短期记忆不能无限增长。官方推荐通过 middleware 管理消息历史：

| 策略 | API / 概念 | 作用 |
| --- | --- | --- |
| 裁剪 | `trimMessages`、`beforeModel` | 调模型前保留一部分上下文 |
| 删除 | `RemoveMessage`、`REMOVE_ALL_MESSAGES` | 从 state 中删除旧消息 |
| 摘要 | `summarizationMiddleware` | 把早期对话压缩成 summary |
| 动态 prompt | `dynamicSystemPromptMiddleware` | 根据 context / state 生成系统提示词 |
| 自定义状态 | `StateSchema`、`createMiddleware` | 给 agent state 增加字段 |

示意：

```ts
import { createAgent, createMiddleware, trimMessages } from "langchain";
import { RemoveMessage } from "@langchain/core/messages";
import { MemorySaver, REMOVE_ALL_MESSAGES } from "@langchain/langgraph";

const trimMessageHistory = createMiddleware({
  name: "TrimMessages",
  beforeModel: async (state) => {
    const trimmed = await trimMessages(state.messages, {
      maxTokens: 384,
      strategy: "last",
      startOn: "human",
      endOn: ["human", "tool"],
      tokenCounter: (messages) => messages.length,
    });

    return {
      messages: [new RemoveMessage({ id: REMOVE_ALL_MESSAGES }), ...trimmed],
    };
  },
});

const agent = createAgent({
  model: "openai:gpt-5-mini",
  tools: [],
  middleware: [trimMessageHistory],
  checkpointer: new MemorySaver(),
});
```

## 8. 当前项目的学习顺序

`mini-agent-langchain` 目前是：

```text
ChatPromptTemplate -> ChatOpenAI -> stream / invoke
```

还不是完整的 `createAgent + checkpointer` 路线。因此推荐这样学：

```text
1. 手写 Memory 管理 BaseMessage[]
2. 给 Prompt 加 MessagesPlaceholder("history")
3. 让 Model.stream 支持 { input, history }
4. 在 main.ts 中把 user / ai 消息写回 Memory
5. 增加 threadId
6. 用 JSONL 把 session 落盘
7. 引入 createAgent + MemorySaver
8. 引入 PostgresSaver / SqliteSaver
9. 引入 store 做长期记忆
10. 引入 middleware 做 trim / summary
```

## 9. 一张总表

| 学习主题 | 关键 API | 何时学习 |
| --- | --- | --- |
| 消息结构 | `HumanMessage`、`AIMessage`、`SystemMessage`、`ToolMessage` | 最先学 |
| Prompt 中插入历史 | `MessagesPlaceholder` | 手写短期记忆时 |
| 短期记忆 | `MemorySaver`、`checkpointer`、`thread_id` | 引入 agent / graph 时 |
| 生产短期持久化 | `PostgresSaver`、`SqliteSaver`、`MongoDBSaver`、`RedisSaver` | 要重启恢复或部署时 |
| 长期记忆 | `InMemoryStore`、`PostgresStore`、`store.put/get/search` | 短期记忆稳定后 |
| 工具访问记忆 | `ToolRuntime`、`runtime.state`、`runtime.store`、`runtime.context` | 工具系统稳定后 |
| 记忆管理 | `createMiddleware`、`beforeModel`、`afterModel`、`trimMessages`、`RemoveMessage`、`summarizationMiddleware` | 上下文变长后 |

## 10. 官方资料

- LangChain.js Short-term memory: https://docs.langchain.com/oss/javascript/langchain/short-term-memory
- LangChain.js Long-term memory: https://docs.langchain.com/oss/javascript/langchain/long-term-memory
- LangChain.js Messages: https://docs.langchain.com/oss/javascript/langchain/messages
- LangGraph Checkpointers: https://docs.langchain.com/oss/javascript/langgraph/checkpointers
- LangGraph Stores: https://docs.langchain.com/oss/javascript/langgraph/stores
