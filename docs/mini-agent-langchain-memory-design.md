# mini-agent-langchain 记忆系统设计

- 生成时间：2026-07-01
- 工作区：E:\workspace\agent-tui
- 任务：设计短期记忆、本地工作目录持久化、云端 PostgreSQL 持久化
- 状态：等待确认

## 1. 目标

为 `mini-agent-langchain` 设计一套分层记忆系统：

- 短期记忆：当前 CLI 进程内的上下文窗口，用于本轮运行时的多轮对话。
- 本地持久化：在当前工作目录下初始化记忆存储，重启后可以恢复项目会话。
- 云端持久化：后续接入部署在阿里云服务器上的 PostgreSQL 容器，实现跨机器、跨环境的会话保存。
- 可插拔后端：本地文件和 PostgreSQL 使用同一套 `MemoryStore` 接口，避免主流程关心存储细节。

第一阶段先做短期记忆 + 本地工作目录 JSON 存储；第二阶段再接 PostgreSQL。

## 2. 设计原则

- `Memory` 只负责进程内消息队列，不直接读写文件或数据库。
- `MemoryStore` 只负责持久化，不直接调用模型。
- `main.ts` 只做编排：加载记忆、调用模型、打印回复、写回记忆、保存记忆。
- 模型只接收当前输入和裁剪后的历史上下文，不感知记忆从哪里来。
- 本地和云端使用同一份稳定数据结构，后续便于迁移和同步。

## 3. LangChain 官方文档结论

根据 LangChain / LangGraph TypeScript 官方文档，记忆相关能力可以分成几类：

- Messages 是 LangChain 中模型上下文的基本单位。它们包含 role、content 和 metadata，适合表达 system、human、ai、tool 等消息。
- 短期记忆用于单个 thread / conversation 内的对话连续性。LangChain agent 官方推荐通过 LangGraph checkpointer 实现 thread-level persistence。
- 长对话会遇到上下文窗口、成本和注意力分散问题，官方给出的常见策略是 trim messages、delete messages、summarize messages 或自定义过滤。
- 生产环境的短期记忆推荐使用数据库支持的 checkpointer，例如 PostgreSQL；`MemorySaver` 只适合实验，因为它存于内存，重启后会丢失。
- 长期记忆用于跨 thread / session 的用户偏好、事实和共享知识。LangGraph store 以 namespace + key 的方式保存 JSON 文档，PostgreSQL 可通过 `PostgresStore` 承载。

对本项目的设计影响：

- 当前项目还不是 LangGraph agent，而是手写 `ChatPromptTemplate -> ChatOpenAI` 的链路，因此第一阶段继续手写 `Memory + MemoryStore` 更适合学习底层机制。
- 设计上要贴近官方概念：把 `sessionId` 映射为 LangGraph 的 `thread_id`，把未来的长期记忆映射为 LangGraph store 的 `namespace + key`。
- 后续如果切到 `createAgent` 或 LangGraph，`MemoryStore` 的数据模型应能迁移到 `PostgresSaver` / `PostgresStore`。

官方参考：

- LangChain Messages: https://docs.langchain.com/oss/javascript/langchain/messages
- LangChain Short-term memory: https://docs.langchain.com/oss/javascript/langchain/short-term-memory
- LangChain Long-term memory: https://docs.langchain.com/oss/javascript/langchain/long-term-memory
- LangGraph Persistence: https://docs.langchain.com/oss/javascript/langgraph/persistence
- LangGraph Checkpointers: https://docs.langchain.com/oss/javascript/langgraph/checkpointers
- LangGraph Stores: https://docs.langchain.com/oss/javascript/langgraph/stores

## 4. 总体架构

```text
CLI 输入
  -> main.ts
    -> Memory.getRecentMessages()
    -> Model.stream({ input, history })
    -> PrintStream(result)
    -> Memory.addUserMessage(input)
    -> Memory.addAiMessage(answer)
    -> MemoryStore.save(session)

Memory
  进程内短期记忆

MemoryStore
  持久化接口

LocalWorkspaceMemoryStore
  本地工作目录 JSON 存储

PostgresMemoryStore
  云端 PostgreSQL 存储

LangGraphNativeMemoryAdapter
  后续可选：迁移到官方 checkpointer/store
```

