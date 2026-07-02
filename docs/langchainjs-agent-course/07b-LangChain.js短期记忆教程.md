# 07b. LangChain.js 短期记忆教程

> 本章聚焦 LangChain.js 官方短期记忆写法，并把它映射回当前 `mini-agent-langchain` 的 `Memory`、`Model`、`main.ts`。

## 1. 本章目标

读完本章后，你应该能回答四个问题：

1. LangChain.js 里的短期记忆到底保存什么。
2. `checkpointer` 和 `thread_id` 分别负责什么。
3. 为什么长对话需要 trim、delete 或 summarize。
4. 当前项目如果还没有完全切到 `createAgent`，应该怎样先手写短期记忆。

验收目标仍然是这个最小场景：

```text
> 我叫张三
> 我刚才说我叫什么？
```

在同一个 thread 里，Agent 应该能回答“张三”。换到另一个 thread 后，它不应该知道这件事。

## 2. 短期记忆是什么

短期记忆是单个 conversation / thread 内的上下文状态。最常见的形式是消息历史：

```text
system: 你是一个 CLI Agent
user: 我叫张三
assistant: 好的，我记住了
user: 我刚才说我叫什么？
```

LangChain.js 的模型上下文以 messages 为基本单位。每条 message 通常包含：

| 字段 | 含义 |
| --- | --- |
| `role` | 消息角色，例如 `system`、`user`、`assistant`、`tool` |
| `content` | 文本、图片、音频、文档等内容 |
| `metadata` | 可选元数据，例如 message id、token usage、response metadata |

对于当前 `mini-agent-langchain`，第一版只需要保存 `human` 和 `ai` 两类文本消息。等工具调用接入以后，再保留 `tool_calls` 和 `ToolMessage`。

## 3. 官方推荐写法：createAgent + checkpointer

LangChain.js 官方短期记忆写法是在创建 agent 时传入 `checkpointer`。`checkpointer` 负责保存 agent state，`thread_id` 负责区分不同对话线程。

最小示例：

```ts
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const agent = createAgent({
  model: "openai:gpt-5-mini",
  tools: [],
  checkpointer,
});

const threadConfig = {
  configurable: {
    thread_id: "default",
  },
};

await agent.invoke(
  {
    messages: [{ role: "user", content: "我叫张三" }],
  },
  threadConfig,
);

const result = await agent.invoke(
  {
    messages: [{ role: "user", content: "我刚才说我叫什么？" }],
  },
  threadConfig,
);

console.log(result.messages.at(-1)?.content);
```

这里有一个关键点：第二次 `invoke` 只传入了当前用户消息，但因为 `thread_id` 相同，agent 可以从 checkpointer 里读到同一条 thread 的历史状态。

## 4. checkpointer、thread_id、messages 的关系

可以把官方短期记忆理解成这张表：

| 概念 | 作用 | 当前项目里的对应物 |
| --- | --- | --- |
| `messages` | 模型可见的对话上下文 | `Memory` 里的消息数组 |
| `thread_id` | 区分不同会话 | `sessionId` 或 `threadId` |
| `checkpointer` | 保存单个 thread 的 graph state | 未来的持久化层 |
| `MemorySaver` | 内存版 checkpointer | 学习和本地 demo |
| `PostgresSaver` / `SqliteSaver` | 可持久化 checkpointer | 生产或本地落盘 |

`MemorySaver` 只存在于进程内。进程重启后，里面的 checkpoints 会丢失。所以它适合学习、测试和 demo，不适合生产。

如果要生产可恢复，应该换成数据库支持的 checkpointer，例如 PostgreSQL 或 SQLite。

## 5. thread_id 为什么不能省略

如果没有 `thread_id`，所有对话都会混在一起，或者每次调用都变成无状态单轮问答。

推荐从一开始就显式设计 thread：

```text
default    默认会话
docs       文档学习会话
debug      调试任务会话
feature-x  某个功能开发会话
```

调用时始终带上：

```ts
const config = {
  configurable: {
    thread_id: "docs",
  },
};
```

后续如果接入 PostgreSQL，要注意 `thread_id` 不宜过长。可以使用短 slug、UUID 或 workspace 路径 hash。

## 6. 短期记忆什么时候更新

在官方 agent 中，短期记忆不是只在一轮对话结束时保存一次。它会随着 agent 执行逐步更新：

```text
用户输入
  -> 写入 state.messages
  -> 模型回复
  -> 写入 state.messages
  -> 工具调用
  -> 写入 tool call 和 tool result
  -> 下一步继续读取同一个 state
```

这就是为什么官方说短期记忆属于 agent state，而不是单纯的聊天数组。聊天历史只是 state 里最常见的一部分。

当前项目还没完全引入 graph state，因此可以先用手写 `Memory` 模拟这一点：

```text
用户输入
  -> Memory.addUserMessage()
  -> Model.stream({ input, history })
  -> PrintStream 收集完整回答
  -> Memory.addAiMessage()
```

## 7. 当前项目的手写路线

当前 `mini-agent-langchain` 的模型链路是：

```text
ChatPromptTemplate
  -> ChatOpenAI
  -> stream / invoke
```

它还不是完整的 `createAgent`。所以第一版可以先手写短期记忆，不急着直接替换成官方 agent。

### 7.1 Memory 保存消息

第一版可以使用进程内数组：

