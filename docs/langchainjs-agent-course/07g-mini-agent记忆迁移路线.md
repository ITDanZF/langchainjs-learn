# 07g. mini-agent-langchain 记忆迁移路线

> 本章把前面几章的概念落回当前项目：从 `src/Memory/index.ts` 空类，逐步迁移到 LangChain.js 官方记忆体系。

## 1. 当前项目状态

当前模型调用大致是：

```text
main.ts
  -> runTime.AgentRuntime.model.stream(input)
  -> PrintStream(result)
```

这意味着：

```text
每一轮用户输入都是独立请求
模型不会自动知道上一轮说过什么
```

目标验收：

```text
> 我叫张三
> 我刚才说我叫什么？
```

同一个 thread 中，agent 能回答“张三”。

## 2. 总迁移路线

推荐路线要更明确地分成三大阶段：

```text
第一阶段：只做进程内内存记忆
  Memory class
  Prompt 接入 history
  main.ts 写回 user / ai messages
  可选 threadId 隔离

第二阶段：再做磁盘 session 缓存
  JSONL / JSON 文件
  CLI 重启后恢复同一个 thread

第三阶段：最后接数据库和跨对话存储
  PostgresSaver / SQLiteSaver 保存 thread state
  PostgresStore 保存长期记忆
  middleware 管理长上下文
```

不要一开始就同时做磁盘、数据库、长期记忆、摘要和语义搜索。每一步都应该能单独验收。

## 3. 阶段 1：进程内 Memory

新增或改造：

```text
mini-agent-langchain/src/Memory/index.ts
```

目标接口：

```ts
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";

export class Memory {
  private messages: BaseMessage[] = [];

  addUserMessage(content: string): void {
    this.messages.push(new HumanMessage(content));
  }

  addAiMessage(content: string): void {
    this.messages.push(new AIMessage(content));
  }

  getRecentMessages(limit = 20): BaseMessage[] {
    return this.messages.slice(-limit);
  }

  clear(): void {
    this.messages = [];
  }
}
```

验收：

```text
Memory 能保存 human / ai 两类消息
getRecentMessages 能返回最近 N 条
```

## 4. 阶段 2：Prompt 接入 history

改造：

```text
mini-agent-langchain/src/model/Model.ts
```

Prompt 从：

```ts
ChatPromptTemplate.fromMessages([
  ["system", "..."],
  ["human", "{input}"],
]);
```

改为：

```ts
import { MessagesPlaceholder } from "@langchain/core/prompts";

ChatPromptTemplate.fromMessages([
  ["system", "..."],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);
```

`stream` 从接收字符串演进为：

```ts
stream(options: { input: string; history?: BaseMessageLike[] }) {
  return this.getChain().stream({
    input: options.input,
    history: options.history ?? [],
  });
}
```

兼容旧调用可以单独设计，但不要静默吞掉错误。当前教程建议直接改调用方。

## 5. 阶段 3：主流程写回记忆

主流程：

```text
读取 history
  -> 调模型
  -> 收集完整 assistant 回复
  -> 写入 user message
  -> 写入 ai message
```

伪代码：

```ts
const history = memory.getRecentMessages(20);

const stream = await model.stream({
  input,
  history,
});

const answer = await PrintStream(stream);

memory.addUserMessage(input);
memory.addAiMessage(answer);
```

这里有两个关键点：

- 本轮用户输入不要提前放进 history。
- `PrintStream` 需要返回完整文本，否则 AI 回复无法写回记忆。

## 6. 阶段 4：threadId 隔离

单数组升级为：

```ts
private threads = new Map<string, BaseMessage[]>();
```

接口变成：

```ts
addUserMessage(threadId: string, content: string): void;
addAiMessage(threadId: string, content: string): void;
getRecentMessages(threadId: string, limit?: number): BaseMessage[];
clear(threadId: string): void;
```

CLI 命令可以设计为：

```text
/thread
/thread <id>
/threads
/clear
```

验收：

```text
default thread 中记住“张三”
切到 fresh thread 后不知道“张三”
切回 default 后仍然知道“张三”
```

