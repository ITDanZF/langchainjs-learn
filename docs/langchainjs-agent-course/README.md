# mini-agent-langchain 渐进式 Agent CLI 教程

> 从当前 `mini-agent-langchain` 项目出发，每一章只推进一个可运行的小能力，让架构随着学习和真实需求自然演进。

## 当前项目状态

截至本轮课程更新，`mini-agent-langchain` 已经具备这些基础能力：

- `Bootstrap`：负责初始化 `~/.mini-agent`、读取或引导生成 `config.json`。
- `Configuration`：从用户配置文件加载模型配置，并写入运行时环境。
- `WorkSpace`：创建 agent home、sessions、logs 和工作目录。
- `CLI`：默认进入交互式命令行循环，支持 `/exit`、`/quit`、`q`、`退出`。
- `Model`：基于 LangChain `ChatOpenAI` 和 `ChatPromptTemplate` 封装 `invoke` / `stream`。
- `AgentModel`：管理一个默认 `AgentRuntime`，为后续多 Agent 扩展预留位置。
- `Memory`：目前还是空类，正好作为下一步“短期记忆”学习入口。

这意味着课程不再从完全空项目开始，而是从“已经能配置、启动、流式对话的 Agent CLI 雏形”继续推进。

## 学习原则

- 不把所有企业级目录一次性搭出来。
- 不急着把 LangGraph、RAG、多 Agent、插件化全部塞进主线。
- 当前项目需要什么能力，就补什么模块。
- 每一章结束都要能用一个清晰命令验收。
- 概念学习必须落回 `mini-agent-langchain` 当前代码结构。

## 章节目录

| 章节 | 文档 | 本章增量 |
| --- | --- | --- |
| 00 | [课程总览](./00-进阶课程总览.md) | 说明当前代码状态和后续演进路线 |
| 01 | [项目初始化](./01-LangChain.js定位与安装.md) | 最小 TypeScript CLI 和基础脚本 |
| 02 | [模型与 Prompt](./02-ChatModel与Prompt模板.md) | 接入模型、配置和 Prompt |
| 03 | [Runnable 与流式输出](./03-Runnable与LCEL管道.md) | 理解 Runnable、pipe、stream |
| 03b | [工作目录与本地状态目录](./03b-工作目录与本地状态目录.md) | 定义 agent home、sessions、workspace 边界 |
| 04 | [工具系统](./04-Tools与结构化输出.md) | 增加工具抽象和结构化输入输出 |
| 05 | [Agent 任务执行](./05-基于createReactAgent的工具智能体.md) | 让模型根据任务选择工具 |
| 06 | [LangGraph 状态机](./06-LangGraph状态图与可控循环.md) | 学习显式状态图和可控循环 |
| 07 | [会话记忆](./07-记忆检查点与多轮会话.md) | 基于当前代码实现第一版短期记忆 |
| 07a | [LangGraph 记忆官方教程解读](./07a-LangGraph记忆官方教程解读.md) | 学习官方 short-term / long-term memory 设计 |
| 08 | [本地知识库 RAG](./08-RAG知识库问答应用.md) | 新增本地文档检索 |
| 09 | [企业工具箱与权限](./09-多工具业务助手.md) | 增加受限命令工具和权限雏形 |
| 10 | [工程化](./10-复杂应用工程化.md) | 补日志、错误、测试和模块边界 |
| 11 | [评估观测部署](./11-评估观测与部署.md) | 新增评估、观测和发布建议 |
| 12 | [综合项目](./12-综合项目企业知识库与工单助手.md) | 对 01-11 的能力做综合验收 |
| 13-22 | 后续进阶章节 | 规划、审批、代码编辑、多 Agent、服务化、权限、插件和最终蓝图 |

## 记忆学习路线

接下来最重要的是第 07 章和第 07a 章：

```text
当前 CLI 单轮流式对话
  ↓
进程内短期记忆：messages[]
  ↓
thread_id：区分多个会话
  ↓
session 文件：把短期记忆落盘
  ↓
LangGraph checkpointer：官方线程级持久化
  ↓
LangGraph store：长期记忆
```

先不要急着做向量数据库或自动记忆。当前项目的下一步应该是让用户在同一个 CLI 会话里问：

```text
> 我叫张三
> 我刚才说我叫什么？
```

Agent 能回答出来。这就是记忆系统的第一块地基。

## 官方资料

- LangChain.js Overview: https://docs.langchain.com/oss/javascript/langchain/overview
- LangGraph Memory: https://docs.langchain.com/oss/javascript/langgraph/add-memory
- LangGraph Persistence: https://docs.langchain.com/oss/javascript/langgraph/persistence

## 推荐阅读顺序

```text
00 课程总览
→ 07 会话记忆
→ 07a LangGraph 记忆官方教程解读
→ 06 LangGraph 状态机
→ 08 RAG 知识库
```

如果你当前目标是学习 Agent 记忆系统，可以先跳读 04-06，直接读 07 和 07a，再回头补 LangGraph 状态图。
