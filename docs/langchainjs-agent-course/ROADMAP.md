# mini-agent-langchain 渐进式主线导图

这份导图说明 01-22 章如何从一个能跑的小 CLI，逐步演进成企业 Agent 平台雏形。

## 一句话主线

```text
先做一个能运行的小功能，再为真实痛点增加一个模块；架构不是预先铺满，而是在每次迭代后变得更清楚。
```

## 版本演进

| 版本 | 章节 | 新增能力 | 新增依赖 | 架构变化 |
| --- | --- | --- | --- | --- |
| v0.1 | 01 | `ask` 占位 CLI | `commander`、`tsx`、`typescript` | 只有 `src/main.ts` 和输入工具 |
| v0.2 | 02 | 真实模型回答 | `@langchain/openai`、`@langchain/core`、`dotenv`、`zod` | 新增 `config/`、`models/`、`prompts/`、`chains/` |
| v0.3 | 03 | 流式输出 | 无 | 新增 `utils/stream.ts` |
| v0.4 | 04 | 文件工具 | 无 | 新增 `tools/` 和工作区路径边界 |
| v0.5 | 05 | `run` 工具 Agent | `langchain` | 新增 `agents/`，模型开始主动使用工具 |
| v0.6 | 06 | LangGraph 运行时 | `@langchain/langgraph` | 新增 `graph/`，把循环从黑盒变成状态机 |
| v0.7 | 07 | 多轮会话 | 无或检查点相关依赖 | 新增 `memory/` |
| v0.8 | 08 | 本地 RAG | 向量库和文档加载相关依赖 | 新增 `rag/` 和 `index` 命令 |
| v0.9 | 09-12 | 权限、工程化、评估、综合验收 | 按章节需要引入 | 补齐日志、错误、测试、eval |
| v1.x | 13-22 | 规划、审批、编辑、多 Agent、服务化、插件 | 按能力引入 | 从 CLI 项目继续演进为平台雏形 |

## 关键节奏

### 01 → 02：从命令壳到模型调用

第 01 章只证明 CLI 能接收输入。第 02 章第一次需要模型，因此才引入 `.env`、配置校验、模型封装和 Prompt。

### 03 → 04：先改善体验，再增加行动能力

第 03 章只改输出方式，不增加工具。第 04 章才加入文件工具，并且先独立实现，不急着交给 Agent。

### 04 → 05：工具交给 Agent

第 04 章的工具只是普通能力模块。第 05 章新增 `run` 命令，把工具交给模型自动选择，项目第一次具备任务执行能力。

### 05 → 06：黑盒 Agent 变成可控 Graph

第 05 章用 `createAgent()` 快速跑通。第 06 章才引入 LangGraph，因为此时已经有了真实痛点：需要控制工具循环、权限分支、中断和审计。

### 08 → 16：最小 RAG 升级为知识库治理

第 08 章先让 Markdown 可索引、可检索。第 16 章再补增量索引、元数据、混合检索、权限过滤和引用治理。

### 09 → 14：权限信号升级为审批流程

第 09 章只做权限雏形，遇到高风险命令返回信号。第 14 章再把它接入 Human-in-the-loop 审批节点。

## 推荐学习路径

稳扎稳打：

```text
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12
```

开发助手方向：

```text
01-12 → 13 → 14 → 15 → 18
```

企业知识库方向：

```text
01-12 → 16 → 17 → 20
```

平台方向：

```text
01-12 → 13 → 14 → 17 → 18 → 19 → 20 → 21 → 22
```

## 架构快照

开始时：

```text
src/
  main.ts
  utils/input.ts
```

接入模型后：

```text
src/
  main.ts
  config/env.ts
  models/chat.ts
  prompts/system.ts
  chains/ask.ts
  utils/input.ts
```

具备 Agent 执行后：

```text
src/
  agents/task-agent.ts
  tools/
  models/
  prompts/
  chains/
  main.ts
```

引入可控运行时后：

```text
src/
  graph/task-graph.ts
  agents/
  tools/
  memory/
  rag/
  observability/
```

这些快照不是一次性创建清单，而是每个阶段完成后的自然结果。