## 5. 记忆分层

### 5.1 短期记忆

短期记忆存在于当前 Node.js 进程内，负责给模型提供最近上下文。

建议接口：

```ts
class Memory {
  private messages: BaseMessage[] = [];

  addUserMessage(content: string): void;
  addAiMessage(content: string): void;
  getMessages(): BaseMessage[];
  getRecentMessages(limit?: number): BaseMessage[];
  loadMessages(messages: BaseMessage[]): void;
  clear(): void;
}
```

说明：

- `getMessages()` 返回完整进程内历史，用于保存。
- `getRecentMessages(20)` 返回最近 20 条，用于传给模型。
- `loadMessages()` 用于从本地或云端恢复历史。

### 5.2 线程级持久化记忆

线程级持久化记忆负责把单个 session / thread 的对话历史写入稳定介质。它对应 LangGraph 文档中的 checkpointer 场景：conversation continuity、resume、fault tolerance。

本地持久化用于开发和项目绑定记忆。

云端持久化用于跨设备、远程部署、后续多用户能力。

第一版不做自动本地云端同步，只通过配置选择一种后端。同步可以作为后续能力单独设计。

### 5.3 长期记忆

长期记忆不是完整聊天记录，而是从多轮对话中提炼出的稳定信息，例如：

- 用户偏好：喜欢简洁回答、偏好 TypeScript。
- 项目事实：当前项目使用 LangChain.js 和 ESM。
- 工作流规则：本地写文件前需要确认。

这类数据后续应该独立进入 `LongTermMemoryStore`，结构贴近 LangGraph store 的 namespace + key：

```ts
type LongTermMemoryItem = {
  namespace: string[];
  key: string;
  value: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
```

第一阶段不实现长期记忆，只在数据模型里预留扩展位。

## 6. Model 对接

`Model.stream` 推荐使用对象参数：

```ts
type StreamOptions = {
  input: string;
  history?: BaseMessageLike[];
};

stream(options: StreamOptions) {
  return this.getChain().stream(options);
}
```

Prompt 需要有 `history` 占位符：

```ts
ChatPromptTemplate.fromMessages([
  ["system", baseSystemPrompt],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);
```

调用顺序：

```ts
const result = await model.stream({
  input,
  history: memory.getRecentMessages(20),
});

const answer = await PrintStream(result);

memory.addUserMessage(input);
memory.addAiMessage(answer);
await memoryStore.save(memory.getSession());
```

不要在模型调用前把当前用户输入写入 `history`，否则当前输入会重复出现。

### 6.1 流式输出与消息保存

官方 Messages 文档说明，模型普通调用返回 `AIMessage`，流式调用会收到 `AIMessageChunk`，chunk 可以合并成完整消息。

本项目第一版可以继续用 `PrintStream` 拼接文本，因为当前只保存纯文本 `content`。后续接工具调用或需要 usage metadata 时，应改成收集并合并 `AIMessageChunk`，然后保存：

- `content`
- `id`
- `tool_calls`
- `usage_metadata`
- `response_metadata`

这样会更贴近 LangChain message 的完整语义。

## 7. 统一数据模型

不要直接序列化 LangChain 的 `BaseMessage` 实例。建议定义稳定 DTO：

```ts
type MemoryRole = "human" | "ai" | "system" | "tool";

type PersistedMessage = {
  id: string;
  sessionId: string;
  role: MemoryRole;
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

type PersistedSession = {
  version: 1;
  id: string;
  title?: string;
  workspaceId: string;
  agentId: string;
  createdAt: string;
  updatedAt: string;
  messages: PersistedMessage[];
  metadata?: Record<string, unknown>;
};
```

第一版可以只实际使用 `human` 和 `ai`，但保留 `system`、`tool` 是为了后续 Agent 工具调用。

