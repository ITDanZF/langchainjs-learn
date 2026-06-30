# 07a. LangGraph 记忆官方教程解读

> 本章基于 LangGraph 官方 Memory 文档整理，用来帮助你把官方概念映射到 `mini-agent-langchain`。

官方资料：

- LangGraph Memory: https://docs.langchain.com/oss/javascript/langgraph/add-memory
- LangGraph Persistence: https://docs.langchain.com/oss/javascript/langgraph/persistence
- LangChain trimMessages: https://js.langchain.com/docs/how_to/trim_messages/

## 1. 官方把记忆分成两类

LangGraph 官方文档里，记忆主要分成：

```text
short-term memory
long-term memory
```

对应中文可以理解为：

```text
短期记忆：当前 thread 内的对话和状态
长期记忆：跨 thread / 跨 session 的用户或应用数据
```

### 短期记忆

短期记忆服务于多轮对话。

例如：

```text
thread_id = "1"

user: hi! i am Bob
assistant: Hi Bob!
user: what's my name?
assistant: Your name is Bob.
```

这里模型能回答 Bob，是因为相同 `thread_id` 下保存了前面的 messages。

### 长期记忆

长期记忆服务于跨会话复用。

例如：

```text
用户偏好 dark mode
用户常用 TypeScript
项目默认启动命令是 npm run dev
```

这些信息即使换了新 thread，也可能仍然有用。

## 2. 短期记忆的核心 API

官方最小示例是：

```ts
import { MemorySaver, StateGraph } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const builder = new StateGraph(...);
const graph = builder.compile({ checkpointer });

await graph.invoke(
  { messages: [{ role: "user", content: "hi! i am Bob" }] },
  { configurable: { thread_id: "1" } },
);
```

这里有三个核心点：

| API / 参数 | 作用 |
| --- | --- |
| `StateGraph` | 定义带状态的 agent 执行图 |
| `MemorySaver` | 开发环境用的内存 checkpointer |
| `configurable.thread_id` | 区分不同会话线程 |

一句话：

```text
checkpointer 保存 state，thread_id 决定保存到哪个会话。
```

## 3. 为什么叫 thread-level persistence

官方说短期记忆是 thread-level persistence，也就是“线程级持久化”。

这里的 thread 不是操作系统线程，而是对话线程：

```text
thread_id = "default"
thread_id = "docs"
thread_id = "debug"
```

每个 thread 有自己的 state。state 里可以有：

```text
messages
summary
tool results
current task status
```

所以它比简单聊天历史更广：

```text
聊天历史是 state 的一部分。
短期记忆保存的是整个 thread state。
```

## 4. MemorySaver 适合什么阶段

`MemorySaver` 是内存实现：

```ts
const checkpointer = new MemorySaver();
```

适合：

- 学习
- 本地开发
- 单进程 demo
- 验证 thread_id 概念

不适合：

- 生产环境
- 多进程服务
- 程序重启后恢复状态
- 多机器共享状态

生产环境官方建议换成数据库支持的 checkpointer，例如：

```ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(DB_URI);
```

或 MongoDB：

```ts
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";

const checkpointer = new MongoDBSaver({ client });
```

## 5. 当前项目如何映射

当前 `mini-agent-langchain` 还没有 `StateGraph`，所以不能直接说“已经有 LangGraph 短期记忆”。

当前项目可以先手写：

```ts
class Memory {
  private threads = new Map<string, BaseMessageLike[]>();
}
```

对应官方概念：

| 当前手写概念 | 官方 LangGraph 概念 |
| --- | --- |
| `Memory` | checkpointer 的学习版 |
| `Map<threadId, messages>` | thread state |
| `threadId` | `configurable.thread_id` |
| `messages[]` | state.messages |
| `clear(threadId)` | `checkpointer.deleteThread(threadId)` |

当你后面引入 `StateGraph`，这套手写 Memory 就可以逐步迁移到 `MemorySaver`。

## 6. 长期记忆的核心 API

官方长期记忆使用 `store`：

```ts
import { InMemoryStore, StateGraph } from "@langchain/langgraph";

const store = new InMemoryStore();

const builder = new StateGraph(...);
const graph = builder.compile({ store });
```

节点内部通过 runtime 访问：

```ts
const callModel = async (state, runtime) => {
  const userId = runtime.context?.userId;
  const namespace = [userId, "memories"];

  const memories = await runtime.store?.search(namespace, {
    query: state.messages.at(-1)?.content,
    limit: 3,
  });

  await runtime.store?.put(namespace, crypto.randomUUID(), {
    data: "User prefers dark mode",
  });
};
```

这里最重要的是 namespace。

例如：

```text
["user-123", "memories"]
["project-agent-tui", "rules"]
["org", "policies"]
```

namespace 决定一条长期记忆属于谁、属于什么范围。

## 7. 短期记忆和长期记忆不要混用

| 问题 | 应该用 |
| --- | --- |
| 用户刚才说了什么？ | 短期记忆 |
| 当前任务执行到哪一步？ | 短期记忆 |
| 当前 thread 的工具结果是什么？ | 短期记忆 |
| 用户长期偏好什么？ | 长期记忆 |
| 这个项目长期约定是什么？ | 长期记忆 |
| 新 thread 也要知道什么？ | 长期记忆 |

