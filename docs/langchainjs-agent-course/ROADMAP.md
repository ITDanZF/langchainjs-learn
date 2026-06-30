# mini-agent-langchain 主线导图

这份导图说明课程如何从当前代码状态继续演进。核心原则是：先让当前 CLI 具备真实 Agent 的最小能力，再逐步进入 LangGraph、工具、RAG 和多 Agent。

## 当前检查点

当前项目已经完成：

```text
配置初始化
  ~/.mini-agent/config.json

工作目录初始化
  ~/.mini-agent/logs
  ~/.mini-agent/sessions
  AGENT_WORKSPACE 或默认 workspace

模型封装
  ChatOpenAI
  ChatPromptTemplate
  stream / invoke

CLI 交互
  commander
  readline
  PrintStream

Agent 管理雏形
  AgentRuntime
  AgentModel
  active agent
```

还没有完成：

```text
短期记忆
thread_id
session 落盘
LangGraph StateGraph
工具调用
RAG
长期记忆
多 Agent
```

## 版本演进

| 版本 | 目标 | 关键文件 | 说明 |
| --- | --- | --- | --- |
| v0.1 | CLI 能启动 | `main.ts`、`cli/` | 能进入交互循环 |
| v0.2 | 模型能回复 | `model/`、`config/` | 配置来自用户输入和配置文件 |
| v0.3 | 流式多轮输入 | `PrintStream`、`CLI.CLILoop` | 多轮输入但还没有记忆 |
| v0.4 | 进程内短期记忆 | `Memory/index.ts`、`main.ts` | 保存当前 thread 的 messages |
| v0.5 | session 落盘 | `workspace/`、`sessions/` | 用 jsonl 保存会话历史 |
| v0.6 | LangGraph 线程持久化 | `graph/`、`MemorySaver` | 用 checkpointer 管理 thread state |
| v0.7 | 工具调用 | `tools/`、agent loop | 让模型能决定是否使用工具 |
| v0.8 | RAG | `rag/` | 本地文档检索和引用 |
| v0.9 | 长期记忆 | `store` 或 memory 文件 | 保存跨会话用户偏好和项目事实 |
| v1.x | 企业增强 | 多 Agent、审批、服务化、权限 | 从 CLI 演进到平台能力 |

## 记忆主线

记忆能力不要一步到位。推荐顺序：

```text
1. 当前进程内 messages[]
2. thread_id 隔离不同对话
3. sessions/<thread-id>.jsonl 落盘
4. LangGraph MemorySaver
5. Postgres/MongoDB checkpointer
6. LangGraph store
7. 语义搜索长期记忆
```

## 短期记忆与长期记忆边界

| 类型 | 解决的问题 | 示例 | 推荐实现阶段 |
| --- | --- | --- | --- |
| 短期记忆 | 当前 thread 里刚才说了什么 | messages、工具结果、当前任务状态 | 先做 |
| session 持久化 | CLI 退出后能恢复对话 | jsonl 会话文件 | 短期记忆之后 |
| LangGraph checkpointer | 图状态按 thread 保存 | `MemorySaver`、PostgresSaver | 引入 graph 后 |
| 长期记忆 | 新会话也要知道什么 | 用户偏好、项目约定、稳定事实 | 短期记忆稳定后 |
| RAG | 外部知识库问答 | docs、FAQ、制度文档 | 工具和记忆之后 |

## 为什么不马上做长期记忆

长期记忆涉及写入策略、检索策略、删除策略、隐私和过期问题。如果短期记忆还没跑通，直接做长期记忆很容易把问题混在一起。

当前最重要的验收是：

```text
> 我叫张三
> 我刚才说我叫什么？
```

同一个 thread 中，Agent 能回答“张三”。不同 thread 中，Agent 不应该知道。

## 官方资料路线

```text
LangChain.js Overview
  ↓
LangGraph Memory
  ↓
LangGraph Persistence
  ↓
LangChain trimMessages
  ↓
长期记忆 store / semantic search
```

对应官方文档：

- https://docs.langchain.com/oss/javascript/langchain/overview
- https://docs.langchain.com/oss/javascript/langgraph/add-memory
- https://docs.langchain.com/oss/javascript/langgraph/persistence
- https://js.langchain.com/docs/how_to/trim_messages/

## 当前下一步

下一步不要急着改成复杂 LangGraph。建议先在 `src/Memory/index.ts` 中实现最小短期记忆：

```text
Memory
  addUserMessage(threadId, content)
  addAssistantMessage(threadId, content)
  getMessages(threadId)
  clear(threadId)
```

等这个模型跑通，再把它替换或升级为 LangGraph checkpointer。