转换关系：

```text
LangChain BaseMessage[]
  <-> PersistedMessage[]
  <-> Local JSON / PostgreSQL rows
```

### 7.1 与官方 message 角色的映射

建议内部 DTO 使用项目自己的 role，但转换时明确映射：

```text
human  -> HumanMessage
ai     -> AIMessage
system -> SystemMessage
tool   -> ToolMessage
```

注意：如果后续保存 tool call，AIMessage 和 ToolMessage 必须成对保留，不能只裁剪其中一条。官方文档也提醒，很多 provider 要求带 tool_calls 的 assistant 消息后面跟对应 tool result。

## 8. 本地工作目录存储

### 8.1 存储位置

你计划在本地工作目录做初始化存储，因此建议不要放在用户全局 home，而是放在当前 agent workspace 下：

```text
<AGENT_WORKSPACE>/.mini-agent-langchain/memory/sessions/<sessionId>.json
```

如果用户没有配置 `AGENT_WORKSPACE`，则使用项目已有的默认 workspace。

建议目录结构：

```text
<workspace>/
  .mini-agent-langchain/
    memory/
      sessions/
        default.json
      index.json
```

`default.json` 保存默认会话。

`index.json` 保存会话列表、当前活跃会话等轻量索引。

### 8.2 本地会话文件格式

```json
{
  "version": 1,
  "id": "default",
  "title": "Default Session",
  "workspaceId": "workspace-path-hash",
  "agentId": "Main_Agent",
  "createdAt": "2026-07-01T10:00:00.000Z",
  "updatedAt": "2026-07-01T10:01:00.000Z",
  "messages": [
    {
      "id": "msg_001",
      "sessionId": "default",
      "role": "human",
      "content": "你好",
      "createdAt": "2026-07-01T10:00:00.000Z"
    },
    {
      "id": "msg_002",
      "sessionId": "default",
      "role": "ai",
      "content": "你好，有什么可以帮你？",
      "createdAt": "2026-07-01T10:00:01.000Z"
    }
  ]
}
```

### 8.3 本地初始化流程

启动时：

```text
1. 解析 workspace 路径。
2. 创建 <workspace>/.mini-agent-langchain/memory/sessions。
3. 如果 index.json 不存在，创建默认索引。
4. 如果 default.json 不存在，视为新会话，Memory 为空。
5. 如果 default.json 存在，加载 messages 到 Memory。
```

每轮对话结束后：

```text
1. Memory 写入 user/ai 消息。
2. 转换为 PersistedSession。
3. 写入临时文件 default.json.tmp。
4. 原子替换 default.json。
5. 更新 index.json 的 updatedAt。
```

本地写入建议使用临时文件 + rename，避免进程中断导致 JSON 半截写入。

## 9. 云端 PostgreSQL 存储

你后续计划在阿里云服务器部署 PostgreSQL 容器。云端存储建议作为第二阶段实现，和本地存储共用 `MemoryStore` 接口。

### 9.1 两条 PostgreSQL 路线

官方文档提供了两种和 PostgreSQL 相关的记忆能力：

```text
PostgresSaver
  用于 LangGraph checkpointer
  适合短期、thread-scoped conversation state

PostgresStore
  用于 LangGraph store
  适合长期、cross-thread JSON memory
```

对当前项目，建议分阶段：

- 当前手写链路：先实现自己的 `PostgresMemoryStore`，表结构清晰，便于学习消息如何保存和恢复。
- 后续 LangGraph 阶段：再引入 `@langchain/langgraph-checkpoint-postgres`，把短期记忆迁移到 `PostgresSaver`，把长期记忆迁移到 `PostgresStore`。

这样既不丢掉学习价值，也不和官方路线背离。

### 9.2 连接配置

建议配置项：

```env
MEMORY_BACKEND=local
MEMORY_LOCAL_ROOT=
MEMORY_POSTGRES_URL=postgres://user:password@host:5432/mini_agent
MEMORY_SESSION_ID=default
```

`MEMORY_BACKEND` 可选：