```ts
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";

export default class Memory {
  private messages: BaseMessage[] = [];

  addUserMessage(content: string) {
    this.messages.push(new HumanMessage(content));
  }

  addAiMessage(content: string) {
    this.messages.push(new AIMessage(content));
  }

  getMessages() {
    return [...this.messages];
  }

  getRecentMessages(limit = 20) {
    return this.messages.slice(-limit);
  }

  clear() {
    this.messages = [];
  }
}
```

如果马上要支持多 thread，可以改成：

```ts
private threads = new Map<string, BaseMessage[]>();
```

然后让每个方法都接收 `threadId`。

### 7.2 Prompt 插入历史消息

如果继续使用 `ChatPromptTemplate`，需要用 `MessagesPlaceholder` 把历史消息插入 prompt：

```ts
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

this.PromptTemplate = ChatPromptTemplate.fromMessages([
  ["system", baseSystemPrompt],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);
```

然后 `Model.stream` 接收对象参数：

```ts
stream(options: { input: string; history?: BaseMessageLike[] }) {
  return this.getChain().stream({
    input: options.input,
    history: options.history ?? [],
  });
}
```

注意不要把当前用户输入同时放进 `history` 和 `{input}`，否则模型会看到重复消息。

### 7.3 主流程边打印边保存

短期记忆能否闭环，关键在于 AI 回复也要写回 memory。因此 `PrintStream` 最好返回完整文本：

```ts
const history = memory.getRecentMessages(20);

const result = await model.stream({
  input,
  history,
});

const answer = await PrintStream(result);

memory.addUserMessage(input);
memory.addAiMessage(answer);
```

更理想的顺序是：

```text
读取历史
  -> 调用模型
  -> 收集回答
  -> 同时写入 user 和 ai 两条消息
```

这样传给模型的 `history` 只包含之前的消息，本轮用户输入只通过 `{input}` 出现一次。

## 8. 长对话管理

短期记忆不能无限增长。原因有三个：

1. 模型上下文窗口有限。
2. 历史越长，响应越慢、成本越高。
3. 很久以前的无关内容会干扰模型注意力。

官方常见策略有四种：

| 策略 | 做法 | 适合阶段 |
| --- | --- | --- |
| trim messages | 调模型前只保留最近 N 条或 N token | 第一版最推荐 |
| delete messages | 从 graph state 中永久删除部分消息 | 有明确删除需求时 |
| summarize messages | 把早期对话压缩成摘要 | 长任务、多轮规划 |
| custom strategies | 按角色、工具、任务阶段过滤 | 工具调用稳定后 |

当前项目第一版建议只做最简单的：

```ts
memory.getRecentMessages(20);
```

等短期记忆跑稳后，再接入 token 级 trim 或 summary。

## 9. 工具调用场景的注意点

一旦接入工具调用，消息历史就不再只是 `human -> ai` 交替。

工具调用通常类似：

```text
human: 查一下今天的天气
ai: tool_calls=[get_weather]
tool: get_weather 的结果
ai: 根据工具结果回答用户
```

很多模型提供商要求带 tool call 的 assistant 消息后面必须跟对应的 tool result。删除或裁剪历史时，不能只删其中一半，否则消息结构可能失效。

所以在没有工具调用前，可以简单按条数裁剪；接入工具后，要按“assistant tool call + tool result”成组处理。

## 10. 与长期记忆的边界

短期记忆回答的是：

```text
这个 thread 里刚才发生了什么？
```

长期记忆回答的是：

```text
跨 thread、跨 session 也值得记住什么？
```

例子：

| 信息 | 应该放哪里 |
| --- | --- |
| 用户刚才说自己叫张三 | 短期记忆 |
| 当前任务已经执行到第 3 步 | 短期记忆 |
| 用户长期偏好中文回答 | 长期记忆 |
| 项目默认启动命令是 `npm run dev` | 长期记忆 |

不要把每一句聊天都写入长期记忆。长期记忆应该是经过筛选、未来仍有价值、并且允许保存的信息。

## 11. 推荐实现顺序

对当前项目，推荐顺序是：

```text
1. Memory 保存 human / ai messages
2. Prompt 加 MessagesPlaceholder("history")
3. Model.stream 支持 { input, history }
4. PrintStream 返回完整 assistant 文本
5. main.ts 在每轮结束后写入 Memory
6. getRecentMessages(20) 做最小上下文控制
7. 增加 threadId
8. 增加 session JSONL 落盘
9. 切到 createAgent + checkpointer
10. 生产化时换 PostgresSaver / SqliteSaver
```

这条路线的好处是：每一步都能运行、能验证，而且不会过早把 graph、数据库、长期记忆混在一起。

## 12. 本章练习

先完成最小闭环：

```text
> 我叫张三
> 我刚才说我叫什么？
```

然后验证隔离：

```text
> /thread fresh
> 我刚才说我叫什么？
```

预期行为：

- 在 `default` thread 中能回答“张三”。
- 在 `fresh` thread 中不能回答“张三”。
- 退出进程后，如果还没有 session 落盘，记忆丢失是正常的。

## 13. 官方资料

- LangChain.js Short-term memory: https://docs.langchain.com/oss/javascript/langchain/short-term-memory
- LangChain.js Messages: https://docs.langchain.com/oss/javascript/langchain/messages
- LangGraph Checkpointers: https://docs.langchain.com/oss/javascript/langgraph/checkpointers