不要把每一句聊天都写进长期记忆。

长期记忆应该保存经过筛选的、未来仍有价值的信息。

## 8. 语义搜索是什么

官方文档里长期记忆可以开启 semantic search：

```ts
import { OpenAIEmbeddings } from "@langchain/openai";
import { InMemoryStore } from "@langchain/langgraph";

const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
const store = new InMemoryStore({
  index: {
    embeddings,
    dims: 1536,
  },
});
```

然后可以按语义检索：

```ts
const items = await store.search(["user_123", "memories"], {
  query: "I'm hungry",
  limit: 1,
});
```

如果 store 里有：

```text
I love pizza
I am a plumber
```

查询 `I'm hungry` 可能检索到 `I love pizza`。

这就是语义搜索：不是按关键词完全匹配，而是按语义相似度找相关记忆。

当前项目暂时不建议上语义搜索。先做普通 messages 记忆。

## 9. 长对话为什么需要管理短期记忆

短期记忆不能无限增长，因为模型上下文窗口有限。

官方给了几种策略：

```text
trim messages
delete messages
summarize messages
manage checkpoints
custom strategies
```

中文理解：

| 策略 | 作用 |
| --- | --- |
| 修剪消息 | 保留最后 N 条或最后 N 个 token |
| 删除消息 | 从 state 中永久删除某些消息 |
| 总结消息 | 把早期对话压缩成 summary |
| 管理 checkpoints | 查看、恢复、删除 thread 状态 |
| 自定义策略 | 按角色、工具、任务阶段过滤 |

## 10. trimMessages

官方建议使用 LangChain 的 `trimMessages`：

```ts
import { trimMessages } from "@langchain/core/messages";

const messages = trimMessages(state.messages, {
  strategy: "last",
  maxTokens: 128,
  startOn: "human",
  endOn: ["human", "tool"],
});
```

它的目标是：

```text
在调用模型前，把 messages 控制在上下文限制内。
```

当前项目早期可以先用更简单的策略：

```text
最多保留最近 20 条消息
```

等 messages 管理稳定后，再引入 token 级 trim。

## 11. RemoveMessage

官方可以用 `RemoveMessage` 从图状态中删除消息：

```ts
import { RemoveMessage } from "@langchain/core/messages";

return {
  messages: messages
    .slice(0, 2)
    .map((m) => new RemoveMessage({ id: m.id })),
};
```

注意：删除消息会影响模型输入格式。尤其是工具调用场景：

```text
assistant tool call
必须跟着对应 tool result
```

如果只删一半，消息历史可能变成无效结构。

当前项目没有工具调用时，删除策略会简单很多。

## 12. 总结消息

官方还提供 summary 思路：

```text
早期 messages
  ↓
模型总结
  ↓
summary
  ↓
保留 summary + 最近几轮 messages
```

这种方式适合长对话。

示例结构：

```ts
const State = new StateSchema({
  messages: MessagesValue,
  summary: z.string().optional(),
});
```

调用模型前：

```text
system: Summary of conversation earlier: ...
recent messages...
```

当前项目可以后续在 `Memory` 中增加：

```ts
summary?: string
```

但第一版不需要。

## 13. 管理 checkpoints

官方提供查看 thread state：

```ts
await graph.getState({
  configurable: {
    thread_id: "1",
  },
});
```

查看历史：

```ts
for await (const state of graph.getStateHistory(config)) {
  console.log(state);
}
```

删除 thread：

```ts
await checkpointer.deleteThread("1");
```

这些能力在你自己的项目里可以先对应成：

```text
/memory
/threads
/clear
/delete-thread <id>
```

## 14. 数据库迁移

官方提醒：如果使用 Postgres、Redis、Oracle 等数据库支持的持久化实现，需要先运行迁移创建 schema。

很多官方库会提供：

```ts
await checkpointer.setup();
await store.setup();
```

这说明生产级记忆不是简单“写入一个数组”，而是一套可部署、可迁移、可审计的数据层。

当前项目先使用文件或内存即可。

## 15. 推荐实现路线

结合当前 `mini-agent-langchain`，推荐路线是：

```text
第一步：Memory class
  Map<threadId, messages[]>

第二步：main.ts 接入 Memory
  每轮输入前追加 human message
  模型回复后追加 assistant message

第三步：CLI 支持 thread 命令
  /thread <id>
  /clear

第四步：session jsonl 落盘
  ~/.mini-agent/sessions/<thread-id>.jsonl

第五步：引入 LangGraph
  StateGraph + MessagesValue + MemorySaver

第六步：生产持久化
  PostgresSaver / MongoDBSaver

第七步：长期记忆
  InMemoryStore / PostgresStore / semantic search
```

## 16. 学习检查题

读完本章后，你应该能回答：

1. `MemorySaver` 保存的是什么？
2. `thread_id` 为什么不能省略？
3. 短期记忆和长期记忆有什么区别？
4. `checkpointer` 和 `store` 分别负责什么？
5. 为什么长对话需要 trim 或 summary？
6. 为什么当前项目不应该一开始就做向量记忆？

如果这些问题能说清楚，就可以回到 `src/Memory/index.ts` 开始实现第一版短期记忆。