```text
local      只使用本地工作目录存储
postgres   只使用 PostgreSQL 存储
dual       本地和 PostgreSQL 都写入，后续再设计同步冲突处理
```

第一阶段建议只实现 `local`。

第二阶段实现 `postgres`。

`dual` 不建议一开始做，因为它会引入同步失败、冲突合并、离线恢复等复杂问题。

### 9.3 PostgreSQL 表设计

建议两张核心表：`memory_sessions` 和 `memory_messages`。

```sql
create table memory_sessions (
  id text primary key,
  workspace_id text not null,
  agent_id text not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table memory_messages (
  id text primary key,
  session_id text not null references memory_sessions(id) on delete cascade,
  role text not null check (role in ('human', 'ai', 'system', 'tool')),
  content text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index memory_messages_session_created_idx
  on memory_messages (session_id, created_at);

create index memory_sessions_workspace_updated_idx
  on memory_sessions (workspace_id, updated_at desc);
```

### 9.4 PostgreSQL Store 接口行为

```ts
class PostgresMemoryStore implements MemoryStore {
  load(sessionId: string): Promise<PersistedSession | null>;
  save(session: PersistedSession): Promise<void>;
  appendMessages(sessionId: string, messages: PersistedMessage[]): Promise<void>;
  clear(sessionId: string): Promise<void>;
}
```

第一版可以用 `save(session)` 整体覆盖式保存。

消息量变大后，建议切换到 `appendMessages()` 增量追加。

### 9.5 云端错误策略

云端存储不能静默失败。

建议策略：

- `MEMORY_BACKEND=postgres` 时，数据库连接失败应直接报错，让用户知道记忆不可用。
- `MEMORY_BACKEND=local` 时，不连接 PostgreSQL。
- `MEMORY_BACKEND=dual` 时，任何一边失败都要显式提示；是否允许另一边继续保存，需要单独确认。

不要默认“云端失败就偷偷写本地”，否则用户会误以为云端已经保存成功。

### 9.6 后续迁移到官方 PostgresSaver / PostgresStore

如果项目后续从手写 `Model.stream` 演进到 LangGraph，可以采用官方持久化：

```ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(DB_URI);
```

长期记忆：

```ts
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";

const store = PostgresStore.fromConnString(DB_URI);
await store.setup();
```

迁移映射：

```text
sessionId      -> thread_id
workspaceId    -> namespace 组成部分
message history -> checkpointer state.messages
user/project facts -> store namespace + key + JSON value
```

## 10. MemoryStore 抽象

建议新增接口：

```ts
type MemoryStoreBackend = "local" | "postgres";

interface MemoryStore {
  load(sessionId: string): Promise<PersistedSession | null>;
  save(session: PersistedSession): Promise<void>;
  clear(sessionId: string): Promise<void>;
}
```

实现类：

```text
src/Memory/
  index.ts
  types.ts
  serializer.ts
  stores/
    LocalWorkspaceMemoryStore.ts
    PostgresMemoryStore.ts
```

`serializer.ts` 负责：

```text
BaseMessage[] -> PersistedMessage[]
PersistedMessage[] -> BaseMessage[]
```

这样本地 JSON 和 PostgreSQL 都不用理解 LangChain message 实例。

## 11. main.ts 编排

目标流程：

```ts
const memory = new Memory();
const memoryStore = createMemoryStore(config);
const sessionId = config.MEMORY_SESSION_ID ?? "default";

const session = await memoryStore.load(sessionId);
if (session) {
  memory.loadMessages(toLangChainMessages(session.messages));
}

await cli.run(process.argv, async (input: string) => {
  const result = await runTime.AgentRuntime.model.stream({
    input,
    history: memory.getRecentMessages(20),
  });

  const answer = await PrintStream(result);

  memory.addUserMessage(input);
  memory.addAiMessage(answer);

  await memoryStore.save(createSessionFromMemory(memory, sessionId));
});
```

后续可以把这段编排抽到 `AgentRuntime`，但第一版放在 `main.ts` 更直观。