## 7. 第二阶段：session JSONL 磁盘缓存

当前项目已经有：

```text
~/.mini-agent/sessions
```

可以保存：

```text
~/.mini-agent/sessions/<thread-id>.jsonl
```

每行一条消息：

```json
{"role":"human","content":"我叫张三","createdAt":"2026-07-02T00:00:00.000Z"}
{"role":"ai","content":"好的，我记住了。","createdAt":"2026-07-02T00:00:01.000Z"}
```

建议不要直接序列化 `BaseMessage` 实例，而是定义 DTO：

```ts
type PersistedMessage = {
  role: "human" | "ai" | "system" | "tool";
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};
```

验收：

```text
退出 CLI
重新启动 CLI
同一个 thread 能恢复历史
```

## 8. 第三阶段 A：迁移到 createAgent + MemorySaver

当课程进入官方 agent 路线后，可以把手写 Memory 替换为官方内存 checkpointer：

```ts
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";

const agent = createAgent({
  model,
  tools,
  checkpointer: new MemorySaver(),
});
```

调用：

```ts
await agent.invoke(
  { messages: [{ role: "user", content: input }] },
  { configurable: { thread_id: threadId } },
);
```

映射关系：

| 手写阶段 | 官方阶段 |
| --- | --- |
| `Memory` | `checkpointer` |
| `threadId` | `configurable.thread_id` |
| `messages[]` | `state.messages` |
| JSONL session | 数据库 checkpointer |

注意：`MemorySaver` 仍然是内存实现，不是磁盘缓存，也不是数据库。它适合学习官方 `checkpointer + thread_id` 语义。

## 9. 第三阶段 B：生产短期持久化

如果需要重启恢复、服务部署、多用户共享，就换成数据库 checkpointer。

```ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(DB_URI);
await checkpointer.setup();
```

本地 CLI 也可以考虑 SQLite：

```text
@langchain/langgraph-checkpoint-sqlite
```

选择：

| 场景 | 推荐 |
| --- | --- |
| 学习 | `MemorySaver` |
| 本地 CLI 落盘 | JSONL 或 SQLite |
| 生产服务 | `PostgresSaver` |

## 10. 第三阶段 C：跨对话长期记忆 store

短期记忆稳定后，再加长期记忆。

```ts
import { InMemoryStore } from "@langchain/langgraph";

const store = new InMemoryStore();

const agent = createAgent({
  model,
  tools,
  checkpointer,
  store,
});
```

长期记忆不要保存整段聊天，而是保存提炼后的稳定信息：

```ts
await store.put(["users", userId, "preferences"], "language", {
  value: "中文",
});
```

建议先做手动命令：

```text
/memory remember language 中文
/memory recall language
/memory forget language
```

自动提取长期记忆要等权限、隐私和删除策略明确后再做。

## 11. 阶段 9：middleware 管理上下文

当短期 messages 变长后，再加：

```text
trimMessages
RemoveMessage
summarizationMiddleware
dynamicSystemPromptMiddleware
```

推荐顺序：

```text
1. 最近 20 条
2. token 级 trim
3. summary
4. 工具调用消息成组裁剪
```

## 12. 当前最小任务清单

如果下一步要真的改代码，当前只做第一阶段的最小任务：

```text
1. 实现 src/Memory/index.ts
2. Model.ts 支持 history
3. PrintStream 返回完整文本
4. main.ts 写入 Memory
5. 验证两轮中文对话
```

先不要做：

```text
磁盘 JSONL
PostgreSQL
长期记忆
语义搜索
自动记忆提取
多用户权限
```

这些都应该在短期闭环稳定后再上。

## 13. 官方资料

- Short-term memory: https://docs.langchain.com/oss/javascript/langchain/short-term-memory
- Long-term memory: https://docs.langchain.com/oss/javascript/langchain/long-term-memory
- Checkpointers: https://docs.langchain.com/oss/javascript/langgraph/checkpointers
- Stores: https://docs.langchain.com/oss/javascript/langgraph/stores