## 12. CLI 命令规划

第一阶段建议实现最小命令：

```text
/memory clear
/memory show
```

含义：

- `/memory clear`：清空当前短期记忆，并清空当前持久化 session。
- `/memory show`：展示当前 sessionId、消息条数、持久化后端。

第二阶段再考虑：

```text
/session new
/session list
/session use <id>
/memory backend
```

## 13. 配置设计

建议扩展 config：

```ts
type MemoryConfig = {
  MEMORY_BACKEND: "local" | "postgres";
  MEMORY_SESSION_ID: string;
  MEMORY_LOCAL_ROOT?: string;
  MEMORY_POSTGRES_URL?: string;
};
```

默认值：

```text
MEMORY_BACKEND=local
MEMORY_SESSION_ID=default
MEMORY_LOCAL_ROOT=<workspace>/.mini-agent-langchain/memory
```

PostgreSQL 阶段才要求：

```text
MEMORY_POSTGRES_URL=postgres://...
```

## 14. 上下文长度控制

持久化层保存完整历史，但模型上下文只读取最近 N 条：

```ts
memory.getRecentMessages(20)
```

后续可以增加摘要：

```text
完整消息历史 -> 摘要记忆 + 最近 N 条消息 -> 模型上下文
```

第一版不建议做摘要，先把数据流跑稳。

官方短期记忆文档中的策略可以作为后续演进顺序：

```text
第一步：按消息条数裁剪，保留最近 N 条。
第二步：按 token 裁剪，尽量从 human 消息开始。
第三步：摘要旧消息，保留 summary + 最近 N 条。
第四步：把稳定偏好和事实抽取到长期记忆。
```

## 15. 实施阶段

### 阶段 1：短期记忆

- `Memory` 支持 add/get/recent/load/clear。
- `Model.stream` 支持 `{ input, history }`。
- Prompt 加 `MessagesPlaceholder("history")`。
- `main.ts` 按正确顺序写入记忆。

### 阶段 2：本地工作目录持久化

- 新增 `LocalWorkspaceMemoryStore`。
- 初始化 `<workspace>/.mini-agent-langchain/memory`。
- 保存 `sessions/default.json`。
- 启动时恢复 `default.json`。
- 增加 `/memory clear`。

### 阶段 3：云端 PostgreSQL 持久化

- 新增 `PostgresMemoryStore`。
- 增加数据库连接配置。
- 创建 `memory_sessions` 和 `memory_messages` 表。
- 支持从 PostgreSQL 加载和保存当前 session。

### 阶段 4：LangGraph 官方持久化适配

- 引入 `PostgresSaver` 承接 thread-level 短期记忆。
- 引入 `PostgresStore` 承接长期记忆。
- 让当前 `sessionId`、`workspaceId`、`agentId` 与官方 `thread_id`、namespace 对齐。

### 阶段 5：多会话与同步

- 支持 `/session new/list/use`。
- 支持本地和云端之间的同步策略。
- 处理冲突、离线写入和增量上传。

## 16. 推荐路线

建议先按这个顺序推进：

1. 短期记忆跑通。
2. 本地工作目录 JSON 持久化跑通。
3. PostgreSQL Store 单独接入。
4. LangGraph 官方 checkpointer/store 适配。
5. 最后再讨论本地和云端双写或同步。

原因是本地和云端同时做会过早引入同步复杂度。先把 `MemoryStore` 抽象设计好，后续加 PostgreSQL 只需要新增一个后端，不需要推翻主流程。

## 17. 待确认问题

需要确认三点：

1. 本地存储目录是否确定为 `<workspace>/.mini-agent-langchain/memory`？
2. 第一版是否只支持 `default` 单会话？
3. PostgreSQL 第一版是否先做自定义 `PostgresMemoryStore`，后续再接官方 `PostgresSaver` / `PostgresStore`？
4. 第一版是否只做单向远程持久化，不做本地云端同步？

推荐答案：

1. 是。
2. 是。
3. 是。
4. 是。
